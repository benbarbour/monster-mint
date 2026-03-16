(function (global, factory) {
  var api = factory(global.MonsterMintSchema, global.MonsterMintStorage);
  global.MonsterMintState = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function (Schema, Storage) {
  async function createStore(options) {
    var persistence = resolvePersistence(options);
    var listeners = [];
    var saveQueue = Promise.resolve();
    var saveRevision = 0;
    var state = {
      project: await persistence.loadProject(),
      ui: await persistence.loadUiState(),
      autosaveStatus: "Loaded",
      lastSavedAt: null,
      autosaveErrorMessage: null
    };

    function emit() {
      listeners.forEach(function (listener) {
        listener(state);
      });
    }

    function setSaveError() {
      state.autosaveStatus = "Error";
      state.autosaveErrorMessage = "Changes could not be saved to browser storage. Export your project to avoid losing work.";
    }

    function enqueuePersistence(task) {
      saveQueue = saveQueue.then(task, task);
      return saveQueue;
    }

    function save() {
      state.project.meta.updatedAt = new Date().toISOString();
      var revision = ++saveRevision;
      var updatedAt = state.project.meta.updatedAt;
      var projectSnapshot = Schema.clone(state.project);
      var uiSnapshot = Schema.clone(state.ui);

      state.autosaveStatus = "Saving";
      state.autosaveErrorMessage = null;
      emit();

      return enqueuePersistence(async function () {
        var projectSaved = await persistence.saveProject(projectSnapshot);
        var uiSaved = await persistence.saveUiState(uiSnapshot);
        if (revision !== saveRevision) {
          return projectSaved && uiSaved;
        }

        if (projectSaved && uiSaved) {
          state.autosaveStatus = "Saved";
          state.lastSavedAt = updatedAt;
          state.autosaveErrorMessage = null;
        } else {
          setSaveError();
        }
        emit();
        return projectSaved && uiSaved;
      });
    }

    function saveUiOnly() {
      var revision = ++saveRevision;
      var uiSnapshot = Schema.clone(state.ui);
      return enqueuePersistence(async function () {
        var uiSaved = await persistence.saveUiState(uiSnapshot);
        if (revision !== saveRevision) {
          return uiSaved;
        }

        if (!uiSaved) {
          setSaveError();
          emit();
        }
        return uiSaved;
      });
    }

    function updateProject(mutator, options) {
      var shouldPersist = !options || options.persist !== false;
      var nextProject = Schema.clone(state.project);
      mutator(nextProject);
      state.project = Schema.normalizeProject(nextProject);
      if (shouldPersist) {
        return save();
      }

      state.autosaveStatus = "Editing";
      state.autosaveErrorMessage = null;
      emit();
      return Promise.resolve(true);
    }

    function replaceProject(project, options) {
      var shouldPersist = !options || options.persist !== false;
      state.project = Schema.normalizeProject(project);
      if (shouldPersist) {
        return save();
      }

      emit();
      return Promise.resolve(true);
    }

    function setActiveTab(activeTab) {
      state.ui.activeTab = activeTab;
      emit();
      return saveUiOnly();
    }

    function updateUi(mutator) {
      var nextUi = Schema.clone(state.ui);
      mutator(nextUi);
      state.ui = Object.assign(Storage.defaultUiState(), nextUi);
      emit();
      return saveUiOnly();
    }

    function persistProject() {
      return save();
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

  function resolvePersistence(options) {
    if (options && options.persistence) {
      return options.persistence;
    }
    if (options && options.storage) {
      return Storage.createLocalStoragePersistence(options.storage);
    }
    return Storage.createMemoryPersistence();
  }

  return {
    createStore: createStore
  };
});
