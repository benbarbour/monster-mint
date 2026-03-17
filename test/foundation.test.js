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

function createFailingPersistence() {
  return {
    loadProject: async () => Schema.createDefaultProject(),
    saveProject: async () => false,
    loadUiState: async () => Storage.defaultUiState(),
    saveUiState: async () => false
  };
}

function makeDataUrl(mimeType, byteLength) {
  const payload = Buffer.alloc(byteLength, 97).toString("base64");
  return `data:${mimeType};base64,${payload}`;
}

test("createDefaultProject returns the expected baseline structure", () => {
  const project = Schema.createDefaultProject();

  assert.equal(project.version, 1);
  assert.equal(project.meta.name, "Untitled Project");
  assert.equal(project.settings.pagePresetId, "letter");
  assert.equal(project.settings.tokenDefaults.diameterIn, 1);
  assert.equal(project.settings.imageTrimAlphaThreshold, 1);
  assert.equal(project.settings.tokenDefaults.backgroundMode, "color");
  assert.equal(project.settings.tokenDefaults.backgroundColor, "#f3e7c9");
  assert.equal(project.settings.tokenDefaults.borderWidthRatio, 0.03);
  assert.equal(project.settings.tokenDefaults.borderColor, "#000000");
  assert.equal(project.settings.textDefaults.fontFamily, "Times New Roman");
  assert.equal(project.settings.textDefaults.color, "#ffffff");
  assert.equal(project.settings.textDefaults.textBorder.width, 3);
  assert.equal(project.settings.textDefaults.textBorder.color, "#000000");
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
  assert.equal(normalized.settings.imageTrimAlphaThreshold, 1);
  assert.equal(normalized.settings.tokenDefaults.backgroundMode, "color");
  assert.equal(normalized.settings.textDefaults.fontFamily, "Times New Roman");
  assert.equal(normalized.sequences.text[0].id, "builtin_text_numeric");
  assert.equal(normalized.sequences.color[0].id, "builtin_color_rainbow");
});

test("local storage persistence round-trips a saved project", async () => {
  const storage = Storage.createLocalStoragePersistence(createMemoryStorage());
  const project = Schema.createDefaultProject();
  project.meta.name = "Round Trip";

  assert.equal(await storage.saveProject(project), true);

  const loaded = await storage.loadProject();
  assert.equal(loaded.meta.name, "Round Trip");
});

test("state store persists updates and active tab changes", async () => {
  const persistence = Storage.createLocalStoragePersistence(createMemoryStorage());
  const store = await State.createStore({ persistence });

  await store.updateProject((project) => {
    project.meta.name = "Updated Project";
  });
  await store.setActiveTab("designer");

  const savedProject = await persistence.loadProject();
  const savedUi = await persistence.loadUiState();

  assert.equal(savedProject.meta.name, "Updated Project");
  assert.equal(savedUi.activeTab, "designer");
});

test("state store can update without persisting until requested", async () => {
  const persistence = Storage.createMemoryPersistence();
  const store = await State.createStore({ persistence });

  await store.updateProject((project) => {
    project.meta.name = "Draft";
  }, { persist: false });
  const beforePersist = await persistence.loadProject();
  assert.equal(beforePersist.meta.name, "Untitled Project");

  await store.persistProject();
  const savedProject = await persistence.loadProject();
  assert.equal(savedProject.meta.name, "Draft");
});

test("state store reports browser storage save failures", async () => {
  const store = await State.createStore({ persistence: createFailingPersistence() });

  await store.replaceProject(Schema.createDefaultProject());
  const state = store.getState();

  assert.equal(state.autosaveStatus, "Error");
  assert.match(state.autosaveErrorMessage, /could not be saved to browser storage/i);
  assert.equal(state.lastSavedAt, null);
});

