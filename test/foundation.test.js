const test = require("node:test");
const assert = require("node:assert/strict");

const Schema = require("../src/js/00-schema.js");
const Utils = require("../src/js/05-utils.js");
const Storage = require("../src/js/10-storage.js");
const State = require("../src/js/20-state.js");
const Sequences = require("../src/js/30-sequences.js");
const Tokens = require("../src/js/40-tokens.js");
const Print = require("../src/js/60-print.js");

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, value);
    }
  };
}

test("createDefaultProject returns the expected baseline structure", () => {
  const project = Schema.createDefaultProject();

  assert.equal(project.version, 1);
  assert.equal(project.meta.name, "Untitled Project");
  assert.equal(project.settings.pagePresetId, "letter");
  assert.deepEqual(project.sequences.text.map((sequence) => sequence.id), [
    "builtin_text_numeric",
    "builtin_text_alphabet"
  ]);
  assert.deepEqual(project.sequences.color.map((sequence) => sequence.id), [
    "builtin_color_rainbow",
    "builtin_color_primary"
  ]);
  assert.deepEqual(project.tokens, []);
  assert.deepEqual(project.printSelections, []);
});

test("normalizeProject fills missing values and rejects unknown page presets", () => {
  const normalized = Schema.normalizeProject({
    meta: { name: "" },
    settings: {
      pagePresetId: "bogus",
      pageOrientation: "landscape",
      pageMarginIn: 0.5
    }
  });

  assert.equal(normalized.meta.name, "Untitled Project");
  assert.equal(normalized.settings.pagePresetId, "letter");
  assert.equal(normalized.settings.pageOrientation, "landscape");
  assert.equal(normalized.settings.pageMarginIn, 0.5);
  assert.equal(normalized.sequences.text[0].id, "builtin_text_numeric");
  assert.equal(normalized.sequences.color[0].id, "builtin_color_rainbow");
});

test("storage round-trips a saved project", () => {
  const storage = createMemoryStorage();
  const project = Schema.createDefaultProject();
  project.meta.name = "Round Trip";

  assert.equal(Storage.saveProject(storage, project), true);

  const loaded = Storage.loadProject(storage);
  assert.equal(loaded.meta.name, "Round Trip");
});

test("state store persists updates and active tab changes", () => {
  const storage = createMemoryStorage();
  const store = State.createStore({ storage });

  store.updateProject((project) => {
    project.meta.name = "Updated Project";
  });
  store.setActiveTab("designer");

  const savedProject = JSON.parse(storage.getItem(Schema.STORAGE_KEY));
  const savedUi = JSON.parse(storage.getItem(Schema.UI_STORAGE_KEY));

  assert.equal(savedProject.meta.name, "Updated Project");
  assert.equal(savedUi.activeTab, "designer");
});

test("state store can update without persisting until requested", () => {
  const storage = createMemoryStorage();
  const store = State.createStore({ storage });

  store.updateProject((project) => {
    project.meta.name = "Draft";
  }, { persist: false });
  assert.equal(storage.getItem(Schema.STORAGE_KEY), null);

  store.persistProject();
  const savedProject = JSON.parse(storage.getItem(Schema.STORAGE_KEY));
  assert.equal(savedProject.meta.name, "Draft");
});

test("loadUiState provides editing slots for sequence forms", () => {
  const storage = createMemoryStorage();
  const uiState = Storage.loadUiState(storage);

  assert.deepEqual(uiState, {
    activeTab: "designer",
    editingTextSequenceId: null,
    editingColorSequenceId: null,
    selectedTextSequenceId: null,
    selectedColorSequenceId: null,
    selectedTokenId: null,
    selectedComponentType: null,
    selectedComponentId: null,
    selectedFace: "front"
  });
});

test("createTextSequence handles numeric and custom definitions", () => {
  const numeric = Sequences.createTextSequence({
    name: "Numbers",
    type: "numeric",
    start: "2",
    step: "3",
    padTo: "2"
  });
  const custom = Sequences.createTextSequence({
    name: "Names",
    type: "custom",
    customValuesText: "Goblin\nOrc\n"
  });

  assert.equal(numeric.start, 2);
  assert.equal(numeric.step, 3);
  assert.equal(numeric.padTo, 2);
  assert.deepEqual(custom.customValues, ["Goblin", "Orc"]);
});

