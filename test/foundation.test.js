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
  assert.equal(project.settings.textDefaults.fontFamily, "Georgia");
  assert.equal(project.settings.textDefaults.textBorder.width, 0);
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
  assert.equal(normalized.settings.textDefaults.fontFamily, "Georgia");
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
    selectedFace: "front",
    selectedPrintPreviewPage: 0,
    printPanels: {
      settings: true,
      selections: true,
      preview: true
    }
  });
});

test("createTextSequence handles numeric and alphabetic definitions", () => {
  const numeric = Sequences.createTextSequence({
    name: "Numbers",
    type: "numeric",
    start: "2",
    padTo: "2"
  });
  const alphabetic = Sequences.createTextSequence({
    name: "Letters",
    type: "alphabetic",
    padTo: "4"
  });

  assert.equal(numeric.start, 2);
  assert.equal(numeric.padTo, 2);
  assert.equal(alphabetic.padTo, 0);
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
    type: "numeric"
  });
  const alphabetic = Sequences.createTextSequence({
    type: "alphabetic"
  });

  assert.equal(Sequences.resolveTextValue(numeric, 1, { start: 3, padTo: 2 }), "04");
  assert.equal(Sequences.resolveTextValue(alphabetic, 27), "AB");
  assert.equal(Sequences.resolveTextValue(alphabetic, 51), "AZ");
  assert.equal(Sequences.resolveTextValue(alphabetic, 52), "BA");
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

test("token cloning creates new ids while preserving token content", () => {
  const token = Tokens.createTokenTemplate({
    name: "Goblin",
    front: {
      images: [Tokens.createImageComponent({ name: "Goblin Art", source: "data:image/png;base64,abc" })],
      texts: [Tokens.createTextComponent({ name: "Label", customText: "Goblin" })]
    }
  });

  const clone = Tokens.cloneTokenTemplate(token);

  assert.equal(clone.name, "Goblin Copy");
  assert.notEqual(clone.id, token.id);
  assert.notEqual(clone.front.images[0].id, token.front.images[0].id);
  assert.notEqual(clone.front.texts[0].id, token.front.texts[0].id);
  assert.equal(clone.front.images[0].source, token.front.images[0].source);
  assert.equal(clone.front.texts[0].customText, token.front.texts[0].customText);
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

  assert.equal(token.borderUnderImages, true);
  assert.equal(token.borderUnderText, true);
  assert.equal(token.front.border.widthRatio, 0.25);
});

test("component z-order can move across the border layer without duplicates", () => {
  const token = Tokens.createTokenTemplate({
    front: {
      images: [Tokens.createImageComponent({ name: "Art", zIndex: -1 })],
      texts: [Tokens.createTextComponent({ name: "Label", zIndex: 1 })]
    }
  });

  assert.equal(Tokens.canMoveComponentZ(token.front, "image", token.front.images[0].id, "up"), true);
  assert.equal(Tokens.moveComponentZ(token.front, "image", token.front.images[0].id, "up"), true);
  assert.equal(token.front.images[0].zIndex, 1);
  assert.equal(token.front.texts[0].zIndex, 2);

  assert.equal(Tokens.moveComponentZ(token.front, "text", token.front.texts[0].id, "down"), true);
  assert.equal(token.front.images[0].zIndex, 2);
  assert.equal(token.front.texts[0].zIndex, 1);
});

test("color sequences wrap when copies exceed sequence length", () => {
  const colorSequence = Sequences.createColorSequence({
    id: "c1",
    valuesText: "#000000\n#ffffff"
  });

  assert.equal(Sequences.resolveColorValue(colorSequence, 0), "#000000");
  assert.equal(Sequences.resolveColorValue(colorSequence, 1), "#ffffff");
  assert.equal(Sequences.resolveColorValue(colorSequence, 2), "#000000");
  assert.equal(Sequences.resolveColorValue(colorSequence, -1), "#ffffff");
});

test("print selections allow copy counts beyond color sequence length", () => {
  const project = Schema.createDefaultProject();
  const colorSequence = Sequences.createColorSequence({
    id: "c1",
    valuesText: "#000000\n#ffffff"
  });
  const token = Tokens.createTokenTemplate({
    front: {
      texts: [
        Tokens.createTextComponent({
          contentMode: "numeric",
          sequenceStart: 1,
          sequencePad: 2,
          colorMode: "sequence",
          colorSequenceRef: "c1"
        })
      ]
    }
  });
  project.sequences.color.push(colorSequence);

  const selections = Print.normalizeSelections(project, [{
    tokenId: token.id,
    copies: 5,
    sequenceStart: 1
  }]);

  assert.deepEqual(selections, [{
    tokenId: token.id,
    copies: 5,
    sequenceStart: 1
  }]);
});

test("print layout creates at least one page with placed items", () => {
  const project = Schema.createDefaultProject();
  const token = Tokens.createTokenTemplate({ id: "token-1", diameterIn: 1 });
  project.tokens.push(token);
  project.printSelections = [{ tokenId: "token-1", copies: 3, sequenceStart: 1 }];

  const layout = Print.layoutProject(project);

  assert.equal(layout.pages.length >= 1, true);
  assert.equal(layout.pages[0].items.length, 3);
  assert.equal(layout.pages[0].items[1].xIn - layout.pages[0].items[0].xIn, 1.125);
});

test("print start 0 yields a first numeric value of 0", () => {
  const project = Schema.createDefaultProject();
  const token = Tokens.createTokenTemplate({
    id: "token-1",
    front: {
      texts: [
        Tokens.createTextComponent({
          contentMode: "numeric",
          sequenceStart: 1
        })
      ]
    }
  });
  project.tokens.push(token);
  project.printSelections = [{ tokenId: "token-1", copies: 2, sequenceStart: 0 }];

  const layout = Print.layoutProject(project);
  const firstIndex = layout.pages[0].items[0].sequenceIndex;
  const secondIndex = layout.pages[0].items[1].sequenceIndex;

  assert.equal(Tokens.getTextValue(token.front.texts[0], project.sequences.text, firstIndex), "0");
  assert.equal(Tokens.getTextValue(token.front.texts[0], project.sequences.text, secondIndex), "1");
});