test("loadUiState provides the active UI defaults", async () => {
  const persistence = Storage.createLocalStoragePersistence(createMemoryStorage());
  const uiState = await persistence.loadUiState();

  assert.deepEqual(uiState, {
    activeTab: "designer",
    showHelp: false,
    editingColorSequenceId: null,
    selectedColorSequenceId: null,
    selectedTokenId: null,
    selectedComponentType: null,
    selectedComponentId: null,
    selectedPrintPreviewPage: 0,
    printPanels: {
      settings: false,
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

test("estimateDataUrlBytes reports base64 payload size", () => {
  assert.equal(Utils.estimateDataUrlBytes(makeDataUrl("image/png", 512)), 512);
});

test("findOpaqueBounds returns the tight alpha bounds", () => {
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  pixels[(1 * 4 + 1) * 4 + 3] = 255;
  pixels[(2 * 4 + 2) * 4 + 3] = 255;

  assert.deepEqual(Utils.findOpaqueBounds(pixels, 4, 4), {
    x: 1,
    y: 1,
    width: 2,
    height: 2
  });
  assert.equal(Utils.findOpaqueBounds(new Uint8ClampedArray(4 * 4 * 4), 4, 4), null);
});

test("findOpaqueBounds respects the alpha threshold", () => {
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  pixels[(1 * 4 + 0) * 4 + 3] = 1;
  pixels[(1 * 4 + 1) * 4 + 3] = 255;

  assert.deepEqual(Utils.findOpaqueBounds(pixels, 4, 4, 1), {
    x: 0,
    y: 1,
    width: 2,
    height: 1
  });
  assert.deepEqual(Utils.findOpaqueBounds(pixels, 4, 4, 2), {
    x: 1,
    y: 1,
    width: 1,
    height: 1
  });
});

test("trimTransparentImageAssetSource crops transparent borders before optimization", async () => {
  const source = makeDataUrl("image/png", 1024);
  const draws = [];

  function makeContext(canvas) {
    return {
      clearRect() {},
      drawImage() {
        draws.push({
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          args: Array.from(arguments).slice(1)
        });
      },
      getImageData() {
        const pixels = new Uint8ClampedArray(4 * 4 * 4);
        pixels[(1 * 4 + 1) * 4 + 3] = 255;
        pixels[(1 * 4 + 2) * 4 + 3] = 255;
        pixels[(2 * 4 + 1) * 4 + 3] = 255;
        pixels[(2 * 4 + 2) * 4 + 3] = 255;
        return { data: pixels };
      }
    };
  }

  const result = await Utils.trimTransparentImageAssetSource(source, {
    dimensions: { width: 4, height: 4 },
    loadImage: async () => ({ src: source }),
    createCanvas: (width, height) => ({
      width,
      height,
      getContext() {
        return makeContext({ width, height });
      }
    }),
    encodeCanvas: (canvas, mimeType) => makeDataUrl(mimeType, canvas.width * canvas.height * 16)
  });

  assert.equal(result.width, 2);
  assert.equal(result.height, 2);
  assert.equal(result.source.startsWith("data:image/webp;base64,"), true);
  assert.deepEqual(draws[1], {
    canvasWidth: 2,
    canvasHeight: 2,
    args: [1, 1, 2, 2, 0, 0, 2, 2]
  });
});

test("trimTransparentImageAssetSource falls back when trimming cannot encode", async () => {
  const source = makeDataUrl("image/png", 1024);

  const result = await Utils.trimTransparentImageAssetSource(source, {
    dimensions: { width: 4, height: 4 },
    loadImage: async () => ({ src: source }),
    createCanvas: (width, height) => ({
      width,
      height,
      getContext() {
        return {
          clearRect() {},
          drawImage() {},
          getImageData() {
            const pixels = new Uint8ClampedArray(4 * 4 * 4);
            pixels[(1 * 4 + 1) * 4 + 3] = 255;
            return { data: pixels };
          }
        };
      }
    }),
    encodeCanvas: () => ""
  });

  assert.equal(result.source, source);
  assert.equal(result.width, 4);
  assert.equal(result.height, 4);
});

test("trimTransparentImageAssetSource ignores faint halo pixels below the configured threshold", async () => {
  const source = makeDataUrl("image/png", 1024);

  const result = await Utils.trimTransparentImageAssetSource(source, {
    dimensions: { width: 4, height: 4 },
    trimAlphaThreshold: 2,
    loadImage: async () => ({ src: source }),
    createCanvas: (width, height) => ({
      width,
      height,
      getContext() {
        return {
          clearRect() {},
          drawImage() {},
          getImageData() {
            const pixels = new Uint8ClampedArray(4 * 4 * 4);
            pixels[(1 * 4 + 0) * 4 + 3] = 1;
            pixels[(1 * 4 + 1) * 4 + 3] = 255;
            return { data: pixels };
          }
        };
      }
    }),
    encodeCanvas: (canvas, mimeType) => makeDataUrl(mimeType, canvas.width * canvas.height * 16)
  });

  assert.equal(result.width, 1);
  assert.equal(result.height, 1);
});

test("normalizeProjectImageAssets updates imported token images and backgrounds", async () => {
  const project = {
    settings: {
      tokenDefaults: {
        backgroundImageSource: "data:image/png;base64,defaults"
      }
    },
    tokens: [
      {
        id: "token_1",
        front: {
          backgroundImageSource: "data:image/png;base64,background",
          images: [
            {
              id: "image_1",
              source: "data:image/png;base64,component",
              aspectRatio: 1
            },
            {
              id: "image_2",
              source: "https://example.com/external.png",
              aspectRatio: 1
            }
          ]
        }
      }
    ]
  };

  const seenSources = [];
  const normalized = await Utils.normalizeProjectImageAssets(project, {
    normalizeImageAssetSource: async (source) => {
      seenSources.push(source);
      if (source.indexOf("component") >= 0) {
        return { source: "data:image/webp;base64,trimmed", width: 80, height: 200 };
      }
      return { source: source + "-optimized", width: 300, height: 150 };
    }
  });

  assert.notStrictEqual(normalized, project);
  assert.equal(project.settings.tokenDefaults.backgroundImageSource, "data:image/png;base64,defaults");
  assert.deepEqual(seenSources, [
    "data:image/png;base64,defaults",
    "data:image/png;base64,background",
    "data:image/png;base64,component"
  ]);
  assert.equal(normalized.settings.tokenDefaults.backgroundImageSource, "data:image/png;base64,defaults-optimized");
  assert.equal(normalized.tokens[0].front.backgroundImageSource, "data:image/png;base64,background-optimized");
  assert.equal(normalized.tokens[0].front.images[0].source, "data:image/webp;base64,trimmed");
  assert.equal(normalized.tokens[0].front.images[0].aspectRatio, 0.4);
  assert.equal(normalized.tokens[0].front.images[1].source, "https://example.com/external.png");
});

test("optimizeImageAssetSource leaves small images unchanged", async () => {
  const source = makeDataUrl("image/png", 768);
  let loadCount = 0;

  const result = await Utils.optimizeImageAssetSource(source, {
    maxBytes: 1024,
    dimensions: { width: 400, height: 200 },
    loadImage: async () => {
      loadCount += 1;
      return {};
    }
  });

  assert.equal(result.source, source);
  assert.equal(result.width, 400);
  assert.equal(result.height, 200);
  assert.equal(loadCount, 0);
});

test("optimizeImageAssetSource uses jpeg for opaque oversized images", async () => {
  const source = makeDataUrl("image/png", 2048);
  const encodedCalls = [];

  const result = await Utils.optimizeImageAssetSource(source, {
    maxBytes: 1024,
    dimensions: { width: 3000, height: 1500 },
    loadImage: async () => ({ src: source }),
    detectTransparency: async () => false,
    createCanvas: (width, height) => ({
      width,
      height,
      getContext() {
        return {
          clearRect() {},
          drawImage() {}
        };
      }
    }),
    encodeCanvas: (canvas, mimeType, quality) => {
      encodedCalls.push({ width: canvas.width, height: canvas.height, mimeType, quality });
      return makeDataUrl(mimeType, 900);
    }
  });

  assert.equal(result.source.startsWith("data:image/jpeg;base64,"), true);
  assert.equal(result.width, 2048);
  assert.equal(result.height, 1024);
  assert.deepEqual(encodedCalls[0], {
    width: 2048,
    height: 1024,
    mimeType: "image/jpeg",
    quality: 0.9
  });
});

test("optimizeImageAssetSource falls back to png when transparent webp encoding is unavailable", async () => {
  const source = makeDataUrl("image/png", 4096);

  const result = await Utils.optimizeImageAssetSource(source, {
    maxBytes: 1024,
    dimensions: { width: 1200, height: 1200 },
    loadImage: async () => ({ src: source }),
    detectTransparency: async () => true,
    createCanvas: (width, height) => ({
      width,
      height,
      getContext() {
        return {
          clearRect() {},
          drawImage() {}
        };
      }
    }),
    encodeCanvas: (canvas, mimeType) => {
      if (mimeType === "image/webp") {
        return "";
      }
      return makeDataUrl("image/png", 900);
    }
  });

  assert.equal(result.source.startsWith("data:image/png;base64,"), true);
  assert.equal(result.width, 1200);
  assert.equal(result.height, 1200);
});

test("optimizeImageAssetSource falls back to the original image when optimization fails", async () => {
  const source = makeDataUrl("image/png", 2048);

  const result = await Utils.optimizeImageAssetSource(source, {
    maxBytes: 1024,
    dimensions: { width: 800, height: 600 },
    loadImage: async () => {
      throw new Error("boom");
    }
  });

  assert.equal(result.source, source);
  assert.equal(result.width, 800);
  assert.equal(result.height, 600);
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
  assert.equal(component.contentMode, "numeric");
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
      backgroundMode: "image",
      backgroundImageSource: "data:image/png;base64,bg",
      images: [Tokens.createImageComponent({ name: "Goblin Art", source: "data:image/png;base64,abc" })],
      texts: [Tokens.createTextComponent({ name: "Label", customText: "Goblin" })]
    }
  });

  const clone = Tokens.cloneTokenTemplate(token);

  assert.equal(clone.name, "Goblin Copy");
  assert.notEqual(clone.id, token.id);
  assert.notEqual(clone.front.images[0].id, token.front.images[0].id);
  assert.notEqual(clone.front.texts[0].id, token.front.texts[0].id);
  assert.equal(clone.front.backgroundMode, "image");
  assert.equal(clone.front.backgroundImageSource, token.front.backgroundImageSource);
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

test("print layout sorts token groups alphabetically by token name", () => {
  const project = Schema.createDefaultProject();
  const zulu = Tokens.createTokenTemplate({ id: "token-z", name: "Zulu" });
  const alpha = Tokens.createTokenTemplate({ id: "token-a", name: "Alpha" });
  const mint2 = Tokens.createTokenTemplate({ id: "token-m2", name: "Mint 2" });

  project.tokens.push(zulu, alpha, mint2);
  project.printSelections = [
    { tokenId: "token-z", copies: 1, sequenceStart: 0 },
    { tokenId: "token-m2", copies: 1, sequenceStart: 0 },
    { tokenId: "token-a", copies: 1, sequenceStart: 0 }
  ];

  const layout = Print.layoutProject(project);

  assert.deepEqual(layout.pages[0].items.map((item) => item.token.name), [
    "Alpha",
    "Mint 2",
    "Zulu"
  ]);
});

test("print layout backfills smaller tokens beneath taller neighbors", () => {
  const project = Schema.createDefaultProject();
  project.settings.bleedIn = 0;
  const large = Tokens.createTokenTemplate({ id: "token-large", name: "Large", diameterIn: 2 });
  const small = Tokens.createTokenTemplate({ id: "token-small", name: "Small", diameterIn: 1 });

  project.tokens.push(large, small);
  project.printSelections = [
    { tokenId: "token-large", copies: 2, sequenceStart: 0 },
    { tokenId: "token-small", copies: 7, sequenceStart: 0 }
  ];

  const layout = Print.layoutProject(project);
  const smallItems = layout.pages[0].items.filter((item) => item.tokenId === "token-small");

  assert.equal(smallItems.length, 7);
  assert.equal(smallItems[0].cellXIn, 4.25);
  assert.equal(smallItems[0].cellYIn, 0.25);
  assert.equal(smallItems[4].cellXIn, 4.25);
  assert.equal(smallItems[4].cellYIn, 1.25);
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
