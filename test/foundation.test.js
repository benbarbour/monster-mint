const test = require("node:test");
const assert = require("node:assert/strict");

const Schema = require("../src/js/00-schema.js");
const Storage = require("../src/js/10-storage.js");
const State = require("../src/js/20-state.js");

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
  assert.deepEqual(project.sequences, { text: [], color: [] });
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
