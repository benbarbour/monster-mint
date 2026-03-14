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
      lastSavedAt: null
    };

    function emit() {
      listeners.forEach(function (listener) {
        listener(state);
      });
    }

    function save() {
      state.project.meta.updatedAt = new Date().toISOString();
      Storage.saveProject(storage, state.project);
      Storage.saveUiState(storage, state.ui);
      state.autosaveStatus = "Saved";
      state.lastSavedAt = state.project.meta.updatedAt;
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
      Storage.saveUiState(storage, state.ui);
      emit();
    }

    function updateUi(mutator) {
      var nextUi = Schema.clone(state.ui);
      mutator(nextUi);
      state.ui = Object.assign(Storage.defaultUiState(), nextUi);
      Storage.saveUiState(storage, state.ui);
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