test("createColorSequence filters invalid colors and reports finite lengths", () => {
  const sequence = Sequences.createColorSequence({
    name: "Faction",
    valuesText: "#ff0000\ninvalid\n#00ff00"
  });

  assert.deepEqual(sequence.values, ["#ff0000", "#00ff00"]);
  assert.equal(Sequences.getFiniteLength(sequence, "color"), 2);
});

test("parseLineList trims and removes blank lines", () => {
  assert.deepEqual(Utils.parseLineList("one\n\n two \n"), ["one", "two"]);
});

test("resolveTextValue handles numeric and alphabetic sequences", () => {
  const numeric = Sequences.createTextSequence({
    type: "numeric",
    start: 3,
    step: 2,
    prefix: "G",
    padTo: 2
  });
  const alphabetic = Sequences.createTextSequence({
    type: "alphabetic"
  });

  assert.equal(Sequences.resolveTextValue(numeric, 1), "G05");
  assert.equal(Sequences.resolveTextValue(alphabetic, 27), "AB");
});

test("clampRect allows components to extend outside the token square", () => {
  const rect = Tokens.clampRect({
    x: 0.9,
    y: -0.2,
    width: 0.3,
    height: 0.4
  });

  assert.deepEqual(rect, {
    x: 0.9,
    y: -0.2,
    width: 0.3,
    height: 0.4
  });
});

test("text components preserve zero-centered coordinates", () => {
  const component = Tokens.createTextComponent({
    x: 0,
    y: 0,
    width: 0.5,
    height: 0.2
  });

  assert.equal(component.x, 0);
  assert.equal(component.y, 0);
  assert.equal(component.width, 0.5);
  assert.equal(component.height, 0.2);
});

test("image components use centered defaults and aspect-based scaling", () => {
  const component = Tokens.createImageComponent({
    aspectRatio: 2
  });

  assert.equal(component.x, 0);
  assert.equal(component.y, 0);
  assert.equal(component.scale, 0.5);
  assert.equal(component.rotationDeg, 0);
  assert.equal(component.mirrorX, false);
  assert.equal(component.mirrorY, false);
  assert.deepEqual(Tokens.getImageDimensions(component), {
    width: 0.5,
    height: 0.25
  });
});

test("token templates cap border width ratio at twenty-five percent", () => {
  const token = Tokens.createTokenTemplate({
    borderUnderContent: true,
    front: {
      border: {
        widthRatio: 0.5
      }
    }
  });

  assert.equal(token.borderUnderContent, true);
  assert.equal(token.front.border.widthRatio, 0.25);
});

test("print max copies are capped by the shortest bounded sequence", () => {
  const project = Schema.createDefaultProject();
  const textSequence = Sequences.createTextSequence({
    id: "t1",
    type: "custom",
    customValuesText: "one\ntwo\nthree"
  });
  const colorSequence = Sequences.createColorSequence({
    id: "c1",
    valuesText: "#000000\n#ffffff"
  });
  const token = Tokens.createTokenTemplate({
    front: {
      texts: [
        Tokens.createTextComponent({
          contentMode: "sequence",
          textSequenceRef: "t1",
          colorMode: "sequence",
          colorSequenceRef: "c1"
        })
      ]
    }
  });
  project.sequences.text.push(textSequence);
  project.sequences.color.push(colorSequence);

  assert.equal(Print.getTokenMaxCopies(token, project), 2);
});

test("print layout creates at least one page with placed items", () => {
  const project = Schema.createDefaultProject();
  const token = Tokens.createTokenTemplate({ id: "token-1", diameterIn: 1 });
  project.tokens.push(token);
  project.printSelections = [{ tokenId: "token-1", copies: 3, sequenceStartIndex: 0 }];

  const layout = Print.layoutProject(project);

  assert.equal(layout.pages.length >= 1, true);
  assert.equal(layout.pages[0].items.length, 3);
});
