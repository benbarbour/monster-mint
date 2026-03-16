(function (global, factory) {
  var api = factory(global.MonsterMintSchema, global.MonsterMintStorage);
  global.MonsterMintState = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function (Schema, Storage) {
  function createStore(options) {
    var storage = options && options.storage ? options.storage : null;
    var listeners = [];
    var state = {
      project: Storage.loadProject(storage),
      ui: Storage.loadUiState(storage),
      autosaveStatus: "Loaded",
      lastSavedAt: null,
      autosaveErrorMessage: null
    };

    function emit() {
      listeners.forEach(function (listener) {
        listener(state);
      });
    }

    function save() {
      state.project.meta.updatedAt = new Date().toISOString();
      var projectSaved = Storage.saveProject(storage, state.project);
      var uiSaved = Storage.saveUiState(storage, state.ui);
      if (projectSaved && uiSaved) {
        state.autosaveStatus = "Saved";
        state.lastSavedAt = state.project.meta.updatedAt;
        state.autosaveErrorMessage = null;
        return true;
      }

      state.autosaveStatus = "Error";
      state.autosaveErrorMessage = "Changes could not be saved to browser storage. Export your project to avoid losing work.";
      return false;
    }

    function saveUiOnly() {
      if (Storage.saveUiState(storage, state.ui)) {
        if (state.autosaveStatus !== "Error") {
          state.autosaveErrorMessage = null;
        }
        return true;
      }

      state.autosaveStatus = "Error";
      state.autosaveErrorMessage = "Changes could not be saved to browser storage. Export your project to avoid losing work.";
      return false;
    }

    function updateProject(mutator, options) {
      var shouldPersist = !options || options.persist !== false;
      var nextProject = Schema.clone(state.project);
      mutator(nextProject);
      state.project = Schema.normalizeProject(nextProject);
      if (shouldPersist) {
        save();
      } else {
        state.autosaveStatus = "Editing";
        state.autosaveErrorMessage = null;
      }
      emit();
    }

    function replaceProject(project, options) {
      var shouldPersist = !options || options.persist !== false;
      state.project = Schema.normalizeProject(project);
      if (shouldPersist) {
        save();
      }
      emit();
    }

    function setActiveTab(activeTab) {
      state.ui.activeTab = activeTab;
      saveUiOnly();
      emit();
    }

    function updateUi(mutator) {
      var nextUi = Schema.clone(state.ui);
      mutator(nextUi);
      state.ui = Object.assign(Storage.defaultUiState(), nextUi);
      saveUiOnly();
      emit();
    }

    function persistProject() {
      save();
      emit();
    }

    return {
      getState: function () {
        return state;
      },
      subscribe: function (listener) {
        listeners.push(listener);
        return function unsubscribe() {
          listeners = listeners.filter(function (candidate) {
            return candidate !== listener;
          });
        };
      },
      updateProject: updateProject,
      replaceProject: replaceProject,
      setActiveTab: setActiveTab,
      updateUi: updateUi,
      persistProject: persistProject
    };
  }

  return {
    createStore: createStore
  };
});
