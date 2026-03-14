(function (global, factory) {
  var api = factory(global.MonsterMintSchema);
  global.MonsterMintStorage = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function (Schema) {
  function loadProject(storage) {
    if (!storage) {
      return Schema.createDefaultProject();
    }

    try {
      var raw = storage.getItem(Schema.STORAGE_KEY);
      if (!raw) {
        return Schema.createDefaultProject();
      }

      return Schema.normalizeProject(JSON.parse(raw));
    } catch (error) {
      console.warn("Failed to load saved project", error);
      return Schema.createDefaultProject();
    }
  }

  function saveProject(storage, project) {
    if (!storage) {
      return false;
    }

    try {
      storage.setItem(Schema.STORAGE_KEY, JSON.stringify(project));
      return true;
    } catch (error) {
      console.warn("Failed to save project", error);
      return false;
    }
  }

  function loadUiState(storage) {
    if (!storage) {
      return { activeTab: "settings" };
    }

    try {
      var raw = storage.getItem(Schema.UI_STORAGE_KEY);
      if (!raw) {
        return { activeTab: "settings" };
      }

      var parsed = JSON.parse(raw);
      return {
        activeTab: typeof parsed.activeTab === "string" ? parsed.activeTab : "settings"
      };
    } catch (error) {
      console.warn("Failed to load UI state", error);
      return { activeTab: "settings" };
    }
  }

  function saveUiState(storage, uiState) {
    if (!storage) {
      return false;
    }

    try {
      storage.setItem(Schema.UI_STORAGE_KEY, JSON.stringify(uiState));
      return true;
    } catch (error) {
      console.warn("Failed to save UI state", error);
      return false;
    }
  }

  return {
    loadProject: loadProject,
    saveProject: saveProject,
    loadUiState: loadUiState,
    saveUiState: saveUiState
  };
});

