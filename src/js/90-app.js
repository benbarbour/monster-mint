(function (global, factory) {
  var api = factory(global.MonsterMintSchema, global.MonsterMintState, global.MonsterMintSequences, global.MonsterMintUtils);
  global.MonsterMintApp = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (Schema, State, Sequences, Utils) {
  var TAB_CONFIG = [
    { id: "settings", label: "Settings" },
    { id: "designer", label: "Designer" },
    { id: "print", label: "Print" }
  ];

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;");
  }

  function render(appElement, store) {
    var state = store.getState();
    var activeTab = state.ui.activeTab;

    appElement.innerHTML = [
      '<main class="app-shell">',
      '  <header class="app-header">',
      '    <div>',
      '      <h1 class="app-title">Monster Mint</h1>',
      '      <p class="app-subtitle">Design printable tabletop token sheets in one self-contained browser app.</p>',
      "    </div>",
      '    <div class="project-meta">',
      '      <label>Project name<input class="project-name-input" name="project-name" value="' + escapeHtml(state.project.meta.name) + '"></label>',
      '      <span class="status-pill">' + escapeHtml(state.autosaveStatus) + "</span>",
      '      <button class="button" type="button" data-action="reset-project">Reset Project</button>',
      "    </div>",
      "  </header>",
      '  <nav class="tabs" aria-label="Main tabs">',
      TAB_CONFIG.map(function (tab) {
        return '<button class="tab-button' + (tab.id === activeTab ? " is-active" : "") + '" type="button" data-tab="' + tab.id + '">' + tab.label + "</button>";
      }).join(""),
      "  </nav>",
      renderPanel("settings", activeTab, renderSettingsPanel(state)),
      renderPanel("designer", activeTab, renderDesignerPanel(state)),
      renderPanel("print", activeTab, renderPrintPanel(state)),
      "</main>"
    ].join("");

    attachEvents(appElement, store);
  }

  function renderPanel(tabId, activeTab, content) {
    return '<section class="tab-panel' + (tabId === activeTab ? " is-active" : "") + '" data-panel="' + tabId + '">' + content + "</section>";
  }

  function renderSettingsPanel(state) {
    var editingTextSequence = state.project.sequences.text.find(function (sequence) {
      return sequence.id === state.ui.editingTextSequenceId;
    }) || null;
    var editingColorSequence = state.project.sequences.color.find(function (sequence) {
      return sequence.id === state.ui.editingColorSequenceId;
    }) || null;
    var preset = Schema.findPagePreset(state.project.settings.pagePresetId);
    return [
      '<div class="panel-grid">',
      '  <section class="panel-card">',
      "    <h2>Page Setup</h2>",
      '    <form class="form-grid" data-form="page-settings">',
      '      <div class="field-row two-up">',
      '        <label class="field">Page size<select name="pagePresetId">' + Schema.PAGE_PRESETS.map(function (candidate) {
        return '<option value="' + candidate.id + '"' + (candidate.id === state.project.settings.pagePresetId ? " selected" : "") + ">" + candidate.label + "</option>";
      }).join("") + '</select></label>',
      '        <label class="field">Orientation<select name="pageOrientation">' +
        '<option value="portrait"' + (state.project.settings.pageOrientation === "portrait" ? " selected" : "") + '>Portrait</option>' +
        '<option value="landscape"' + (state.project.settings.pageOrientation === "landscape" ? " selected" : "") + '>Landscape</option>' +
        "</select></label>",
      "      </div>",
      '      <div class="field-row two-up">',
      '        <label class="field">Margin (in)<input type="number" min="0.05" step="0.05" name="pageMarginIn" value="' + state.project.settings.pageMarginIn + '"></label>',
      '        <label class="field">Bleed (in)<input type="number" min="0.01" step="0.01" name="bleedIn" value="' + state.project.settings.bleedIn + '"></label>',
      "      </div>",
      '      <div class="field-row"><label class="field">Guide style<select name="guideStyle">' +
        renderGuideStyleOptions(state.project.settings.guideStyle) +
        "</select></label></div>",
      '      <div class="button-row"><button class="button button-primary" type="submit">Save Page Settings</button></div>',
      "    </form>",
      '    <p class="field-help">Current page preset: ' + escapeHtml(preset ? preset.label : "Unknown") + "</p>",
      "  </section>",
      '  <section class="panel-card">',
      "    <h2>Text Sequences</h2>",
      renderTextSequenceList(state.project.sequences.text),
      renderTextSequenceForm(editingTextSequence),
      "  </section>",
      '  <section class="panel-card">',
      "    <h2>Color Sequences</h2>",
      renderColorSequenceList(state.project.sequences.color),
      renderColorSequenceForm(editingColorSequence),
      "  </section>",
      '  <section class="panel-card">',
      "    <h2>Project Transfer</h2>",
      "    <p>Export a self-contained JSON project file or import one to replace the current project.</p>",
      '    <div class="transfer-actions">',
      '      <button class="button button-primary" type="button" data-action="export-project">Export JSON</button>',
      '      <button class="button" type="button" data-action="import-project">Import JSON</button>',
      '      <input class="visually-hidden" type="file" accept="application/json,.json" data-import-input>',
      "    </div>",
      "  </section>",
      "</div>"
    ].join("");
  }

  function renderDesignerPanel(state) {
    return [
      '<div class="empty-state">',
      "  <h2>Designer foundation ready</h2>",
      "  <p>The token editor will appear here once the sequence and template layers are in place.</p>",
      "  <p>Autosave is already active. Updated: " + escapeHtml(new Date(state.project.meta.updatedAt).toLocaleString()) + "</p>",
      "</div>"
    ].join("");
  }

  function renderPrintPanel() {
    return [
      '<div class="empty-state">',
      "  <h2>Print pipeline pending</h2>",
      "  <p>Page layout, previews, and print rendering will be added after the designer is in place.</p>",
      "</div>"
    ].join("");
  }

  function attachEvents(appElement, store) {
    appElement.querySelectorAll("[data-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        store.setActiveTab(button.getAttribute("data-tab"));
      });
    });

    var nameInput = appElement.querySelector("[name='project-name']");
    if (nameInput) {
      nameInput.addEventListener("change", function () {
        store.updateProject(function (project) {
          project.meta.name = nameInput.value || "Untitled Project";
        });
      });
    }

    var resetButton = appElement.querySelector("[data-action='reset-project']");
    if (resetButton) {
      resetButton.addEventListener("click", function () {
        if (!global.confirm("Reset the current project? This clears saved tokens and sequences.")) {
          return;
        }

        store.replaceProject(Schema.createDefaultProject());
        store.updateUi(function (ui) {
          ui.editingTextSequenceId = null;
          ui.editingColorSequenceId = null;
        });
      });
    }

    bindSettingsForms(appElement, store);
    bindTransferActions(appElement, store);
  }

  function bindSettingsForms(appElement, store) {
    var pageSettingsForm = appElement.querySelector("[data-form='page-settings']");
    if (pageSettingsForm) {
      pageSettingsForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var formData = new FormData(pageSettingsForm);
        store.updateProject(function (project) {
          project.settings.pagePresetId = String(formData.get("pagePresetId"));
          project.settings.pageOrientation = String(formData.get("pageOrientation"));
          project.settings.pageMarginIn = Number(formData.get("pageMarginIn")) || project.settings.pageMarginIn;
          project.settings.bleedIn = Number(formData.get("bleedIn")) || project.settings.bleedIn;
          project.settings.guideStyle = String(formData.get("guideStyle"));
        });
      });
    }

    var textSequenceForm = appElement.querySelector("[data-form='text-sequence']");
    if (textSequenceForm) {
      var textTypeField = textSequenceForm.querySelector("[name='type']");
      var syncTextSequenceFields = function () {
        var currentType = textTypeField.value;
        textSequenceForm.querySelectorAll("[data-type-only]").forEach(function (element) {
          element.hidden = element.getAttribute("data-type-only") !== currentType;
        });
      };
      textTypeField.addEventListener("change", syncTextSequenceFields);
      syncTextSequenceFields();

      textSequenceForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var formData = new FormData(textSequenceForm);
        var sequence = Sequences.createTextSequence({
          id: formData.get("id") || null,
          name: formData.get("name"),
          type: formData.get("type"),
          start: formData.get("start"),
          step: formData.get("step"),
          prefix: formData.get("prefix"),
          suffix: formData.get("suffix"),
          padTo: formData.get("padTo"),
          customValuesText: formData.get("customValuesText")
        });

        store.updateProject(function (project) {
          var existingIndex = project.sequences.text.findIndex(function (candidate) {
            return candidate.id === sequence.id;
          });

          if (existingIndex >= 0) {
            project.sequences.text[existingIndex] = sequence;
          } else {
            project.sequences.text.push(sequence);
          }
        });
        store.updateUi(function (ui) {
          ui.editingTextSequenceId = null;
        });
      });

      var cancelTextButton = textSequenceForm.querySelector("[data-action='cancel-text-edit']");
      if (cancelTextButton) {
        cancelTextButton.addEventListener("click", function () {
          store.updateUi(function (ui) {
            ui.editingTextSequenceId = null;
          });
        });
      }
    }

    appElement.querySelectorAll("[data-action='edit-text-sequence']").forEach(function (button) {
      button.addEventListener("click", function () {
        store.updateUi(function (ui) {
          ui.editingTextSequenceId = button.getAttribute("data-sequence-id");
        });
      });
    });

    appElement.querySelectorAll("[data-action='delete-text-sequence']").forEach(function (button) {
      button.addEventListener("click", function () {
        var sequenceId = button.getAttribute("data-sequence-id");
        store.updateProject(function (project) {
          project.sequences.text = project.sequences.text.filter(function (sequence) {
            return sequence.id !== sequenceId;
          });
        });
        store.updateUi(function (ui) {
          if (ui.editingTextSequenceId === sequenceId) {
            ui.editingTextSequenceId = null;
          }
        });
      });
    });

    var colorSequenceForm = appElement.querySelector("[data-form='color-sequence']");
    if (colorSequenceForm) {
      colorSequenceForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var formData = new FormData(colorSequenceForm);
        var sequence = Sequences.createColorSequence({
          id: formData.get("id") || null,
          name: formData.get("name"),
          valuesText: formData.get("valuesText")
        });

        store.updateProject(function (project) {
          var existingIndex = project.sequences.color.findIndex(function (candidate) {
            return candidate.id === sequence.id;
          });

          if (existingIndex >= 0) {
            project.sequences.color[existingIndex] = sequence;
          } else {
            project.sequences.color.push(sequence);
          }
        });
        store.updateUi(function (ui) {
          ui.editingColorSequenceId = null;
        });
      });

      var cancelColorButton = colorSequenceForm.querySelector("[data-action='cancel-color-edit']");
      if (cancelColorButton) {
        cancelColorButton.addEventListener("click", function () {
          store.updateUi(function (ui) {
            ui.editingColorSequenceId = null;
          });
        });
      }
    }

    appElement.querySelectorAll("[data-action='edit-color-sequence']").forEach(function (button) {
      button.addEventListener("click", function () {
        store.updateUi(function (ui) {
          ui.editingColorSequenceId = button.getAttribute("data-sequence-id");
        });
      });
    });

    appElement.querySelectorAll("[data-action='delete-color-sequence']").forEach(function (button) {
      button.addEventListener("click", function () {
        var sequenceId = button.getAttribute("data-sequence-id");
        store.updateProject(function (project) {
          project.sequences.color = project.sequences.color.filter(function (sequence) {
            return sequence.id !== sequenceId;
          });
        });
        store.updateUi(function (ui) {
          if (ui.editingColorSequenceId === sequenceId) {
            ui.editingColorSequenceId = null;
          }
        });
      });
    });
  }

  function bindTransferActions(appElement, store) {
    var exportButton = appElement.querySelector("[data-action='export-project']");
    if (exportButton) {
      exportButton.addEventListener("click", function () {
        var state = store.getState();
        var safeName = state.project.meta.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "monster-mint";
        Utils.downloadTextFile(safeName + ".json", JSON.stringify(state.project, null, 2));
      });
    }

    var importButton = appElement.querySelector("[data-action='import-project']");
    var importInput = appElement.querySelector("[data-import-input]");
    if (importButton && importInput) {
      importButton.addEventListener("click", function () {
        importInput.click();
      });

      importInput.addEventListener("change", async function () {
        var file = importInput.files && importInput.files[0];
        if (!file) {
          return;
        }

        try {
          var contents = await Utils.readTextFile(file);
          var parsed = JSON.parse(contents);
          store.replaceProject(parsed);
          store.updateUi(function (ui) {
            ui.editingTextSequenceId = null;
            ui.editingColorSequenceId = null;
          });
        } catch (error) {
          global.alert("Import failed. Please choose a valid Monster Mint JSON file.");
          console.error(error);
        } finally {
          importInput.value = "";
        }
      });
    }
  }

  function renderTextSequenceList(sequences) {
    if (!sequences.length) {
      return '<div class="empty-state">No text sequences yet.</div>';
    }

    return '<div class="sequence-list">' + sequences.map(function (sequence) {
      return [
        '<article class="sequence-item">',
        '  <div class="sequence-item-header">',
        '    <div>',
        '      <h3 class="sequence-item-name">' + escapeHtml(sequence.name) + "</h3>",
        '      <p class="sequence-item-meta">' + escapeHtml(Sequences.summarizeTextSequence(sequence)) + "</p>",
        "    </div>",
        '    <div class="button-row">',
        '      <button class="button" type="button" data-action="edit-text-sequence" data-sequence-id="' + sequence.id + '">Edit</button>',
        '      <button class="button" type="button" data-action="delete-text-sequence" data-sequence-id="' + sequence.id + '">Delete</button>',
        "    </div>",
        "  </div>",
        "</article>"
      ].join("");
    }).join("") + "</div>";
  }

  function renderColorSequenceList(sequences) {
    if (!sequences.length) {
      return '<div class="empty-state">No color sequences yet.</div>';
    }

    return '<div class="sequence-list">' + sequences.map(function (sequence) {
      return [
        '<article class="sequence-item">',
        '  <div class="sequence-item-header">',
        '    <div>',
        '      <h3 class="sequence-item-name">' + escapeHtml(sequence.name) + "</h3>",
        '      <p class="sequence-item-meta">' + escapeHtml(Sequences.summarizeColorSequence(sequence)) + "</p>",
        "    </div>",
        '    <div class="button-row">',
        '      <button class="button" type="button" data-action="edit-color-sequence" data-sequence-id="' + sequence.id + '">Edit</button>',
        '      <button class="button" type="button" data-action="delete-color-sequence" data-sequence-id="' + sequence.id + '">Delete</button>',
        "    </div>",
        "  </div>",
        "</article>"
      ].join("");
    }).join("") + "</div>";
  }

  function renderTextSequenceForm(sequence) {
    var type = sequence ? sequence.type : "numeric";
    return [
      '<form class="form-grid" data-form="text-sequence">',
      '  <input type="hidden" name="id" value="' + escapeHtml(sequence ? sequence.id : "") + '">',
      '  <label class="field">Name<input name="name" value="' + escapeHtml(sequence ? sequence.name : "") + '" required></label>',
      '  <div class="field-row two-up">',
      '    <label class="field">Type<select name="type">' +
        renderTextTypeOptions(type) +
        "</select></label>",
      '    <label class="field">Pad digits<input type="number" min="0" step="1" name="padTo" value="' + escapeHtml(sequence && sequence.type === "numeric" ? sequence.padTo : 0) + '"></label>',
      "  </div>",
      '  <div class="field-row three-up" data-type-only="numeric"' + (type === "numeric" ? "" : " hidden") + '>',
      '    <label class="field">Start<input type="number" step="1" name="start" value="' + escapeHtml(sequence && sequence.type === "numeric" ? sequence.start : 1) + '"></label>',
      '    <label class="field">Step<input type="number" step="1" name="step" value="' + escapeHtml(sequence && sequence.type === "numeric" ? sequence.step : 1) + '"></label>',
      '    <label class="field">Prefix<input name="prefix" value="' + escapeHtml(sequence ? sequence.prefix : "") + '"></label>',
      "  </div>",
      '  <div class="field-row two-up">',
      '    <label class="field">Suffix<input name="suffix" value="' + escapeHtml(sequence ? sequence.suffix : "") + '"></label>',
      "  </div>",
      '  <label class="field" data-type-only="custom"' + (type === "custom" ? "" : " hidden") + '>Custom values<textarea name="customValuesText">' + escapeHtml(sequence && sequence.type === "custom" ? sequence.customValues.join("\n") : "") + '</textarea><span class="field-help">One value per line.</span></label>',
      '  <div class="button-row">',
      '    <button class="button button-primary" type="submit">' + (sequence ? "Save Text Sequence" : "Add Text Sequence") + "</button>",
      (sequence ? '    <button class="button" type="button" data-action="cancel-text-edit">Cancel</button>' : ""),
      "  </div>",
      "</form>"
    ].join("");
  }

  function renderColorSequenceForm(sequence) {
    return [
      '<form class="form-grid" data-form="color-sequence">',
      '  <input type="hidden" name="id" value="' + escapeHtml(sequence ? sequence.id : "") + '">',
      '  <label class="field">Name<input name="name" value="' + escapeHtml(sequence ? sequence.name : "") + '" required></label>',
      '  <label class="field">Color values<textarea name="valuesText" required>' + escapeHtml(sequence ? sequence.values.join("\n") : "#8a1c1c\n#3b5b92") + '</textarea><span class="field-help">One hex color per line.</span></label>',
      '  <div class="button-row">',
      '    <button class="button button-primary" type="submit">' + (sequence ? "Save Color Sequence" : "Add Color Sequence") + "</button>",
      (sequence ? '    <button class="button" type="button" data-action="cancel-color-edit">Cancel</button>' : ""),
      "  </div>",
      "</form>"
    ].join("");
  }

  function renderGuideStyleOptions(currentValue) {
    return ["none", "cut", "punch", "cut-and-punch"].map(function (value) {
      var label = value === "cut-and-punch" ? "Cut and punch" : value.charAt(0).toUpperCase() + value.slice(1);
      return '<option value="' + value + '"' + (currentValue === value ? " selected" : "") + ">" + label + "</option>";
    }).join("");
  }

  function renderTextTypeOptions(currentValue) {
    return [
      { id: "numeric", label: "Numeric" },
      { id: "alphabetic", label: "Alphabetic" },
      { id: "custom", label: "Custom" }
    ].map(function (option) {
      return '<option value="' + option.id + '"' + (currentValue === option.id ? " selected" : "") + ">" + option.label + "</option>";
    }).join("");
  }

  function mount() {
    var appElement = document.getElementById("app");
    var store = State.createStore({ storage: global.localStorage });
    store.subscribe(function () {
      render(appElement, store);
    });
    render(appElement, store);
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", mount);
  }

  return {
    mount: mount
  };
});
