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
      return defaultUiState();
    }

    try {
      var raw = storage.getItem(Schema.UI_STORAGE_KEY);
      if (!raw) {
        return defaultUiState();
      }

      var parsed = JSON.parse(raw);
      return {
        activeTab: typeof parsed.activeTab === "string" ? parsed.activeTab : "designer",
        editingTextSequenceId: typeof parsed.editingTextSequenceId === "string" ? parsed.editingTextSequenceId : null,
        editingColorSequenceId: typeof parsed.editingColorSequenceId === "string" ? parsed.editingColorSequenceId : null,
        selectedTextSequenceId: typeof parsed.selectedTextSequenceId === "string" ? parsed.selectedTextSequenceId : null,
        selectedColorSequenceId: typeof parsed.selectedColorSequenceId === "string" ? parsed.selectedColorSequenceId : null,
        selectedTokenId: typeof parsed.selectedTokenId === "string" ? parsed.selectedTokenId : null,
        selectedComponentType: typeof parsed.selectedComponentType === "string" ? parsed.selectedComponentType : null,
        selectedComponentId: typeof parsed.selectedComponentId === "string" ? parsed.selectedComponentId : null,
        selectedFace: parsed.selectedFace === "back" ? "back" : "front",
        selectedPrintPreviewPage: Number.isFinite(parsed.selectedPrintPreviewPage) ? Math.max(0, parsed.selectedPrintPreviewPage) : 0,
        printPanels: normalizePrintPanels(parsed.printPanels)
      };
    } catch (error) {
      console.warn("Failed to load UI state", error);
      return defaultUiState();
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

  function defaultUiState() {
    return {
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
    };
  }

  function normalizePrintPanels(value) {
    var panels = value && typeof value === "object" ? value : {};
    return {
      settings: panels.settings !== false,
      selections: panels.selections !== false,
      preview: panels.preview !== false
    };
  }

  return {
    defaultUiState: defaultUiState,
    loadProject: loadProject,
    saveProject: saveProject,
    loadUiState: loadUiState,
    saveUiState: saveUiState
  };
});
