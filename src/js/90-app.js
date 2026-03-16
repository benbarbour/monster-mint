(function (global, factory) {
  var api = factory(
    global.MonsterMintSchema,
    global.MonsterMintStorage,
    global.MonsterMintState,
    global.MonsterMintSequences,
    global.MonsterMintUtils,
    global.MonsterMintTokens,
    global.MonsterMintRenderer,
    global.MonsterMintPrint,
    global.MonsterMintUi,
    global.MonsterMintAppHelpers,
    global.MonsterMintAppSettingsPanel,
    global.MonsterMintAppDesignerPanel,
    global.MonsterMintAppPrintPanel
  );
  global.MonsterMintApp = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (Schema, Storage, State, Sequences, Utils, Tokens, Renderer, Print, Ui, AppHelpers, SettingsPanel, DesignerPanel, PrintPanel) {
  var runtimeGlobal = typeof globalThis !== "undefined" ? globalThis : window;
  var TAB_CONFIG = [
    { id: "designer", label: "Designer" },
    { id: "print", label: "Print" }
  ];
  var designerInteraction = null;
  var mountedStore = null;
  var designerWheelPersistTimer = null;
  var designerLayoutObserver = null;
  var designerResizeQueued = false;
  var designerTransientPreview = null;
  var designerPreviewRenderQueued = false;
  var appDelegatedHandlersBound = false;
  var mountedAppView = null;
  var CONDITIONAL_FIELD_PRESERVE = [
    "contentMode",
    "colorSource",
    "textBorderColorSource",
    "backgroundColorSource",
    "borderColorSource",
    "defaultBackgroundColorSource",
    "defaultBorderColorSource",
    "defaultBackgroundMode"
  ];
  var renderConditionalField = Ui.renderConditionalField;
  var renderConditionalBlock = Ui.renderConditionalBlock;
  var syncConditionalFields = Ui.syncConditionalFields;
  var parseColorSourceValue = Ui.parseColorSourceValue;
  var toNumberOrDefault = Ui.toNumberOrDefault;
  var toIntegerOrDefault = Ui.toIntegerOrDefault;
  var toNonNegativeNumberOrDefault = Ui.toNonNegativeNumberOrDefault;
  var toAlphaThresholdOrDefault = Ui.toAlphaThresholdOrDefault;
  var toNonNegativeInteger = Ui.toNonNegativeInteger;
  var renderDefaultTokenSettingsForm = AppHelpers.renderDefaultTokenSettingsForm;
  var renderDefaultTextSettingsForm = AppHelpers.renderDefaultTextSettingsForm;
  var renderImageImportSettingsForm = AppHelpers.renderImageImportSettingsForm;
  var renderBackgroundControls = AppHelpers.renderBackgroundControls;
  var renderColorPicker = AppHelpers.renderColorPicker;
  var getDesignerSelection = AppHelpers.getDesignerSelection;
  var getSelectedComponent = AppHelpers.getSelectedComponent;
  var findToken = AppHelpers.findToken;
  var findComponent = AppHelpers.findComponent;
  var applyBoundsFromForm = AppHelpers.applyBoundsFromForm;
  var toDisplayCenterY = AppHelpers.toDisplayCenterY;
  var fromDisplayCenterY = AppHelpers.fromDisplayCenterY;
  var getImageImportOptions = AppHelpers.getImageImportOptions;
  var collectPrintSelectionRows = AppHelpers.collectPrintSelectionRows;
  var upsertById = AppHelpers.upsertById;
  var applyTokenDefaults = AppHelpers.applyTokenDefaults;
  var bindBackgroundUploadControls = AppHelpers.bindBackgroundUploadControls;
  var renderColorSequenceManager = AppHelpers.renderColorSequenceManager;
  var renderColorSequenceForm = AppHelpers.renderColorSequenceForm;
  var renderTextContentModeOptions = AppHelpers.renderTextContentModeOptions;
  var renderFontWeightOptions = AppHelpers.renderFontWeightOptions;
  var renderFontFamilyOptions = AppHelpers.renderFontFamilyOptions;
  var getSelectedSequence = AppHelpers.getSelectedSequence;
  var SETTINGS_PANEL_HELPERS = {
    conditionalFieldPreserve: CONDITIONAL_FIELD_PRESERVE,
    getSelectedSequence: getSelectedSequence,
    renderDefaultTokenSettingsForm: renderDefaultTokenSettingsForm,
    renderDefaultTextSettingsForm: renderDefaultTextSettingsForm,
    renderImageImportSettingsForm: renderImageImportSettingsForm,
    renderColorSequenceManager: renderColorSequenceManager,
    renderColorSequenceForm: renderColorSequenceForm,
    syncConditionalFields: syncConditionalFields,
    parseColorSourceValue: parseColorSourceValue,
    toNumberOrDefault: toNumberOrDefault,
    toNonNegativeNumberOrDefault: toNonNegativeNumberOrDefault,
    toAlphaThresholdOrDefault: toAlphaThresholdOrDefault,
    upsertById: upsertById,
    bindBackgroundUploadControls: bindBackgroundUploadControls,
    getImageImportOptions: getImageImportOptions
  };
  var DESIGNER_PANEL_HELPERS = {
    conditionalFieldPreserve: CONDITIONAL_FIELD_PRESERVE,
    getDesignerSelection: getDesignerSelection,
    getSelectedComponent: getSelectedComponent,
    renderBackgroundControls: renderBackgroundControls,
    renderColorPicker: renderColorPicker,
    renderConditionalField: renderConditionalField,
    renderConditionalBlock: renderConditionalBlock,
    renderTextContentModeOptions: renderTextContentModeOptions,
    renderFontWeightOptions: renderFontWeightOptions,
    renderFontFamilyOptions: renderFontFamilyOptions,
    syncConditionalFields: syncConditionalFields,
    parseColorSourceValue: parseColorSourceValue,
    toNumberOrDefault: toNumberOrDefault,
    toIntegerOrDefault: toIntegerOrDefault,
    toNonNegativeInteger: toNonNegativeInteger,
    findToken: findToken,
    findComponent: findComponent,
    applyBoundsFromForm: applyBoundsFromForm,
    fromDisplayCenterY: fromDisplayCenterY,
    bindBackgroundUploadControls: bindBackgroundUploadControls,
    getImageImportOptions: getImageImportOptions,
    readImageAssetFile: Utils.readImageAssetFile
  };
  var PRINT_PANEL_HELPERS = {
    toNonNegativeNumberOrDefault: toNonNegativeNumberOrDefault,
    collectPrintSelectionRows: collectPrintSelectionRows
  };

  function render(appView, store) {
    var appElement = appView.appElement;
    var focusState = captureFocusState(appElement);
    var state = store.getState();
    var activeTab = state.ui.activeTab;
    updateShellState(appView, state.ui);
    updatePanelContent(appView, "settings", activeTab === "settings" ? SettingsPanel.renderPanel(state, SETTINGS_PANEL_HELPERS) : "", store);
    updatePanelContent(appView, "designer", activeTab === "designer" ? DesignerPanel.renderPanel(state, DESIGNER_PANEL_HELPERS) : "", store);
    updatePanelContent(appView, "print", activeTab === "print" ? PrintPanel.renderPanel(state) : "", store);
    syncDesignerDrawerHeight(appElement);
    renderDesignerTransientPreview(appElement);
    syncRenderedFormState(appElement, state);
    restoreFocusState(appElement, focusState);
  }

  function syncDesignerDrawerHeight(appElement) {
    if (designerLayoutObserver) {
      designerLayoutObserver.disconnect();
      designerLayoutObserver = null;
    }

    var designerShell = appElement.querySelector(".designer-shell");
    var designerMain = appElement.querySelector(".designer-main");
    var designerDrawer = appElement.querySelector(".designer-drawer");
    if (!designerShell || !designerMain || !designerDrawer) {
      return;
    }

    var applyHeight = function () {
      designerResizeQueued = false;
      designerDrawer.style.maxHeight = Math.max(0, Math.round(designerMain.getBoundingClientRect().height)) + "px";
    };

    applyHeight();

    if (typeof runtimeGlobal.ResizeObserver === "function") {
      designerLayoutObserver = new runtimeGlobal.ResizeObserver(function () {
        if (designerResizeQueued) {
          return;
        }
        designerResizeQueued = true;
        runtimeGlobal.requestAnimationFrame(applyHeight);
      });
      designerLayoutObserver.observe(designerMain);
    }
  }

  function createAppView(appElement) {
    appElement.innerHTML = [
      '<main class="app-shell">',
      '  <header class="app-header">',
      '    <div class="app-brand">',
      '      <h1 class="app-title">Monster Mint</h1>',
      '      <p class="app-subtitle">Design printable tabletop token sheets in one self-contained browser app.</p>',
      '      <p class="app-status" data-save-status></p>',
      "    </div>",
      '    <div class="app-menu" role="toolbar" aria-label="Project actions">',
      '      <button class="menu-button" type="button" data-action="export-project" aria-label="Export JSON" title="Export JSON"><span aria-hidden="true">&#8595;</span></button>',
      '      <button class="menu-button" type="button" data-action="import-project" aria-label="Import JSON" title="Import JSON"><span aria-hidden="true">&#8593;</span></button>',
      '      <button class="menu-button" type="button" data-action="reset-project" aria-label="Reset Project" title="Reset Project"><span aria-hidden="true">&#8635;</span></button>',
      '      <button class="menu-button" type="button" data-action="toggle-help" aria-label="Hotkey Help" title="Hotkey Help"><span aria-hidden="true">?</span></button>',
      '      <button class="menu-button" type="button" data-action="open-settings" aria-label="Settings" title="Settings"><span aria-hidden="true">&#9881;</span></button>',
      '      <input class="visually-hidden" type="file" accept="application/json,.json" data-import-input>',
      "    </div>",
      "  </header>",
      '  <nav class="tabs" aria-label="Main tabs" role="tablist">',
      TAB_CONFIG.map(function (tab) {
        return '<button class="tab-button" type="button" role="tab" aria-selected="false" data-tab="' + tab.id + '">' + tab.label + "</button>";
      }).join(""),
      "  </nav>",
      '<section class="tab-panel" data-panel="settings"></section>',
      '<section class="tab-panel" data-panel="designer"></section>',
      '<section class="tab-panel" data-panel="print"></section>',
      renderHelpDialog(),
      "</main>"
    ].join("");

    return {
      appElement: appElement,
      saveStatus: appElement.querySelector("[data-save-status]"),
      helpButton: appElement.querySelector('[data-action="toggle-help"]'),
      settingsButton: appElement.querySelector('[data-action="open-settings"]'),
      helpDialog: appElement.querySelector("[data-help-dialog]"),
      panels: {
        settings: appElement.querySelector('[data-panel="settings"]'),
        designer: appElement.querySelector('[data-panel="designer"]'),
        print: appElement.querySelector('[data-panel="print"]')
      },
      tabButtons: TAB_CONFIG.reduce(function (result, tab) {
        result[tab.id] = appElement.querySelector('[data-tab="' + tab.id + '"]');
        return result;
      }, {}),
      panelHtml: {
        settings: null,
        designer: null,
        print: null
      }
    };
  }

  function renderHelpDialog() {
    return [
      '<div class="help-overlay" data-help-dialog hidden>',
      '  <div class="help-backdrop" data-action="close-help"></div>',
      '  <section class="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">',
      '    <div class="help-dialog-header">',
      '      <div>',
      '        <p class="drawer-eyebrow">Help</p>',
      '        <h2 id="help-title">Hotkeys</h2>',
      "      </div>",
      '      <button class="button" type="button" data-action="close-help">Close</button>',
      "    </div>",
      '    <div class="help-dialog-body">',
      '      <dl class="hotkey-list">',
      '        <div><dt><kbd>?</kbd></dt><dd>Open or close this help.</dd></div>',
      '        <div><dt><kbd>Delete</kbd> / <kbd>Backspace</kbd></dt><dd>Delete the selected designer component.</dd></div>',
      '        <div><dt><kbd>Esc</kbd></dt><dd>Close help, or clear the selected designer component.</dd></div>',
      '        <div><dt><kbd>T</kbd></dt><dd>Add a text component on the Designer tab.</dd></div>',
      '        <div><dt><kbd>I</kbd></dt><dd>Open image import for a new image component on the Designer tab.</dd></div>',
      "      </dl>",
      '      <p class="field-help">Hotkeys are disabled while typing in inputs, textareas, and selects.</p>',
      "    </div>",
      "  </section>",
      "</div>"
    ].join("");
  }

  function updateShellState(appView, uiState) {
    var activeTab = uiState.activeTab;
    if (appView.settingsButton) {
      appView.settingsButton.classList.toggle("is-active", activeTab === "settings");
    }
    if (appView.helpButton) {
      appView.helpButton.classList.toggle("is-active", uiState.showHelp === true);
    }
    if (appView.helpDialog) {
      appView.helpDialog.hidden = uiState.showHelp !== true;
      appView.helpDialog.classList.toggle("is-visible", uiState.showHelp === true);
    }
    updateSaveStatus(appView, mountedStore ? mountedStore.getState() : null);

    Object.keys(appView.panels).forEach(function (tabId) {
      var panel = appView.panels[tabId];
      if (panel) {
        panel.classList.toggle("is-active", tabId === activeTab);
      }
    });

    TAB_CONFIG.forEach(function (tab) {
      var button = appView.tabButtons[tab.id];
      if (!button) {
        return;
      }
      var isActive = tab.id === activeTab;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }

  function updatePanelContent(appView, tabId, nextHtml, store) {
    var panel = appView.panels[tabId];
    if (!panel || appView.panelHtml[tabId] === nextHtml) {
      return;
    }

    panel.innerHTML = nextHtml;
    appView.panelHtml[tabId] = nextHtml;
    bindPanelForms(tabId, appView.appElement, store);
  }

  function updateSaveStatus(appView, state) {
    if (!appView.saveStatus || !state) {
      return;
    }

    var status = state.autosaveStatus || "Loaded";
    var text = status === "Error"
      ? (state.autosaveErrorMessage || "Changes could not be saved.")
      : status === "Saving"
        ? "Saving to this browser..."
      : status === "Editing"
        ? "Unsaved changes"
        : status === "Saved"
          ? "Saved to this browser"
          : "Loaded from this browser";
    var className = "app-status" + (
      status === "Error"
        ? " is-error"
        : status === "Saving"
          ? " is-editing"
        : status === "Editing"
          ? " is-editing"
          : status === "Saved"
            ? " is-saved"
            : " is-muted"
    );

    appView.saveStatus.className = className;
    appView.saveStatus.textContent = text;
  }

  function bindPanelForms(tabId, appElement, store) {
    if (tabId === "settings") {
      SettingsPanel.bindForms(appElement, store, SETTINGS_PANEL_HELPERS);
      return;
    }

    if (tabId === "designer") {
      DesignerPanel.bindForms(appElement, store, DESIGNER_PANEL_HELPERS);
      return;
    }

    if (tabId === "print") {
      PrintPanel.bindForms(appElement, store, PRINT_PANEL_HELPERS);
    }
  }


  function handleGlobalPointerMove(event) {
    if (!designerInteraction || !mountedStore) {
      return;
    }

    setDesignerTransientPreview(buildDesignerInteractionState(designerInteraction, event));
  }

  function handleGlobalPointerUp() {
    if (!designerInteraction || !mountedStore) {
      return;
    }

    designerInteraction = null;
    if (designerWheelPersistTimer) {
      runtimeGlobal.clearTimeout(designerWheelPersistTimer);
      designerWheelPersistTimer = null;
    }
    commitDesignerTransientPreview();
  }

  function scheduleDesignerPersist() {
    if (designerWheelPersistTimer) {
      runtimeGlobal.clearTimeout(designerWheelPersistTimer);
    }
    designerWheelPersistTimer = runtimeGlobal.setTimeout(function () {
      designerWheelPersistTimer = null;
      commitDesignerTransientPreview();
    }, 180);
  }

  function buildDesignerInteractionState(interaction, event) {
    var deltaX = (event.clientX - interaction.startClientX) / interaction.previewRect.width;
    var deltaY = (event.clientY - interaction.startClientY) / interaction.previewRect.height;
    var state = {
      tokenId: interaction.tokenId,
      componentId: interaction.componentId,
      componentType: interaction.componentType
    };

    if (
      interaction.mode === "resize" ||
      interaction.mode === "resize-top" ||
      interaction.mode === "resize-bottom" ||
      interaction.mode === "resize-left" ||
      interaction.mode === "resize-right"
    ) {
      if (interaction.componentType === "image") {
        var startDimensions = Tokens.getImageDimensions(interaction.startRect);
        var rotationRadians = Number(interaction.startRect.rotationDeg || 0) * Math.PI / 180;
        var outwardX;
        var outwardY;
        var baseHalfSize;
        if (interaction.mode === "resize-top") {
          outwardX = Math.sin(rotationRadians);
          outwardY = -Math.cos(rotationRadians);
          baseHalfSize = Math.max(startDimensions.height / 2, 0.001);
        } else if (interaction.mode === "resize-bottom") {
          outwardX = -Math.sin(rotationRadians);
          outwardY = Math.cos(rotationRadians);
          baseHalfSize = Math.max(startDimensions.height / 2, 0.001);
        } else if (interaction.mode === "resize-left") {
          outwardX = -Math.cos(rotationRadians);
          outwardY = -Math.sin(rotationRadians);
          baseHalfSize = Math.max(startDimensions.width / 2, 0.001);
        } else {
          outwardX = Math.cos(rotationRadians);
          outwardY = Math.sin(rotationRadians);
          baseHalfSize = Math.max(startDimensions.width / 2, 0.001);
        }
        var outwardDelta = deltaX * outwardX + deltaY * outwardY;
        state.componentState = {
          x: interaction.startRect.x,
          y: interaction.startRect.y,
          scale: interaction.startRect.scale * Math.max(0.1, (baseHalfSize + outwardDelta) / baseHalfSize),
          rotationDeg: interaction.startRect.rotationDeg
        };
      } else {
        var nextWidth = interaction.startRect.width;
        var nextHeight = interaction.startRect.height;
        if (interaction.mode === "resize-left") {
          nextWidth = interaction.startRect.width - deltaX * 2;
        } else if (interaction.mode === "resize-right") {
          nextWidth = interaction.startRect.width + deltaX * 2;
        } else if (interaction.mode === "resize-top") {
          nextHeight = interaction.startRect.height - deltaY * 2;
        } else if (interaction.mode === "resize-bottom") {
          nextHeight = interaction.startRect.height + deltaY * 2;
        } else {
          nextWidth = interaction.startRect.width + deltaX * 2;
          nextHeight = interaction.startRect.height + deltaY * 2;
        }
        state.componentState = {
          x: interaction.startRect.x,
          y: interaction.startRect.y,
          width: nextWidth,
          height: nextHeight
        };
      }
      return state;
    }

    if (interaction.mode === "rotate" && interaction.componentType === "image") {
      var startAngle = Math.atan2(
        interaction.startClientY - interaction.centerClientY,
        interaction.startClientX - interaction.centerClientX
      );
      var nextAngle = Math.atan2(
        event.clientY - interaction.centerClientY,
        event.clientX - interaction.centerClientX
      );
      state.componentState = {
        x: interaction.startRect.x,
        y: interaction.startRect.y,
        scale: interaction.startRect.scale,
        rotationDeg: interaction.startRect.rotationDeg + (nextAngle - startAngle) * 180 / Math.PI
      };
      return state;
    }

    if (interaction.componentType === "image") {
      state.componentState = {
        x: interaction.startRect.x + deltaX,
        y: interaction.startRect.y + deltaY,
        scale: interaction.startRect.scale,
        rotationDeg: interaction.startRect.rotationDeg
      };
      return state;
    }

    state.componentState = {
      x: interaction.startRect.x + deltaX,
      y: interaction.startRect.y + deltaY,
      width: interaction.startRect.width,
      height: interaction.startRect.height
    };
    return state;
  }

  function scaleDesignerComponentState(selection, component, factor) {
    var state = {
      tokenId: selection.token.id,
      componentId: component.id,
      componentType: selection.selectedComponentType
    };

    if (selection.selectedComponentType === "image") {
      state.componentState = {
        x: component.x,
        y: component.y,
        scale: component.scale * factor,
        rotationDeg: component.rotationDeg
      };
      return state;
    }

    state.componentState = {
      x: component.x,
      y: component.y,
      width: component.width * factor,
      height: component.height * factor
    };
    return state;
  }

  function setDesignerTransientPreview(preview) {
    designerTransientPreview = preview;
    scheduleDesignerTransientRender();
  }

  function scheduleDesignerTransientRender() {
    if (designerPreviewRenderQueued) {
      return;
    }
    designerPreviewRenderQueued = true;
    runtimeGlobal.requestAnimationFrame(function () {
      designerPreviewRenderQueued = false;
      renderDesignerTransientPreview();
    });
  }

  function renderDesignerTransientPreview(appElement) {
    if (!designerTransientPreview || !mountedStore) {
      return;
    }

    var root = appElement || runtimeGlobal.document.getElementById("app");
    if (!root) {
      return;
    }

    var state = mountedStore.getState();
    var selection = getDesignerSelection(state);
    if (!selection.token || selection.token.id !== designerTransientPreview.tokenId) {
      return;
    }

    var token = Schema.clone(selection.token);
    if (!applyDesignerTransientState(token, designerTransientPreview)) {
      return;
    }

    var previewStage = root.querySelector("[data-preview-stage]");
    if (!previewStage) {
      return;
    }

    previewStage.innerHTML = Renderer.renderTokenSvg(token, state.project, {
      sequenceIndex: 0,
      instanceId: "designer-front",
      interactive: true,
      selectedComponentType: state.ui.selectedComponentType,
      selectedComponentId: state.ui.selectedComponentId
    });
    syncDesignerTransientForm(root, designerTransientPreview);
  }

  function applyDesignerTransientState(token, preview) {
    if (!token || !token.front || !preview) {
      return false;
    }

    var component = getSelectedComponent(token.front, preview.componentType, preview.componentId);
    if (!component) {
      return false;
    }

    if (preview.componentType === "image") {
      Tokens.updateImageComponent(component, {
        x: preview.componentState.x,
        y: preview.componentState.y,
        scale: preview.componentState.scale,
        rotationDeg: preview.componentState.rotationDeg,
        mirrorX: component.mirrorX,
        mirrorY: component.mirrorY
      });
      return true;
    }

    Tokens.updateComponentRect(component, preview.componentState);
    return true;
  }

  function syncDesignerTransientForm(appElement, preview) {
    var form = appElement.querySelector(
      preview.componentType === "image"
        ? '[data-form="image-component-settings"]'
        : '[data-form="text-component-settings"]'
    );
    if (!form) {
      return;
    }

    setFormFieldValue(form, "x", preview.componentState.x, 2);
    setFormFieldValue(form, "y", toDisplayCenterY(preview.componentState.y), 2);
    if (preview.componentType === "image") {
      setFormFieldValue(form, "scale", preview.componentState.scale, 2);
      setFormFieldValue(form, "rotationDeg", Math.round(Number(preview.componentState.rotationDeg || 0)));
      setRangeHelpText(form, "scale", Math.round(preview.componentState.scale * 100) + "% of max circle diameter");
      setRangeHelpText(form, "rotationDeg", Math.round(Number(preview.componentState.rotationDeg || 0)) + "° clockwise");
      return;
    }

    setFormFieldValue(form, "width", preview.componentState.width, 2);
    setFormFieldValue(form, "height", preview.componentState.height, 2);
  }

  function setFormFieldValue(form, name, value, fixedDigits, skipName) {
    var field = form.querySelector('[name="' + name + '"]');
    if (!field) {
      return;
    }
    if (skipName && field.name === skipName) {
      return;
    }
    field.value = typeof fixedDigits === "number" ? Number(value).toFixed(fixedDigits) : String(value);
  }

  function setRangeHelpText(form, name, text) {
    var field = form.querySelector('[name="' + name + '"]');
    if (!field) {
      return;
    }
    var help = field.parentElement ? field.parentElement.querySelector(".field-help") : null;
    if (help) {
      help.textContent = text;
    }
  }

  function syncRenderedFormState(appElement, state) {
    syncDesignerFormState(appElement, state);
    syncPrintSelectionFormState(appElement, state);
  }

  function syncDesignerFormState(appElement, state) {
    var selection = getDesignerSelection(state);
    if (!selection.token || !selection.selectedComponentType) {
      return;
    }

    var component = getSelectedComponent(selection.token.front, selection.selectedComponentType, selection.selectedComponentId);
    if (!component) {
      return;
    }

    if (selection.selectedComponentType === "image") {
      var imageForm = appElement.querySelector('[data-form="image-component-settings"]');
      if (!imageForm) {
        return;
      }
      setFormFieldValue(imageForm, "x", component.x, 2);
      setFormFieldValue(imageForm, "y", toDisplayCenterY(component.y), 2);
      setFormFieldValue(imageForm, "scale", component.scale, 2);
      setFormFieldValue(imageForm, "rotationDeg", Math.round(Number(component.rotationDeg || 0)));
      setRangeHelpText(imageForm, "scale", Math.round(component.scale * 100) + "% of max circle diameter");
      setRangeHelpText(imageForm, "rotationDeg", Math.round(Number(component.rotationDeg || 0)) + "° clockwise");
      return;
    }

    var textForm = appElement.querySelector('[data-form="text-component-settings"]');
    if (!textForm) {
      return;
    }
    setFormFieldValue(textForm, "x", component.x, 2);
    setFormFieldValue(textForm, "y", toDisplayCenterY(component.y), 2);
    setFormFieldValue(textForm, "width", component.width, 2);
    setFormFieldValue(textForm, "height", component.height, 2);
    setFormFieldValue(textForm, "sequenceStart", component.sequenceStart);
    if (textForm.querySelector('[name="sequencePad"]')) {
      setFormFieldValue(textForm, "sequencePad", component.sequencePad);
    }
  }

  function syncPrintSelectionFormState(appElement, state) {
    var printForm = appElement.querySelector('[data-form="print-selections"]');
    if (!printForm) {
      return;
    }
    var activeElement = runtimeGlobal.document && runtimeGlobal.document.activeElement;
    var activeName = activeElement && printForm.contains(activeElement) ? activeElement.name : null;

    Print.getSelectionRows(state.project).forEach(function (row) {
      setFormFieldValue(printForm, "copies-" + row.tokenId, row.copies, null, activeName);
      setFormFieldValue(printForm, "start-" + row.tokenId, row.sequenceStart, null, activeName);
    });
  }

  function bindDelegatedAppHandlers(appElement) {
    if (appDelegatedHandlersBound) {
      return;
    }
    appDelegatedHandlersBound = true;

    appElement.addEventListener("click", function (event) {
      handleDelegatedClick(appElement, event);
    });
    appElement.addEventListener("mousedown", function (event) {
      handleDelegatedMouseDown(event);
    });
    appElement.addEventListener("wheel", function (event) {
      handleDelegatedWheel(event);
    }, { passive: false });
    runtimeGlobal.addEventListener("keydown", handleGlobalKeyDown);
  }

  function handleDelegatedClick(appElement, event) {
    if (!mountedStore) {
      return;
    }

    var tabButton = event.target.closest("[data-tab]");
    if (tabButton && appElement.contains(tabButton)) {
      mountedStore.setActiveTab(tabButton.getAttribute("data-tab"));
      return;
    }

    var actionButton = event.target.closest("[data-action]");
    if (actionButton && appElement.contains(actionButton)) {
      handleActionClick(appElement, actionButton);
      return;
    }

    var previewStage = event.target.closest("[data-preview-stage]");
    if (previewStage && appElement.contains(previewStage)) {
      handlePreviewSelection(event);
    }
  }

  function handleActionClick(appElement, button) {
    var action = button.getAttribute("data-action");
    if (!action) {
      return;
    }

    if (action === "open-settings") {
      mountedStore.setActiveTab("settings");
      return;
    }

    if (action === "toggle-help") {
      toggleHelp();
      return;
    }

    if (action === "close-help") {
      setHelpOpen(false);
      return;
    }

    if (action === "reset-project") {
      resetProject();
      return;
    }

    if (action === "toggle-print-panel") {
      togglePrintPanel(button.getAttribute("data-panel-key"));
      return;
    }

    if (action === "export-project") {
      exportProject();
      return;
    }

    if (action === "import-project") {
      var importInput = appElement.querySelector("[data-import-input]");
      if (importInput) {
        importInput.click();
      }
      return;
    }

    if (action === "close-settings-drawer") {
      mountedStore.updateUi(function (ui) {
        ui.editingColorSequenceId = null;
      });
      return;
    }

    if (action === "new-color-sequence") {
      createColorSequence();
      return;
    }

    if (action === "delete-selected-color-sequence") {
      deleteColorSequence(button.getAttribute("data-sequence-id"));
      return;
    }

    if (action === "add-token") {
      addToken();
      return;
    }

    if (action === "clone-token") {
      cloneToken(button.getAttribute("data-token-id"));
      return;
    }

    if (action === "delete-token") {
      deleteToken(button.getAttribute("data-token-id"));
      return;
    }

    if (action === "add-text") {
      addTextComponent();
      return;
    }

    if (action === "add-image") {
      clickInput(appElement.querySelector("[data-image-upload-input]"));
      return;
    }

    if (action === "replace-image") {
      clickInput(button.closest("form") && button.closest("form").querySelector("[data-replace-image-input]"));
      return;
    }

    if (action === "upload-default-background") {
      clickInput(appElement.querySelector("[data-default-background-input]"));
      return;
    }

    if (action === "upload-token-background") {
      clickInput(appElement.querySelector("[data-token-background-input]"));
      return;
    }

    if (action === "remove-default-background") {
      mountedStore.updateProject(function (project) {
        project.settings.tokenDefaults.backgroundMode = "color";
        project.settings.tokenDefaults.backgroundImageSource = "";
      });
      return;
    }

    if (action === "remove-token-background") {
      var selection = getDesignerSelection(mountedStore.getState());
      if (!selection.token) {
        return;
      }
      mountedStore.updateProject(function (project) {
        var token = findToken(project, selection.token.id);
        if (!token) {
          return;
        }
        token.front.backgroundMode = "color";
        token.front.backgroundImageSource = "";
      });
      return;
    }

    if (action === "delete-component") {
      deleteSelectedComponent();
      return;
    }

    if (action === "move-component-up" || action === "move-component-down") {
      moveSelectedComponent(action === "move-component-up" ? "up" : "down");
      return;
    }

    if (action === "select-preview-page") {
      mountedStore.updateUi(function (ui) {
        ui.selectedPrintPreviewPage = Number(button.getAttribute("data-page-index")) || 0;
      });
      return;
    }

    if (action === "print-layout") {
      PrintPanel.printCurrentLayout(mountedStore);
    }
  }

  function handlePreviewSelection(event) {
    var componentElement = event.target.closest("[data-component-id]");
    if (componentElement) {
      mountedStore.updateUi(function (ui) {
        ui.selectedComponentType = componentElement.getAttribute("data-component-type");
        ui.selectedComponentId = componentElement.getAttribute("data-component-id");
      });
      return;
    }

    mountedStore.updateUi(function (ui) {
      ui.selectedComponentType = null;
      ui.selectedComponentId = null;
    });
  }

  function handleDelegatedMouseDown(event) {
    if (!mountedStore) {
      return;
    }

    var dragTarget = event.target.closest("[data-drag-mode]");
    if (!dragTarget) {
      return;
    }

    var selection = getDesignerSelection(mountedStore.getState());
    if (!selection.token) {
      return;
    }

    event.preventDefault();
    var componentElement = event.target.closest("[data-component-id]");
    if (!componentElement) {
      return;
    }

    var componentId = componentElement.getAttribute("data-component-id");
    var componentType = componentElement.getAttribute("data-component-type");
    var mode = dragTarget.getAttribute("data-drag-mode") || "move";
    var component = getSelectedComponent(selection.token.front, componentType, componentId);
    if (!component) {
      return;
    }

    var svgElement = event.target.ownerSVGElement;
    var previewRect = svgElement.getBoundingClientRect();
    designerInteraction = {
      tokenId: selection.token.id,
      componentId: componentId,
      componentType: componentType,
      mode: mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      previewRect: previewRect,
      startRect: {
        x: component.x,
        y: component.y,
        width: component.width,
        height: component.height,
        scale: component.scale,
        aspectRatio: component.aspectRatio,
        rotationDeg: Number(component.rotationDeg || 0)
      },
      centerClientX: previewRect.left + (50 + component.x * 100) / 100 * previewRect.width,
      centerClientY: previewRect.top + (50 + component.y * 100) / 100 * previewRect.height
    };

    mountedStore.updateUi(function (ui) {
      ui.selectedComponentType = componentType;
      ui.selectedComponentId = componentId;
    });
  }

  function handleDelegatedWheel(event) {
    if (!mountedStore || !event.target.closest("[data-preview-stage]")) {
      return;
    }

    var selection = getDesignerSelection(mountedStore.getState());
    if (!selection.token || !selection.selectedComponentType) {
      return;
    }

    var component = findComponent(mountedStore.getState().project, selection, selection.selectedComponentType);
    if (!component) {
      return;
    }

    event.preventDefault();
    var factor = Math.pow(1.0015, -event.deltaY);
    setDesignerTransientPreview(scaleDesignerComponentState(selection, component, factor));
    scheduleDesignerPersist();
  }

  function clickInput(input) {
    if (input) {
      input.click();
    }
  }

  function handleGlobalKeyDown(event) {
    if (!mountedStore) {
      return;
    }

    var isHelpToggle = event.key === "?" || (event.key === "/" && event.shiftKey);
    if (isHelpToggle && !shouldIgnoreHotkeysForTarget(event.target)) {
      event.preventDefault();
      toggleHelp();
      return;
    }

    if (shouldIgnoreHotkeysForTarget(event.target)) {
      return;
    }

    var state = mountedStore.getState();
    if (event.key === "Escape") {
      if (state.ui.showHelp) {
        event.preventDefault();
        setHelpOpen(false);
        return;
      }

      if (state.ui.activeTab === "designer" && state.ui.selectedComponentId) {
        event.preventDefault();
        clearSelectedComponent();
      }
      return;
    }

    if (state.ui.showHelp) {
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      if (state.ui.activeTab === "designer" && state.ui.selectedComponentId) {
        event.preventDefault();
        deleteSelectedComponent();
      }
      return;
    }

    if (state.ui.activeTab !== "designer") {
      return;
    }

    if (event.key === "t" || event.key === "T") {
      if (getDesignerSelection(state).token) {
        event.preventDefault();
        addTextComponent();
      }
      return;
    }

    if ((event.key === "i" || event.key === "I") && getDesignerSelection(state).token) {
      event.preventDefault();
      clickInput(runtimeGlobal.document.querySelector("[data-image-upload-input]"));
    }
  }

  function shouldIgnoreHotkeysForTarget(target) {
    if (!target || !(target instanceof runtimeGlobal.Element)) {
      return false;
    }

    if (target.closest("[data-help-dialog]")) {
      return false;
    }

    var editable = target.closest("input, textarea, select, [contenteditable='true']");
    if (!editable) {
      return false;
    }

    if (editable.tagName === "INPUT") {
      var inputType = (editable.getAttribute("type") || "text").toLowerCase();
      return ["button", "checkbox", "file", "radio", "range"].indexOf(inputType) === -1;
    }

    return true;
  }

  function toggleHelp() {
    setHelpOpen(!(mountedStore.getState().ui.showHelp === true));
  }

  function setHelpOpen(isOpen) {
    mountedStore.updateUi(function (ui) {
      ui.showHelp = isOpen;
    });
  }

  function clearSelectedComponent() {
    mountedStore.updateUi(function (ui) {
      ui.selectedComponentType = null;
      ui.selectedComponentId = null;
    });
  }

  function resetProject() {
    if (!runtimeGlobal.confirm("Reset the current project? This clears saved tokens and sequences.")) {
      return;
    }

    mountedStore.replaceProject(Schema.createDefaultProject());
    mountedStore.updateUi(function (ui) {
      ui.editingColorSequenceId = null;
      ui.selectedColorSequenceId = null;
      ui.selectedTokenId = null;
      ui.selectedComponentType = null;
      ui.selectedComponentId = null;
      ui.selectedPrintPreviewPage = 0;
      ui.showHelp = false;
    });
  }

  function togglePrintPanel(panelKey) {
    mountedStore.updateUi(function (ui) {
      ui.printPanels = ui.printPanels || {};
      ui.printPanels[panelKey] = !(ui.printPanels[panelKey] !== false);
    });
  }

  function exportProject() {
    var state = mountedStore.getState();
    var safeName = state.project.meta && state.project.meta.name && state.project.meta.name !== "Untitled Project"
      ? state.project.meta.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
      : "monster-mint";
    Utils.downloadTextFile((safeName || "monster-mint") + ".json", JSON.stringify(state.project, null, 2));
  }

  function createColorSequence() {
    var sequence = Sequences.createColorSequence({
      name: "New color sequence",
      valuesText: "#8a1c1c\n#3b5b92"
    });
    mountedStore.updateProject(function (project) {
      project.sequences.color.push(sequence);
    });
    mountedStore.updateUi(function (ui) {
      ui.selectedColorSequenceId = sequence.id;
      ui.editingColorSequenceId = sequence.id;
    });
  }

  function deleteColorSequence(sequenceId) {
    if (!sequenceId) {
      return;
    }

    mountedStore.updateProject(function (project) {
      project.sequences.color = project.sequences.color.filter(function (sequence) {
        return sequence.id !== sequenceId;
      });
    });
    mountedStore.updateUi(function (ui) {
      ui.editingColorSequenceId = null;
      if (ui.selectedColorSequenceId === sequenceId) {
        ui.selectedColorSequenceId = null;
      }
    });
  }

  function addToken() {
    var token = Tokens.createTokenTemplate({});
    applyTokenDefaults(token, mountedStore.getState().project.settings.tokenDefaults);
    mountedStore.updateProject(function (project) {
      project.tokens.push(token);
    });
    mountedStore.updateUi(function (ui) {
      ui.activeTab = "designer";
      ui.selectedTokenId = token.id;
      ui.selectedComponentType = null;
      ui.selectedComponentId = null;
    });
  }

  function cloneToken(tokenId) {
    var sourceToken = findToken(mountedStore.getState().project, tokenId);
    if (!sourceToken) {
      return;
    }

    var token = Tokens.cloneTokenTemplate(sourceToken);
    mountedStore.updateProject(function (project) {
      project.tokens.push(token);
    });
    mountedStore.updateUi(function (ui) {
      ui.activeTab = "designer";
      ui.selectedTokenId = token.id;
      ui.selectedComponentType = null;
      ui.selectedComponentId = null;
    });
  }

  function deleteToken(tokenId) {
    if (!runtimeGlobal.confirm("Delete the selected token?")) {
      return;
    }

    mountedStore.updateProject(function (project) {
      project.tokens = project.tokens.filter(function (token) {
        return token.id !== tokenId;
      });
    });
    mountedStore.updateUi(function (ui) {
      ui.selectedTokenId = ui.selectedTokenId === tokenId ? null : ui.selectedTokenId;
      ui.selectedComponentType = null;
      ui.selectedComponentId = null;
    });
  }

  function addTextComponent() {
    var selection = getDesignerSelection(mountedStore.getState());
    if (!selection.token) {
      return;
    }

    var face = selection.token.front;
    var textDefaults = mountedStore.getState().project.settings.textDefaults;
    var component = Tokens.createTextComponent({
      name: "Text #" + (face.texts.length + 1),
      zIndex: Tokens.getNextComponentZ(face),
      fontFamily: textDefaults.fontFamily,
      fontWeight: textDefaults.fontWeight,
      colorMode: textDefaults.colorMode,
      color: textDefaults.color,
      colorSequenceRef: textDefaults.colorSequenceRef,
      textBorder: {
        width: textDefaults.textBorder.width,
        colorMode: textDefaults.textBorder.colorMode,
        color: textDefaults.textBorder.color,
        colorSequenceRef: textDefaults.textBorder.colorSequenceRef
      }
    });
    mountedStore.updateProject(function (project) {
      var token = findToken(project, selection.token.id);
      token.front.texts.push(component);
    });
    mountedStore.updateUi(function (ui) {
      ui.selectedComponentType = "text";
      ui.selectedComponentId = component.id;
    });
  }

  function deleteSelectedComponent() {
    var selection = getDesignerSelection(mountedStore.getState());
    if (!selection.token || !selection.selectedComponentId || !DesignerPanel.canDeleteSelectedComponent(selection)) {
      return;
    }

    mountedStore.updateProject(function (project) {
      var token = findToken(project, selection.token.id);
      var face = token.front;
      face.images = face.images.filter(function (component) {
        return component.id !== selection.selectedComponentId;
      });
      face.texts = face.texts.filter(function (component) {
        return component.id !== selection.selectedComponentId;
      });
    });
    mountedStore.updateUi(function (ui) {
      ui.selectedComponentType = null;
      ui.selectedComponentId = null;
    });
  }

  function moveSelectedComponent(direction) {
    var selection = getDesignerSelection(mountedStore.getState());
    if (!selection.token || !selection.selectedComponentId || !selection.selectedComponentType) {
      return;
    }

    mountedStore.updateProject(function (project) {
      var token = findToken(project, selection.token.id);
      if (!token) {
        return;
      }
      Tokens.moveComponentZ(token.front, selection.selectedComponentType, selection.selectedComponentId, direction);
    });
  }

  function commitDesignerTransientPreview() {
    if (!mountedStore || !designerTransientPreview) {
      return;
    }

    var preview = designerTransientPreview;
    designerTransientPreview = null;
    mountedStore.updateProject(function (project) {
      var token = findToken(project, preview.tokenId);
      if (!token) {
        return;
      }
      applyDesignerTransientState(token, preview);
    });
  }

  function captureFocusState(appElement) {
    if (!appElement || !appElement.contains(runtimeGlobal.document.activeElement)) {
      return null;
    }

    var active = runtimeGlobal.document.activeElement;
    if (!active || !active.name) {
      return null;
    }

    var form = active.closest("[data-form]");
    return {
      form: form ? form.getAttribute("data-form") : null,
      name: active.name,
      selectionStart: typeof active.selectionStart === "number" ? active.selectionStart : null,
      selectionEnd: typeof active.selectionEnd === "number" ? active.selectionEnd : null
    };
  }

  function restoreFocusState(appElement, focusState) {
    if (!focusState || !focusState.name) {
      return;
    }

    var selector = (focusState.form ? '[data-form="' + focusState.form + '"] ' : "") + '[name="' + focusState.name + '"]';
    var nextField = appElement.querySelector(selector);
    if (!nextField || typeof nextField.focus !== "function") {
      return;
    }

    nextField.focus({ preventScroll: true });
    if (typeof focusState.selectionStart === "number" && typeof nextField.setSelectionRange === "function") {
      nextField.setSelectionRange(focusState.selectionStart, focusState.selectionEnd == null ? focusState.selectionStart : focusState.selectionEnd);
    }
  }

  async function mount() {
    var appElement = document.getElementById("app");
    renderLoadingState(appElement);
    var persistence = Storage.createBrowserPersistence({
      indexedDB: runtimeGlobal.indexedDB,
      storage: runtimeGlobal.localStorage
    });
    var store = await State.createStore({ persistence: persistence });
    mountedStore = store;
    mountedAppView = createAppView(appElement);
    bindDelegatedAppHandlers(appElement);
    SettingsPanel.bindTransferActions(appElement, store, SETTINGS_PANEL_HELPERS);
    store.subscribe(function () {
      render(mountedAppView, store);
    });
    bindGlobalPointerHandlers();
    bindGlobalResizeHandlers(appElement);
    render(mountedAppView, store);
  }

  function renderLoadingState(appElement) {
    appElement.innerHTML = '<main class="app-shell"><section class="tab-panel is-active"><div class="empty-state"><h2>Loading Project</h2><p>Opening browser storage...</p></div></section></main>';
  }

  function bindGlobalPointerHandlers() {
    if (bindGlobalPointerHandlers.didBind) {
      return;
    }
    bindGlobalPointerHandlers.didBind = true;
    runtimeGlobal.addEventListener("mousemove", handleGlobalPointerMove);
    runtimeGlobal.addEventListener("mouseup", handleGlobalPointerUp);
  }

  function bindGlobalResizeHandlers(appElement) {
    if (bindGlobalResizeHandlers.didBind) {
      return;
    }
    bindGlobalResizeHandlers.didBind = true;
    runtimeGlobal.addEventListener("resize", function () {
      if (designerResizeQueued) {
        return;
      }
      designerResizeQueued = true;
      runtimeGlobal.requestAnimationFrame(function () {
        designerResizeQueued = false;
        syncDesignerDrawerHeight(appElement);
      });
    });
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", function () {
      mount().catch(function (error) {
        console.error(error);
        var appElement = document.getElementById("app");
        if (appElement) {
          appElement.innerHTML = '<main class="app-shell"><section class="tab-panel is-active"><div class="empty-state"><h2>Storage Error</h2><p>Monster Mint could not open browser storage. Export any existing project JSON and reload the page.</p></div></section></main>';
        }
      });
    });
  }

  return {
    mount: mount
  };
});
