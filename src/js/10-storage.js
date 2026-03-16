(function (global, factory) {
  var api = factory(global.MonsterMintSchema);
  global.MonsterMintStorage = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function (Schema) {
  var DB_NAME = "monster-mint.db.v1";
  var DB_VERSION = 1;
  var STORE_NAME = "app";
  var PROJECT_RECORD_KEY = "project";
  var UI_RECORD_KEY = "ui";

  function createBrowserPersistence(options) {
    var indexedDb = options && options.indexedDB ? options.indexedDB : null;
    var fallbackStorage = options && options.storage ? options.storage : null;
    if (indexedDb && typeof indexedDb.open === "function") {
      return createIndexedDbPersistence(indexedDb, fallbackStorage);
    }
    return createLocalStoragePersistence(fallbackStorage);
  }

  function createIndexedDbPersistence(indexedDb, fallbackStorage) {
    var dbPromise = openDatabase(indexedDb);
    var migrationPromise = null;

    async function ensureMigrated() {
      if (!migrationPromise) {
        migrationPromise = migrateLegacyLocalStorage(dbPromise, fallbackStorage);
      }
      return migrationPromise;
    }

    return {
      loadProject: async function () {
        await ensureMigrated();
        try {
          var record = await getRecord(await dbPromise, PROJECT_RECORD_KEY);
          return record ? Schema.normalizeProject(record) : Schema.createDefaultProject();
        } catch (error) {
          console.warn("Failed to load saved project", error);
          return Schema.createDefaultProject();
        }
      },
      saveProject: async function (project) {
        try {
          await putRecord(await dbPromise, PROJECT_RECORD_KEY, Schema.clone(project));
          return true;
        } catch (error) {
          console.warn("Failed to save project", error);
          return false;
        }
      },
      loadUiState: async function () {
        await ensureMigrated();
        try {
          var record = await getRecord(await dbPromise, UI_RECORD_KEY);
          return normalizeUiState(record);
        } catch (error) {
          console.warn("Failed to load UI state", error);
          return defaultUiState();
        }
      },
      saveUiState: async function (uiState) {
        try {
          await putRecord(await dbPromise, UI_RECORD_KEY, normalizeUiState(uiState));
          return true;
        } catch (error) {
          console.warn("Failed to save UI state", error);
          return false;
        }
      }
    };
  }

  function createLocalStoragePersistence(storage) {
    return {
      loadProject: async function () {
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
      },
      saveProject: async function (project) {
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
      },
      loadUiState: async function () {
        if (!storage) {
          return defaultUiState();
        }

        try {
          return normalizeUiState(JSON.parse(storage.getItem(Schema.UI_STORAGE_KEY) || "null"));
        } catch (error) {
          console.warn("Failed to load UI state", error);
          return defaultUiState();
        }
      },
      saveUiState: async function (uiState) {
        if (!storage) {
          return false;
        }

        try {
          storage.setItem(Schema.UI_STORAGE_KEY, JSON.stringify(normalizeUiState(uiState)));
          return true;
        } catch (error) {
          console.warn("Failed to save UI state", error);
          return false;
        }
      }
    };
  }

  function createMemoryPersistence(seed) {
    var state = seed && typeof seed === "object" ? seed : {};
    return {
      loadProject: async function () {
        return Schema.normalizeProject(state.project || Schema.createDefaultProject());
      },
      saveProject: async function (project) {
        state.project = Schema.clone(project);
        return true;
      },
      loadUiState: async function () {
        return normalizeUiState(state.ui);
      },
      saveUiState: async function (uiState) {
        state.ui = normalizeUiState(uiState);
        return true;
      }
    };
  }

  function defaultUiState() {
    return {
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
    };
  }

  function normalizeUiState(value) {
    var parsed = value && typeof value === "object" ? value : {};
    return {
      activeTab: typeof parsed.activeTab === "string" ? parsed.activeTab : "designer",
      showHelp: parsed.showHelp === true,
      editingColorSequenceId: typeof parsed.editingColorSequenceId === "string" ? parsed.editingColorSequenceId : null,
      selectedColorSequenceId: typeof parsed.selectedColorSequenceId === "string" ? parsed.selectedColorSequenceId : null,
      selectedTokenId: typeof parsed.selectedTokenId === "string" ? parsed.selectedTokenId : null,
      selectedComponentType: typeof parsed.selectedComponentType === "string" ? parsed.selectedComponentType : null,
      selectedComponentId: typeof parsed.selectedComponentId === "string" ? parsed.selectedComponentId : null,
      selectedPrintPreviewPage: Number.isFinite(parsed.selectedPrintPreviewPage) ? Math.max(0, parsed.selectedPrintPreviewPage) : 0,
      printPanels: normalizePrintPanels(parsed.printPanels)
    };
  }

  function normalizePrintPanels(value) {
    var panels = value && typeof value === "object" ? value : {};
    return {
      settings: panels.settings === true,
      selections: panels.selections !== false,
      preview: panels.preview !== false
    };
  }

  function openDatabase(indexedDb) {
    return new Promise(function (resolve, reject) {
      var request = indexedDb.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        var database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = function () {
        var database = request.result;
        database.onversionchange = function () {
          database.close();
        };
        resolve(database);
      };
      request.onerror = function () {
        reject(request.error || new Error("Failed to open IndexedDB."));
      };
    });
  }

  function getRecord(database, key) {
    return new Promise(function (resolve, reject) {
      var transaction = database.transaction(STORE_NAME, "readonly");
      var store = transaction.objectStore(STORE_NAME);
      var request = store.get(key);
      request.onsuccess = function () {
        resolve(request.result || null);
      };
      request.onerror = function () {
        reject(request.error || transaction.error || new Error("Failed to read IndexedDB record."));
      };
    });
  }

  function putRecord(database, key, value) {
    return new Promise(function (resolve, reject) {
      var transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.oncomplete = function () {
        resolve(true);
      };
      transaction.onerror = function () {
        reject(transaction.error || new Error("Failed to write IndexedDB record."));
      };
      transaction.onabort = function () {
        reject(transaction.error || new Error("IndexedDB write was aborted."));
      };
      transaction.objectStore(STORE_NAME).put(value, key);
    });
  }

  async function migrateLegacyLocalStorage(dbPromise, fallbackStorage) {
    if (!fallbackStorage) {
      return;
    }

    try {
      var projectRaw = fallbackStorage.getItem(Schema.STORAGE_KEY);
      var uiRaw = fallbackStorage.getItem(Schema.UI_STORAGE_KEY);
      if (!projectRaw && !uiRaw) {
        return;
      }

      var database = await dbPromise;
      var existingProject = await getRecord(database, PROJECT_RECORD_KEY);
      var existingUi = await getRecord(database, UI_RECORD_KEY);
      if (existingProject || existingUi) {
        return;
      }

      if (projectRaw) {
        await putRecord(database, PROJECT_RECORD_KEY, Schema.normalizeProject(JSON.parse(projectRaw)));
      }
      if (uiRaw) {
        await putRecord(database, UI_RECORD_KEY, normalizeUiState(JSON.parse(uiRaw)));
      }
    } catch (error) {
      console.warn("Failed to migrate localStorage data into IndexedDB", error);
    }
  }

  return {
    DB_NAME: DB_NAME,
    defaultUiState: defaultUiState,
    normalizeUiState: normalizeUiState,
    createBrowserPersistence: createBrowserPersistence,
    createIndexedDbPersistence: createIndexedDbPersistence,
    createLocalStoragePersistence: createLocalStoragePersistence,
    createMemoryPersistence: createMemoryPersistence
  };
});
