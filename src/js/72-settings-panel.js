(function (global, factory) {
  var api = factory(
    global.MonsterMintSchema,
    global.MonsterMintSequences,
    global.MonsterMintUtils,
    global.MonsterMintUi
  );
  global.MonsterMintAppSettingsPanel = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (Schema, Sequences, Utils, Ui) {
  var runtimeGlobal = typeof globalThis !== "undefined" ? globalThis : window;
  var escapeHtml = Ui.escapeHtml;

  function renderPanel(state, helpers) {
    var customColorSequences = state.project.sequences.color.filter(function (sequence) {
      return !sequence.builtIn;
    });
    var selectedColorSequence = helpers.getSelectedSequence(customColorSequences, state.ui.selectedColorSequenceId);
    var editingColorSequence = customColorSequences.find(function (sequence) {
      return sequence.id === state.ui.editingColorSequenceId;
    }) || null;
    var settingsDrawer = getSettingsDrawer(editingColorSequence);
    return [
      '<div class="settings-shell' + (settingsDrawer ? " has-drawer" : "") + '">',
      '  <div class="settings-main">',
      '    <div class="panel-grid settings-grid">',
      '      <section class="panel-card">',
      "    <h2>Default Token</h2>",
      helpers.renderDefaultTokenSettingsForm(state.project.settings.tokenDefaults, state.project.sequences.color),
      "      </section>",
      '      <section class="panel-card">',
      "    <h2>Default Text</h2>",
      helpers.renderDefaultTextSettingsForm(state.project.settings.textDefaults, state.project.sequences.color),
      "      </section>",
      '      <section class="panel-card">',
      "    <h2>Image Import</h2>",
      helpers.renderImageImportSettingsForm(state.project.settings),
      "      </section>",
      '      <section class="panel-card">',
      "    <h2>Color Sequences</h2>",
      helpers.renderColorSequenceManager(customColorSequences, selectedColorSequence, editingColorSequence),
      "      </section>",
      "    </div>",
      "  </div>",
      settingsDrawer ? renderSettingsDrawer(settingsDrawer, helpers) : "",
      "</div>"
    ].join("");
  }

  function getSettingsDrawer(editingColorSequence) {
    if (editingColorSequence) {
      return {
        kind: "color",
        title: "Color Sequence",
        sequence: editingColorSequence
      };
    }

    return null;
  }

  function renderSettingsDrawer(drawer, helpers) {
    return [
      '<aside class="editor-drawer settings-drawer" data-drawer="settings">',
      '  <div class="drawer-header">',
      '    <div>',
      '      <p class="drawer-eyebrow">Settings</p>',
      '      <h2>' + escapeHtml(drawer.title) + "</h2>",
      "    </div>",
      '    <button class="button" type="button" data-action="close-settings-drawer">Close</button>',
      "  </div>",
      '  <div class="drawer-body" data-preserve-scroll="y">',
      helpers.renderColorSequenceForm(drawer.sequence),
      '    <div class="button-row drawer-actions">',
      '      <button class="button" type="button" data-action="delete-selected-' + drawer.kind + '-sequence" data-sequence-id="' + drawer.sequence.id + '">Delete Sequence</button>',
      "    </div>",
      "  </div>",
      "</aside>"
    ].join("");
  }

  function bindForms(appElement, store, helpers) {
    var tokenDefaultsForm = appElement.querySelector("[data-form='token-defaults']");
    if (tokenDefaultsForm) {
      var syncTokenDefaultVisibility = function () {
        helpers.syncConditionalFields(tokenDefaultsForm, {
          defaultBackgroundMode: tokenDefaultsForm.querySelector('[name="defaultBackgroundMode"]').value,
          defaultBackgroundColorSource: tokenDefaultsForm.querySelector('[name="defaultBackgroundColorSource"]').value,
          defaultBorderColorSource: tokenDefaultsForm.querySelector('[name="defaultBorderColorSource"]').value
        }, helpers.conditionalFieldPreserve);
      };
      tokenDefaultsForm.querySelectorAll('select[name="defaultBackgroundMode"], select[name="defaultBackgroundColorSource"], select[name="defaultBorderColorSource"]').forEach(function (element) {
        element.addEventListener("change", syncTokenDefaultVisibility);
      });
      syncTokenDefaultVisibility();

      tokenDefaultsForm.addEventListener("change", function () {
        var formData = new FormData(tokenDefaultsForm);
        var backgroundColorSelection = helpers.parseColorSourceValue(formData.get("defaultBackgroundColorSource"));
        var borderColorSelection = helpers.parseColorSourceValue(formData.get("defaultBorderColorSource"));
        store.updateProject(function (project) {
          project.settings.tokenDefaults.diameterIn = Number(formData.get("defaultDiameterIn")) || project.settings.tokenDefaults.diameterIn;
          project.settings.tokenDefaults.backgroundMode = String(formData.get("defaultBackgroundMode")) === "image" ? "image" : "color";
          project.settings.tokenDefaults.backgroundColorMode = backgroundColorSelection.mode;
          project.settings.tokenDefaults.backgroundColor = String(formData.get("defaultBackgroundColor") || project.settings.tokenDefaults.backgroundColor);
          project.settings.tokenDefaults.backgroundColorSequenceRef = backgroundColorSelection.sequenceRef;
          project.settings.tokenDefaults.borderWidthRatio = helpers.toNumberOrDefault(formData.get("defaultBorderWidthRatio"), project.settings.tokenDefaults.borderWidthRatio);
          project.settings.tokenDefaults.borderColorMode = borderColorSelection.mode;
          project.settings.tokenDefaults.borderColor = String(formData.get("defaultBorderColor") || project.settings.tokenDefaults.borderColor);
          project.settings.tokenDefaults.borderColorSequenceRef = borderColorSelection.sequenceRef;
        });
      });

      helpers.bindBackgroundUploadControls(tokenDefaultsForm, {
        inputSelector: "[data-default-background-input]",
        importOptions: helpers.getImageImportOptions(store.getState().project),
        onUpload: function (imageAsset) {
          store.updateProject(function (project) {
            project.settings.tokenDefaults.backgroundMode = "image";
            project.settings.tokenDefaults.backgroundImageSource = imageAsset.source;
          });
        }
      });
    }

    var textDefaultsForm = appElement.querySelector("[data-form='text-defaults']");
    if (textDefaultsForm) {
      var syncTextDefaultVisibility = function () {
        helpers.syncConditionalFields(textDefaultsForm, {
          defaultTextColorSource: textDefaultsForm.querySelector('[name="defaultTextColorSource"]').value,
          defaultTextBorderColorSource: textDefaultsForm.querySelector('[name="defaultTextBorderColorSource"]').value
        }, helpers.conditionalFieldPreserve);
      };
      textDefaultsForm.querySelectorAll('select[name="defaultTextColorSource"], select[name="defaultTextBorderColorSource"]').forEach(function (element) {
        element.addEventListener("change", syncTextDefaultVisibility);
      });
      syncTextDefaultVisibility();

      textDefaultsForm.addEventListener("change", function () {
        var formData = new FormData(textDefaultsForm);
        var textColorSelection = helpers.parseColorSourceValue(formData.get("defaultTextColorSource"));
        var textBorderColorSelection = helpers.parseColorSourceValue(formData.get("defaultTextBorderColorSource"));
        store.updateProject(function (project) {
          project.settings.textDefaults.fontFamily = String(formData.get("fontFamily") || project.settings.textDefaults.fontFamily);
          project.settings.textDefaults.fontWeight = String(formData.get("fontWeight") || project.settings.textDefaults.fontWeight);
          project.settings.textDefaults.colorMode = textColorSelection.mode;
          project.settings.textDefaults.color = String(formData.get("defaultTextColor") || project.settings.textDefaults.color);
          project.settings.textDefaults.colorSequenceRef = textColorSelection.sequenceRef;
          project.settings.textDefaults.textBorder.width = helpers.toNonNegativeNumberOrDefault(formData.get("defaultTextBorderWidth"), project.settings.textDefaults.textBorder.width);
          project.settings.textDefaults.textBorder.colorMode = textBorderColorSelection.mode;
          project.settings.textDefaults.textBorder.color = String(formData.get("defaultTextBorderColor") || project.settings.textDefaults.textBorder.color);
          project.settings.textDefaults.textBorder.colorSequenceRef = textBorderColorSelection.sequenceRef;
        });
      });
    }

    var imageImportSettingsForm = appElement.querySelector("[data-form='image-import-settings']");
    if (imageImportSettingsForm) {
      imageImportSettingsForm.addEventListener("change", function () {
        var formData = new FormData(imageImportSettingsForm);
        store.updateProject(function (project) {
          project.settings.imageTrimAlphaThreshold = helpers.toAlphaThresholdOrDefault(
            formData.get("imageTrimAlphaThreshold"),
            project.settings.imageTrimAlphaThreshold
          );
        });
      });
    }

    var colorSequenceForm = appElement.querySelector("[data-form='color-sequence']");
    if (colorSequenceForm) {
      colorSequenceForm.addEventListener("change", function () {
        var formData = new FormData(colorSequenceForm);
        var sequence = Sequences.createColorSequence({
          id: formData.get("id") || null,
          name: formData.get("name"),
          valuesText: formData.get("valuesText")
        });

        store.updateProject(function (project) {
          helpers.upsertById(project.sequences.color, sequence);
        });
        store.updateUi(function (ui) {
          ui.selectedColorSequenceId = sequence.id;
          ui.editingColorSequenceId = sequence.id;
        });
      });
    }

    var selectedColorSequenceField = appElement.querySelector('[name="selectedColorSequenceId"]');
    if (selectedColorSequenceField) {
      selectedColorSequenceField.addEventListener("change", function () {
        store.updateUi(function (ui) {
          ui.selectedColorSequenceId = selectedColorSequenceField.value || null;
          ui.editingColorSequenceId = selectedColorSequenceField.value || null;
        });
      });
    }
  }

  function bindTransferActions(appElement, store, helpers) {
    var importInput = appElement.querySelector("[data-import-input]");
    if (!importInput) {
      return;
    }

    importInput.addEventListener("change", async function () {
      var file = importInput.files && importInput.files[0];
      if (!file) {
        return;
      }

      try {
        var contents = await Utils.readTextFile(file);
        var parsed = JSON.parse(contents);
        var projectWithDefaults = Schema.normalizeProject(parsed);
        var normalizedProject = await Utils.normalizeProjectImageAssets(projectWithDefaults, helpers.getImageImportOptions(projectWithDefaults));
        await store.replaceProject(normalizedProject);
        await store.updateUi(function (ui) {
          ui.editingColorSequenceId = null;
          ui.selectedColorSequenceId = null;
          ui.selectedTokenId = null;
          ui.selectedComponentType = null;
          ui.selectedComponentId = null;
          ui.selectedPrintPreviewPage = 0;
        });
      } catch (error) {
        runtimeGlobal.alert("Import failed. Please choose a valid Monster Mint JSON file.");
        console.error(error);
      } finally {
        importInput.value = "";
      }
    });
  }

  return {
    renderPanel: renderPanel,
    bindForms: bindForms,
    bindTransferActions: bindTransferActions
  };
});
