(function (global, factory) {
  var api = factory();
  global.MonsterMintSchema = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  var STORAGE_KEY = "monster-mint.project.v1";
  var UI_STORAGE_KEY = "monster-mint.ui.v1";
  var PROJECT_VERSION = 1;
  var PAGE_PRESETS = [
    { id: "letter", label: "US Letter", widthIn: 8.5, heightIn: 11 },
    { id: "a4", label: "A4", widthIn: 8.27, heightIn: 11.69 }
  ];
  var TOKEN_SIZES = [0.5, 1, 2, 3, 4, 5];

  function timestamp() {
    return new Date().toISOString();
  }

  function createDefaultProject() {
    return {
      version: PROJECT_VERSION,
      meta: {
        name: "Untitled Project",
        updatedAt: timestamp()
      },
      settings: {
        pagePresetId: "letter",
        pageOrientation: "portrait",
        pageMarginIn: 0.25,
        bleedIn: 0.0625,
        guideStyle: "cut-and-punch"
      },
      sequences: {
        text: [],
        color: []
      },
      tokens: [],
      printSelections: []
    };
  }

  function normalizeProject(inputProject) {
    var project = inputProject && typeof inputProject === "object" ? inputProject : {};
    var defaults = createDefaultProject();
    var tokenApi = typeof globalThis !== "undefined" && globalThis.MonsterMintTokens
      ? globalThis.MonsterMintTokens
      : { normalizeToken: function (token) { return token; } };
    return {
      version: PROJECT_VERSION,
      meta: {
        name: typeof project.meta?.name === "string" && project.meta.name.trim() ? project.meta.name : defaults.meta.name,
        updatedAt: typeof project.meta?.updatedAt === "string" ? project.meta.updatedAt : timestamp()
      },
      settings: {
        pagePresetId: findPagePreset(project.settings?.pagePresetId) ? project.settings.pagePresetId : defaults.settings.pagePresetId,
        pageOrientation: project.settings?.pageOrientation === "landscape" ? "landscape" : "portrait",
        pageMarginIn: asPositiveNumber(project.settings?.pageMarginIn, defaults.settings.pageMarginIn),
        bleedIn: asPositiveNumber(project.settings?.bleedIn, defaults.settings.bleedIn),
        guideStyle: typeof project.settings?.guideStyle === "string" ? project.settings.guideStyle : defaults.settings.guideStyle
      },
      sequences: {
        text: Array.isArray(project.sequences?.text) ? project.sequences.text : [],
        color: Array.isArray(project.sequences?.color) ? project.sequences.color : []
      },
      tokens: Array.isArray(project.tokens) ? project.tokens.map(tokenApi.normalizeToken) : [],
      printSelections: Array.isArray(project.printSelections) ? project.printSelections : []
    };
  }

  function findPagePreset(pagePresetId) {
    return PAGE_PRESETS.find(function (preset) {
      return preset.id === pagePresetId;
    }) || null;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function asPositiveNumber(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    UI_STORAGE_KEY: UI_STORAGE_KEY,
    PROJECT_VERSION: PROJECT_VERSION,
    PAGE_PRESETS: PAGE_PRESETS,
    TOKEN_SIZES: TOKEN_SIZES,
    clone: clone,
    createDefaultProject: createDefaultProject,
    normalizeProject: normalizeProject,
    findPagePreset: findPagePreset
  };
});
