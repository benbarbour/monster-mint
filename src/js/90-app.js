(function (global, factory) {
  var api = factory(
    global.MonsterMintSchema,
    global.MonsterMintState,
    global.MonsterMintSequences,
    global.MonsterMintUtils,
    global.MonsterMintTokens,
    global.MonsterMintRenderer,
    global.MonsterMintPrint,
    global.MonsterMintUi,
    global.MonsterMintAppSettingsPanel,
    global.MonsterMintAppDesignerPanel,
    global.MonsterMintAppPrintPanel
  );
  global.MonsterMintApp = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (Schema, State, Sequences, Utils, Tokens, Renderer, Print, Ui, SettingsPanel, DesignerPanel, PrintPanel) {
  var runtimeGlobal = typeof globalThis !== "undefined" ? globalThis : window;
  var TAB_CONFIG = [
    { id: "designer", label: "Designer" },
    { id: "print", label: "Print" }
  ];
  var FONT_CHOICES = [
    { value: "Georgia", label: "Georgia" },
    { value: "Times New Roman", label: "Times New Roman" },
    { value: "Palatino Linotype", label: "Palatino Linotype" },
    { value: "Trebuchet MS", label: "Trebuchet MS" },
    { value: "Verdana", label: "Verdana" },
    { value: "Arial", label: "Arial" },
    { value: "Courier New", label: "Courier New" },
    { value: "Impact", label: "Impact" }
  ];
  var designerInteraction = null;
  var mountedStore = null;
  var designerWheelPersistTimer = null;
  var pendingPrintFieldFocus = null;
  var designerLayoutObserver = null;
  var designerResizeQueued = false;
  var designerTransientPreview = null;
  var designerPreviewRenderQueued = false;
  var appDelegatedHandlersBound = false;
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
  var escapeHtml = Ui.escapeHtml;
  var renderConditionalField = Ui.renderConditionalField;
  var renderConditionalBlock = Ui.renderConditionalBlock;
  var syncConditionalFields = Ui.syncConditionalFields;
  var parseColorSourceValue = Ui.parseColorSourceValue;
  var normalizeColorInput = Ui.normalizeColorInput;
  var toNumberOrDefault = Ui.toNumberOrDefault;
  var toIntegerOrDefault = Ui.toIntegerOrDefault;
  var toNonNegativeNumberOrDefault = Ui.toNonNegativeNumberOrDefault;
  var toAlphaThresholdOrDefault = Ui.toAlphaThresholdOrDefault;
  var toNonNegativeInteger = Ui.toNonNegativeInteger;

  function render(appElement, store) {
    var focusState = captureFocusState(appElement);
    var state = store.getState();
    var activeTab = state.ui.activeTab;

    appElement.innerHTML = [
      '<main class="app-shell">',
      '  <header class="app-header">',
      '    <div class="app-brand">',
      '      <h1 class="app-title">Monster Mint</h1>',
      '      <p class="app-subtitle">Design printable tabletop token sheets in one self-contained browser app.</p>',
      "    </div>",
      '    <div class="app-menu" role="toolbar" aria-label="Project actions">',
      '      <button class="menu-button" type="button" data-action="export-project" aria-label="Export JSON" title="Export JSON"><span aria-hidden="true">&#8595;</span></button>',
      '      <button class="menu-button" type="button" data-action="import-project" aria-label="Import JSON" title="Import JSON"><span aria-hidden="true">&#8593;</span></button>',
      '      <button class="menu-button" type="button" data-action="reset-project" aria-label="Reset Project" title="Reset Project"><span aria-hidden="true">&#8635;</span></button>',
      '      <button class="menu-button' + (activeTab === "settings" ? " is-active" : "") + '" type="button" data-action="open-settings" aria-label="Settings" title="Settings"><span aria-hidden="true">&#9881;</span></button>',
      '      <input class="visually-hidden" type="file" accept="application/json,.json" data-import-input>',
      "    </div>",
      "  </header>",
      '  <nav class="tabs" aria-label="Main tabs" role="tablist">',
      TAB_CONFIG.map(function (tab) {
        return '<button class="tab-button' + (tab.id === activeTab ? " is-active" : "") + '" type="button" role="tab" aria-selected="' + (tab.id === activeTab ? "true" : "false") + '" data-tab="' + tab.id + '">' + tab.label + "</button>";
      }).join(""),
      "  </nav>",
      renderPanel("settings", activeTab, activeTab === "settings" ? SettingsPanel.renderPanel(state, getSettingsPanelHelpers()) : ""),
      renderPanel("designer", activeTab, activeTab === "designer" ? DesignerPanel.renderPanel(state, getDesignerPanelHelpers()) : ""),
      renderPanel("print", activeTab, activeTab === "print" ? PrintPanel.renderPanel(state) : ""),
      "</main>"
    ].join("");

    attachEvents(appElement, store);
    syncDesignerDrawerHeight(appElement);
    renderDesignerTransientPreview(appElement);
    restoreFocusState(appElement, focusState);
    restorePendingPrintFieldFocus(appElement);
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

  function renderPanel(tabId, activeTab, content) {
    return '<section class="tab-panel' + (tabId === activeTab ? " is-active" : "") + '" data-panel="' + tabId + '">' + content + "</section>";
  }


  function renderDefaultTokenSettingsForm(tokenDefaults, colorSequences) {
    return [
      '<form class="form-grid" data-form="token-defaults">',
      '  <label class="field">Diameter<select name="defaultDiameterIn">' + Schema.TOKEN_SIZES.map(function (size) {
        return '<option value="' + size + '"' + (size === tokenDefaults.diameterIn ? " selected" : "") + ">" + size + '&quot;</option>';
      }).join("") + "</select></label>",
      renderBackgroundControls({
        modeName: "defaultBackgroundMode",
        currentMode: tokenDefaults.backgroundMode,
        colorLabel: "Default background",
        sourceName: "defaultBackgroundColorSource",
        colorName: "defaultBackgroundColor",
        currentColorMode: tokenDefaults.backgroundColorMode,
        currentColor: tokenDefaults.backgroundColor,
        currentSequenceRef: tokenDefaults.backgroundColorSequenceRef,
        sequences: colorSequences,
        imageSource: tokenDefaults.backgroundImageSource,
        uploadAction: "upload-default-background",
        removeAction: "remove-default-background",
        inputAttributes: 'data-default-background-input'
      }),
      '  <label class="field">Default border width<input type="range" min="0" max="0.25" step="0.01" name="defaultBorderWidthRatio" value="' + tokenDefaults.borderWidthRatio.toFixed(2) + '"><span class="field-help">' + Math.round(tokenDefaults.borderWidthRatio * 100) + '% of token width</span></label>',
      renderColorPicker({
        label: "Default token border",
        sourceName: "defaultBorderColorSource",
        colorName: "defaultBorderColor",
        currentMode: tokenDefaults.borderColorMode,
        currentColor: tokenDefaults.borderColor,
        currentSequenceRef: tokenDefaults.borderColorSequenceRef,
        sequences: colorSequences
      }),
      '  <p class="field-help">New tokens copy these defaults onto both faces.</p>',
      "</form>"
    ].join("");
  }


  function renderDefaultTextSettingsForm(textDefaults, colorSequences) {
    return [
      '<form class="form-grid" data-form="text-defaults">',
      '  <div class="field-row two-up">',
      '    <label class="field">Font family<select name="fontFamily">' + renderFontFamilyOptions(textDefaults.fontFamily) + "</select></label>",
      '    <label class="field">Font weight<select name="fontWeight">' + renderFontWeightOptions(textDefaults.fontWeight) + "</select></label>",
      "  </div>",
      renderColorPicker({
        label: "Default text color",
        sourceName: "defaultTextColorSource",
        colorName: "defaultTextColor",
        currentMode: textDefaults.colorMode,
        currentColor: textDefaults.color,
        currentSequenceRef: textDefaults.colorSequenceRef,
        sequences: colorSequences
      }),
      '<label class="field">Default text border<input type="number" min="0" max="8" step="0.1" name="defaultTextBorderWidth" value="' + textDefaults.textBorder.width + '"><span class="field-help">0 turns it off for new text components.</span></label>',
      renderColorPicker({
        label: "Default text border color",
        sourceName: "defaultTextBorderColorSource",
        colorName: "defaultTextBorderColor",
        currentMode: textDefaults.textBorder.colorMode,
        currentColor: textDefaults.textBorder.color,
        currentSequenceRef: textDefaults.textBorder.colorSequenceRef,
        sequences: colorSequences
      }),
      '  <p class="field-help">These defaults apply to newly created text components.</p>',
      "</form>"
    ].join("");
  }

  function renderImageImportSettingsForm(settings) {
    return [
      '<form class="form-grid" data-form="image-import-settings">',
      '  <label class="field">Trim alpha threshold<input type="number" min="1" max="255" step="1" name="imageTrimAlphaThreshold" value="' + settings.imageTrimAlphaThreshold + '"><span class="field-help">1 keeps any non-transparent pixel. Higher values ignore faint halos and shadows when trimming imports.</span></label>',
      '  <p class="field-help">Applies to new image uploads, replacements, background image uploads, and imported JSON image assets.</p>',
      "</form>"
    ].join("");
  }


  function renderBackgroundControls(config) {
    return [
      '<label class="field">Background type<select name="' + config.modeName + '">' + renderBackgroundModeOptions(config.currentMode) + "</select></label>",
      renderConditionalBlock(config.modeName + ":color", config.currentMode !== "image", renderColorPicker({
        label: config.colorLabel,
        sourceName: config.sourceName,
        colorName: config.colorName,
        currentMode: config.currentColorMode,
        currentColor: config.currentColor,
        currentSequenceRef: config.currentSequenceRef,
        sequences: config.sequences
      })),
      renderConditionalBlock(config.modeName + ":image", config.currentMode === "image", [
        '<div class="field">',
        '  <span>Background image</span>',
        '  <div class="button-row">',
        '    <button class="button" type="button" data-action="' + config.uploadAction + '">' + (config.imageSource ? "Replace Image" : "Upload Image") + "</button>",
        '    <button class="button" type="button" data-action="' + config.removeAction + '"' + (config.imageSource ? "" : " disabled") + ">Remove</button>",
        '    <input class="visually-hidden" type="file" accept="image/*" ' + config.inputAttributes + ">",
        "  </div>",
        '  <span class="field-help">' + escapeHtml(config.imageSource ? "Image selected. It fills the token and clips to the circle." : "No image selected yet.") + "</span>",
        "</div>"
      ].join(""))
    ].join("");
  }

  function renderBackgroundModeOptions(selectedValue) {
    return [
      '<option value="color"' + (selectedValue !== "image" ? " selected" : "") + ">Color</option>",
      '<option value="image"' + (selectedValue === "image" ? " selected" : "") + ">Image</option>"
    ].join("");
  }

  function renderColorPicker(config) {
    var sourceValue = config.currentMode === "sequence" && config.currentSequenceRef
      ? config.currentSequenceRef
      : "manual";
    var isManual = sourceValue === "manual";
    var summary = isManual
      ? (config.currentColor || "#000000")
      : "Sequence: " + getSequenceName(config.sequences, sourceValue);
    var swatch = isManual
      ? (config.currentColor || "#000000")
      : (config.currentColor || "#ffffff");

    return [
      '<div class="field color-picker-field">',
      '  <span>' + escapeHtml(config.label) + "</span>",
      '  <details class="color-picker" data-color-picker>',
      '    <summary class="color-picker-summary"><span class="color-picker-swatch" style="--swatch:' + escapeHtml(swatch) + '"></span><span>' + escapeHtml(summary) + "</span></summary>",
      '    <div class="color-picker-panel">',
      '      <label class="field">Color<select name="' + config.sourceName + '">' + renderColorSourceOptions(config.sequences, sourceValue) + "</select></label>",
      renderConditionalField(config.sourceName + ':manual', isManual, 'Custom color<input type="color" name="' + config.colorName + '" value="' + normalizeColorInput(config.currentColor) + '">'),
      "    </div>",
      "  </details>",
      "</div>"
    ].join("");
  }

  function renderColorSourceOptions(sequences, selectedValue) {
    return ['<option value="manual"' + (selectedValue === "manual" ? " selected" : "") + '>Manual</option>']
      .concat(sequences.map(function (sequence) {
        return '<option value="' + sequence.id + '"' + (selectedValue === sequence.id ? " selected" : "") + ">" + escapeHtml(sequence.name) + "</option>";
      }))
      .join("");
  }

  function getSettingsPanelHelpers() {
    return {
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
  }

  function getDesignerPanelHelpers() {
    return {
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
  }

  function getPrintPanelHelpers() {
    return {
      toNonNegativeNumberOrDefault: toNonNegativeNumberOrDefault,
      collectPrintSelectionRows: collectPrintSelectionRows,
      setPendingPrintFieldFocus: setPendingPrintFieldFocus
    };
  }

  function attachEvents(appElement, store) {
    SettingsPanel.bindForms(appElement, store, getSettingsPanelHelpers());
    SettingsPanel.bindTransferActions(appElement, store, getSettingsPanelHelpers());
    DesignerPanel.bindForms(appElement, store, getDesignerPanelHelpers());
    PrintPanel.bindForms(appElement, store, getPrintPanelHelpers());
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

    if (interaction.mode === "resize") {
      if (interaction.componentType === "image") {
        var startDimensions = Tokens.getImageDimensions(interaction.startRect);
        var widthRatio = (startDimensions.width / 2 + deltaX) / Math.max(startDimensions.width / 2, 0.001);
        var heightRatio = (startDimensions.height / 2 + deltaY) / Math.max(startDimensions.height / 2, 0.001);
        state.componentState = {
          x: interaction.startRect.x,
          y: interaction.startRect.y,
          scale: interaction.startRect.scale * Math.max(0.1, widthRatio, heightRatio),
          rotationDeg: interaction.startRect.rotationDeg
        };
      } else {
        state.componentState = {
          x: interaction.startRect.x,
          y: interaction.startRect.y,
          width: interaction.startRect.width + deltaX * 2,
          height: interaction.startRect.height + deltaY * 2
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

  function setFormFieldValue(form, name, value, fixedDigits) {
    var field = form.querySelector('[name="' + name + '"]');
    if (!field) {
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

  function restorePendingPrintFieldFocus(appElement) {
    if (!pendingPrintFieldFocus) {
      return;
    }

    var focusTarget = pendingPrintFieldFocus;
    pendingPrintFieldFocus = null;
    runtimeGlobal.requestAnimationFrame(function () {
      var nextField = appElement.querySelector('[data-form="print-selections"] [name="' + focusTarget.name + '"]');
      if (!nextField || typeof nextField.focus !== "function") {
        return;
      }
      nextField.focus({ preventScroll: true });
    });
  }

  function setPendingPrintFieldFocus(value) {
    pendingPrintFieldFocus = value;
  }

  function getDesignerSelection(state) {
    var token = state.project.tokens.find(function (candidate) {
      return candidate.id === state.ui.selectedTokenId;
    }) || state.project.tokens[0] || null;

    return {
      token: token,
      selectedComponentType: state.ui.selectedComponentType,
      selectedComponentId: state.ui.selectedComponentId
    };
  }

  function getSelectedComponent(face, type, componentId) {
    if (!face || !componentId) {
      return null;
    }

    if (type === "background") {
      return face;
    }

    if (type === "border") {
      return face.border || null;
    }

    return (type === "image" ? face.images : face.texts).find(function (component) {
      return component.id === componentId;
    }) || null;
  }

  function findToken(project, tokenId) {
    return project.tokens.find(function (token) {
      return token.id === tokenId;
    }) || null;
  }

  function findComponent(project, selection, type) {
    var token = findToken(project, selection.token.id);
    if (!token) {
      return null;
    }
    var face = token.front;
    if (type === "background") {
      return face;
    }
    if (type === "border") {
      return face.border || null;
    }
    var collection = type === "image" ? face.images : face.texts;
    return collection.find(function (component) {
      return component.id === selection.selectedComponentId;
    }) || null;
  }

  function applyBoundsFromForm(component, formData) {
    Tokens.updateComponentRect(component, {
      x: toNumberOrDefault(formData.get("x"), component.x),
      y: fromDisplayCenterY(formData.get("y"), component.y),
      width: toNumberOrDefault(formData.get("width"), component.width),
      height: toNumberOrDefault(formData.get("height"), component.height)
    });
  }

  function toDisplayCenterY(value) {
    return (-Number(value || 0)).toFixed(2);
  }

  function fromDisplayCenterY(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? -parsed : fallback;
  }

  function getImageImportOptions(project) {
    return {
      trimAlphaThreshold: project && project.settings ? project.settings.imageTrimAlphaThreshold : 1
    };
  }

  function collectPrintSelectionRows(printForm, project) {
    return Print.getSelectionRows(project).map(function (row) {
      return {
        tokenId: row.tokenId,
        copies: printForm.querySelector('[name="copies-' + row.tokenId + '"]').value,
        sequenceStart: printForm.querySelector('[name="start-' + row.tokenId + '"]').value
      };
    });
  }

  function upsertById(collection, value) {
    var index = collection.findIndex(function (candidate) {
      return candidate.id === value.id;
    });

    if (index >= 0) {
      collection[index] = value;
    } else {
      collection.push(value);
    }
  }

  function applyTokenDefaults(token, tokenDefaults) {
    if (!token || !tokenDefaults) {
      return;
    }

    token.diameterIn = tokenDefaults.diameterIn || token.diameterIn;
    applyTokenDefaultsToFace(token.front, tokenDefaults);
  }

  function applyTokenDefaultsToFace(face, tokenDefaults) {
    if (!face || !tokenDefaults) {
      return;
    }

    face.backgroundMode = tokenDefaults.backgroundMode === "image" ? "image" : "color";
    face.backgroundColorMode = tokenDefaults.backgroundColorMode === "sequence" ? "sequence" : "manual";
    face.backgroundColor = tokenDefaults.backgroundColor || face.backgroundColor;
    face.backgroundColorSequenceRef = tokenDefaults.backgroundColorSequenceRef || null;
    face.backgroundImageSource = tokenDefaults.backgroundImageSource || "";
    face.border.widthRatio = Number.isFinite(tokenDefaults.borderWidthRatio) ? tokenDefaults.borderWidthRatio : face.border.widthRatio;
    face.border.colorMode = tokenDefaults.borderColorMode === "sequence" ? "sequence" : "manual";
    face.border.color = tokenDefaults.borderColor || face.border.color;
    face.border.colorSequenceRef = tokenDefaults.borderColorSequenceRef || null;
  }

  function bindBackgroundUploadControls(container, config) {
    var input = container.querySelector(config.inputSelector);

    if (input) {
      input.addEventListener("change", async function () {
        var file = input.files && input.files[0];
        if (!file) {
          return;
        }
        try {
          var imageAsset = await Utils.readImageAssetFile(file, config.importOptions || {});
          config.onUpload(imageAsset);
        } catch (error) {
          runtimeGlobal.alert("Image import failed.");
          console.error(error);
        } finally {
          input.value = "";
        }
      });
    }
  }

  function renderColorSequenceManager(sequences, selectedSequence, editingSequence) {
    return renderSequenceManager({
      selectedName: "selectedColorSequenceId",
      selectedSequence: selectedSequence,
      sequences: sequences,
      summary: selectedSequence
        ? Sequences.summarizeColorSequence(selectedSequence)
        : (sequences.length ? "Select a custom sequence to edit it in the drawer." : "No custom color sequences yet."),
      helperText: "Built-in color sequences stay available in token settings and are not edited here.",
      newAction: "new-color-sequence",
      isEditing: !!editingSequence
    });
  }

  function renderSequenceManager(config) {
    var selectedSequence = config.selectedSequence;
    return [
      '<div class="sequence-manager">',
      '  <label class="field">Custom sequence<select name="' + config.selectedName + '">' + renderSequenceOptions(config.sequences, selectedSequence ? selectedSequence.id : null, "Select a custom sequence", { grouped: false }) + "</select></label>",
      '  <p class="sequence-summary">' + escapeHtml(config.summary) + "</p>",
      '  <p class="field-help">' + escapeHtml(config.helperText) + "</p>",
      '  <div class="button-row">',
      '    <button class="button button-primary" type="button" data-action="' + config.newAction + '">New Custom</button>',
      config.isEditing ? '    <span class="field-help">Editing in drawer</span>' : "",
      "  </div>",
      "</div>"
    ].join("");
  }

  function renderColorSequenceForm(sequence) {
    return [
      '<form class="form-grid" data-form="color-sequence">',
      '  <input type="hidden" name="id" value="' + escapeHtml(sequence ? sequence.id : "") + '">',
      '  <label class="field">Name<input name="name" value="' + escapeHtml(sequence ? sequence.name : "") + '" required></label>',
      '  <label class="field">Color values<textarea name="valuesText" required>' + escapeHtml(sequence ? sequence.values.join("\n") : "#8a1c1c\n#3b5b92") + '</textarea><span class="field-help">One hex color per line.</span></label>',
      '  <p class="field-help">Changes save automatically when you leave a field.</p>',
      "</form>"
    ].join("");
  }

  function renderTextContentModeOptions(currentValue) {
    return [
      { id: "numeric", label: "Number Sequence" },
      { id: "alphabetic", label: "Alphabet Sequence" },
      { id: "custom", label: "Custom Text" }
    ].map(function (option) {
      return '<option value="' + option.id + '"' + (currentValue === option.id ? " selected" : "") + ">" + option.label + "</option>";
    }).join("");
  }

  function renderFontWeightOptions(currentValue) {
    return ["400", "500", "600", "700", "800"].map(function (value) {
      return '<option value="' + value + '"' + (currentValue === value ? " selected" : "") + ">" + value + "</option>";
    }).join("");
  }

  function renderFontFamilyOptions(currentValue) {
    var options = FONT_CHOICES.slice();
    if (currentValue && !options.some(function (option) { return option.value === currentValue; })) {
      options.push({ value: currentValue, label: currentValue });
    }

    return options.map(function (option) {
      return '<option value="' + escapeHtml(option.value) + '"' + (currentValue === option.value ? " selected" : "") + ">" + escapeHtml(option.label) + "</option>";
    }).join("");
  }

  function renderSequenceOptions(sequences, selectedId, emptyLabel, options) {
    var opts = options || {};
    var builtIns = sequences.filter(function (sequence) {
      return sequence.builtIn;
    });
    var custom = sequences.filter(function (sequence) {
      return !sequence.builtIn;
    });

    if (opts.grouped === false) {
      return ['<option value="">' + emptyLabel + "</option>"].concat(sequences.map(function (sequence) {
        return '<option value="' + sequence.id + '"' + (selectedId === sequence.id ? " selected" : "") + ">" + escapeHtml(sequence.name) + "</option>";
      })).join("");
    }

    return ['<option value="">' + emptyLabel + "</option>"]
      .concat(renderSequenceOptionGroup("Built-in", builtIns, selectedId))
      .concat(renderSequenceOptionGroup("Custom", custom, selectedId))
      .join("");
  }

  function renderSequenceOptionGroup(label, sequences, selectedId) {
    if (!sequences.length) {
      return [];
    }

    var options = sequences.map(function (sequence) {
      return '<option value="' + sequence.id + '"' + (selectedId === sequence.id ? " selected" : "") + ">" + escapeHtml(sequence.name) + "</option>";
    }).join("");

    return [label ? '<optgroup label="' + label + '">' + options + "</optgroup>" : options];
  }

  function getSelectedSequence(sequences, selectedId) {
    return sequences.find(function (sequence) {
      return sequence.id === selectedId;
    }) || sequences[0] || null;
  }

  function getSequenceName(sequences, selectedId) {
    var sequence = sequences.find(function (candidate) {
      return candidate.id === selectedId;
    });
    return sequence ? sequence.name : "No sequence";
  }

  function mount() {
    var appElement = document.getElementById("app");
    var store = State.createStore({ storage: runtimeGlobal.localStorage });
    mountedStore = store;
    bindDelegatedAppHandlers(appElement);
    store.subscribe(function () {
      render(appElement, store);
    });
    bindGlobalPointerHandlers();
    bindGlobalResizeHandlers(appElement);
    render(appElement, store);
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
    document.addEventListener("DOMContentLoaded", mount);
  }

  return {
    mount: mount
  };
});
