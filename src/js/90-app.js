(function (global, factory) {
  var api = factory(
    global.MonsterMintSchema,
    global.MonsterMintState,
    global.MonsterMintSequences,
    global.MonsterMintUtils,
    global.MonsterMintTokens,
    global.MonsterMintRenderer,
    global.MonsterMintPrint
  );
  global.MonsterMintApp = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (Schema, State, Sequences, Utils, Tokens, Renderer, Print) {
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
  var activePrintFrame = null;
  var designerWheelPersistTimer = null;

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
    var customColorSequences = state.project.sequences.color.filter(function (sequence) {
      return !sequence.builtIn;
    });
    var selectedColorSequence = getSelectedSequence(customColorSequences, state.ui.selectedColorSequenceId);
    var editingColorSequence = customColorSequences.find(function (sequence) {
      return sequence.id === state.ui.editingColorSequenceId;
    }) || null;
    var settingsDrawer = getSettingsDrawer(editingColorSequence);
    return [
      '<div class="settings-shell' + (settingsDrawer ? " has-drawer" : "") + '">',
      '  <div class="settings-main">',
      '    <div class="panel-grid settings-grid">',
      '      <section class="panel-card">',
      "    <h2>Default Text</h2>",
      renderDefaultTextSettingsForm(state.project.settings.textDefaults, state.project.sequences.color),
      "      </section>",
      '      <section class="panel-card">',
      "    <h2>Color Sequences</h2>",
      renderColorSequenceManager(customColorSequences, selectedColorSequence, editingColorSequence),
      "      </section>",
      "    </div>",
      "  </div>",
      settingsDrawer ? renderSettingsDrawer(settingsDrawer) : "",
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

  function renderSettingsDrawer(drawer) {
    return [
      '<aside class="editor-drawer settings-drawer" data-drawer="settings">',
      '  <div class="drawer-header">',
      '    <div>',
      '      <p class="drawer-eyebrow">Settings</p>',
      '      <h2>' + escapeHtml(drawer.title) + "</h2>",
      "    </div>",
      '    <button class="button" type="button" data-action="close-settings-drawer">Close</button>',
      "  </div>",
      '  <div class="drawer-body">',
      renderColorSequenceForm(drawer.sequence),
      '    <div class="button-row drawer-actions">',
      '      <button class="button" type="button" data-action="delete-selected-' + drawer.kind + '-sequence" data-sequence-id="' + drawer.sequence.id + '">Delete Sequence</button>',
      "    </div>",
      "  </div>",
      "</aside>"
    ].join("");
  }

  function renderDesignerPanel(state) {
    var selection = getDesignerSelection(state);
    var token = selection.token;

    if (!token) {
      return [
        '<div class="empty-state designer-placeholder">',
        "  <h2>No token templates yet</h2>",
        "  <p>Create a token to start placing images and text blocks.</p>",
        '  <div class="button-row" style="justify-content:center">',
        '    <button class="button button-primary" type="button" data-action="add-token">Create Token</button>',
        "  </div>",
        "</div>"
      ].join("");
    }

    var face = token[selection.faceName];
    var selectedComponent = getSelectedComponent(face, selection.selectedComponentType, selection.selectedComponentId);
    var componentItems = getComponentItems(face, selection.faceName);
    return [
      '<div class="designer-shell">',
      '  <section class="designer-main">',
      '    <section class="panel-card designer-toolbar-card">',
      '      <div class="designer-toolbar">',
      '        <div class="designer-toolbar-row">',
      '          <label class="field toolbar-field">Token<select name="selectedTokenId">' + renderTokenOptions(state.project.tokens, token.id) + '</select></label>',
      '          <div class="button-row">',
      '            <button class="button button-primary" type="button" data-action="add-token">New Token</button>',
      '            <button class="button" type="button" data-action="clone-token" data-token-id="' + token.id + '">Clone</button>',
      '            <button class="button" type="button" data-action="delete-token" data-token-id="' + token.id + '">Delete</button>',
      "          </div>",
      '          <div class="face-toggle">',
      '            <button type="button" class="' + (selection.faceName === "front" ? "is-active" : "") + '" data-face="front">Front</button>',
      '            <button type="button" class="' + (selection.faceName === "back" ? "is-active" : "") + '" data-face="back">Back</button>',
      "          </div>",
      "        </div>",
      '        <div class="designer-toolbar-row component-row">',
      '          <label class="field toolbar-field">Component<select name="selectedComponentKey">' + renderComponentOptions(componentItems, selection.selectedComponentType, selection.selectedComponentId) + '</select></label>',
      '          <div class="button-row">',
      '            <button class="button" type="button" data-action="add-text" data-face="' + selection.faceName + '">Add Text</button>',
      '            <button class="button" type="button" data-action="add-image" data-face="' + selection.faceName + '">Add Image</button>',
      '            <button class="button icon-trash" type="button" data-action="delete-component"' + (canDeleteSelectedComponent(selection) ? "" : " disabled") + ' aria-label="Delete Selected Component" title="Delete Selected Component"><span aria-hidden="true">&#128465;</span></button>',
      '            <input class="visually-hidden" type="file" accept="image/*" data-image-upload-input>',
      "          </div>",
      "        </div>",
      "      </div>",
      "    </section>",
      '    <section class="panel-card preview-shell">',
      '      <div class="preview-stage" data-preview-stage>',
      Renderer.renderTokenSvg(token, state.project, {
        face: selection.faceName,
        sequenceIndex: 0,
        interactive: true,
        selectedComponentType: selection.selectedComponentType,
        selectedComponentId: selection.selectedComponentId
      }),
      "      </div>",
      '      <p class="preview-note">Drag visible content to move it. Resize from the lower-right handle, rotate images from the top handle, or use the mouse wheel to scale the selected component.</p>',
      "    </section>",
      "  </section>",
      '  <aside class="editor-drawer designer-drawer">',
      '    <div class="drawer-header">',
      '      <div>',
      '        <p class="drawer-eyebrow">Designer</p>',
      '        <h2>' + escapeHtml(token.name) + "</h2>",
      "      </div>",
      "    </div>",
      '    <div class="drawer-body">',
      '      <section class="drawer-section">',
      "        <h3>" + (selectedComponent ? "Selected Component" : "Token") + "</h3>",
      (selectedComponent ? renderSelectedComponentForm(selectedComponent, selection, state.project) : renderTokenForm(token, state.project, selection.faceName)),
      "      </section>",
      "    </div>",
      "  </aside>",
      "</div>"
    ].join("");
  }

  function renderPrintPanel(state) {
    var rows = Print.getSelectionRows(state.project);
    var layout = Print.layoutProject(state.project);
    var activePreviewPage = Math.min(state.ui.selectedPrintPreviewPage || 0, Math.max(0, layout.pages.length - 1));
    return [
      '<div class="print-layout">',
      '  <section class="panel-card">',
      "    <h2>Print Settings</h2>",
      renderPageSettingsForm(state.project.settings),
      "  </section>",
      '  <section class="panel-card">',
      "    <h2>Print Selections</h2>",
      renderPrintSelectionForm(rows),
      "  </section>",
      '  <section class="panel-card">',
      '    <div class="panel-header">',
      "      <h2>Preview</h2>",
      '      <button class="button button-primary" type="button" data-action="print-layout">Print</button>',
      "    </div>",
      layout.pages.length && layout.pages[0].items.length
        ? renderPreviewTabs(layout, state.project, activePreviewPage)
        : '<div class="empty-state">Choose at least one token copy to generate pages.</div>',
      "  </section>",
      "</div>"
    ].join("");
  }

  function renderTokenOptions(tokens, selectedTokenId) {
    return tokens.map(function (token) {
      return '<option value="' + token.id + '"' + (token.id === selectedTokenId ? " selected" : "") + ">" + escapeHtml(token.name) + " (" + token.diameterIn + '&quot;)</option>';
    }).join("");
  }

  function getComponentItems(face, faceName) {
    return face.images.map(function (component) {
      return { type: "image", id: component.id, label: component.name || "Image" };
    }).concat(face.texts.map(function (component) {
      return {
        type: "text",
        id: component.id,
        label: component.name || "Text"
      };
    }));
  }

  function renderComponentOptions(items, selectedType, selectedId) {
    return ['<option value="">' + "Token settings" + "</option>"].concat(items.map(function (item) {
      var isSelected = selectedType === item.type && selectedId === item.id;
      return '<option value="' + item.type + ":" + item.id + '"' + (isSelected ? " selected" : "") + ">" + escapeHtml(item.label) + "</option>";
    })).join("");
  }

  function canDeleteSelectedComponent(selection) {
    return selection.selectedComponentType === "image" || selection.selectedComponentType === "text";
  }

  function renderTokenForm(token, project, faceName) {
    var face = token[faceName];
    return [
      '<form class="form-grid" data-form="token-settings">',
      '  <label class="field">Name<input name="name" value="' + escapeHtml(token.name) + '" required></label>',
      '  <div class="field-row two-up">',
      '    <label class="field">Diameter<select name="diameterIn">' + Schema.TOKEN_SIZES.map(function (size) {
        return '<option value="' + size + '"' + (size === token.diameterIn ? " selected" : "") + ">" + size + '&quot;</option>';
      }).join("") + "</select></label>",
      '    <label class="field">Back face<select name="backEnabled"><option value="true"' + (token.back.enabled ? " selected" : "") + '>Enabled</option><option value="false"' + (!token.back.enabled ? " selected" : "") + '>Disabled</option></select></label>',
      "  </div>",
      '  <label class="field checkbox-field"><input type="checkbox" name="borderUnderContent"' + (token.borderUnderContent ? " checked" : "") + '>Render border under images and text</label>',
      '  <p class="field-help">Editing ' + escapeHtml(faceName === "front" ? "front" : "back") + ' face appearance.</p>',
      renderColorPicker({
        label: "Background",
        sourceName: "backgroundColorSource",
        colorName: "backgroundColor",
        currentMode: face.backgroundColorMode,
        currentColor: face.backgroundColor,
        currentSequenceRef: face.backgroundColorSequenceRef,
        sequences: project.sequences.color
      }),
      '  <label class="field">Border width<input type="range" min="0" max="0.25" step="0.01" name="borderWidthRatio" value="' + face.border.widthRatio.toFixed(2) + '"><span class="field-help">' + Math.round(face.border.widthRatio * 100) + '% of token width</span></label>',
      renderColorPicker({
        label: "Token border",
        sourceName: "borderColorSource",
        colorName: "borderColor",
        currentMode: face.border.colorMode,
        currentColor: face.border.color,
        currentSequenceRef: face.border.colorSequenceRef,
        sequences: project.sequences.color
      }),
      '  <p class="field-help">Changes save automatically.</p>',
      "</form>"
    ].join("");
  }

  function renderSelectedComponentForm(component, selection, project) {
    if (!component) {
      return '<div class="empty-state">Select a component to edit it.</div>';
    }

    if (selection.selectedComponentType === "text") {
      return renderTextComponentForm(component, project);
    }

    return renderImageComponentForm(component);
  }

  function renderTextComponentForm(component, project) {
    return [
      '<form class="form-grid" data-form="text-component-settings">',
      '  <label class="field">Label<input name="name" value="' + escapeHtml(component.name || "Text") + '"></label>',
      '  <label class="field">Content mode<select name="contentMode">' + renderTextContentModeOptions(component.contentMode) + "</select></label>",
      renderConditionalField("contentMode:custom", component.contentMode === "custom", 'Text<input name="customText" value="' + escapeHtml(component.customText) + '">'),
      renderConditionalBlock("contentMode:numeric|alphabetic", component.contentMode === "numeric" || component.contentMode === "alphabetic", [
        '<div class="field-row two-up">',
        '  <label class="field">Start<input type="number" step="1" name="sequenceStart" value="' + component.sequenceStart + '"></label>',
        component.contentMode === "numeric"
          ? '  <label class="field">Pad<input type="number" min="0" step="1" name="sequencePad" value="' + component.sequencePad + '"></label>'
          : "  <div></div>",
        "</div>"
      ].join("")),
      '  <div class="field-row two-up">',
      '    <label class="field">Font family<select name="fontFamily">' + renderFontFamilyOptions(component.fontFamily) + "</select></label>",
      '    <label class="field">Font weight<select name="fontWeight">' + renderFontWeightOptions(component.fontWeight) + "</select></label>",
      "  </div>",
      renderColorPicker({
        label: "Text color",
        sourceName: "colorSource",
        colorName: "color",
        currentMode: component.colorMode,
        currentColor: component.color,
        currentSequenceRef: component.colorSequenceRef,
        sequences: project.sequences.color
      }),
      renderBoundsFields(component),
      renderTextBorderFields(component.textBorder, project),
      '  <p class="field-help">Changes save automatically.</p>',
      "</form>"
    ].join("");
  }

  function renderImageComponentForm(component) {
    return [
      '<form class="form-grid" data-form="image-component-settings">',
      '  <label class="field">Label<input name="name" value="' + escapeHtml(component.name) + '"></label>',
      renderPositionFields(component),
      '  <label class="field">Scale<input type="range" min="0.05" max="2" step="0.01" name="scale" value="' + component.scale.toFixed(2) + '"><span class="field-help">' + Math.round(component.scale * 100) + '% of max circle diameter</span></label>',
      '  <label class="field">Rotation<input type="range" min="0" max="360" step="1" name="rotationDeg" value="' + Math.round(Number(component.rotationDeg || 0)) + '"><span class="field-help">' + Math.round(Number(component.rotationDeg || 0)) + '&deg; clockwise</span></label>',
      '  <div class="field-row two-up">',
      '    <label class="field checkbox-field"><input type="checkbox" name="mirrorX"' + (component.mirrorX ? " checked" : "") + '>Mirror horizontally</label>',
      '    <label class="field checkbox-field"><input type="checkbox" name="mirrorY"' + (component.mirrorY ? " checked" : "") + '>Mirror vertically</label>',
      "  </div>",
      '  <div class="button-row">',
      '    <button class="button" type="button" data-action="replace-image">Replace Image</button>',
      '    <input class="visually-hidden" type="file" accept="image/*" data-replace-image-input>',
      '    <span class="field-help">Changes save automatically.</span>',
      "  </div>",
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

  function renderPositionFields(component) {
    return [
      '<div class="field-row two-up">',
      '  <label class="field">Center X<input type="number" step="0.01" name="x" value="' + component.x.toFixed(2) + '"></label>',
      '  <label class="field">Center Y<input type="number" step="0.01" name="y" value="' + component.y.toFixed(2) + '"></label>',
      "</div>",
      '  <p class="field-help">0, 0 is the center of the token.</p>'
    ].join("");
  }

  function renderBoundsFields(component) {
    return [
      renderPositionFields(component),
      '<div class="field-row two-up">',
      '  <label class="field">Width<input type="number" min="0.05" max="2.5" step="0.01" name="width" value="' + component.width.toFixed(2) + '"></label>',
      '  <label class="field">Height<input type="number" min="0.05" max="2.5" step="0.01" name="height" value="' + component.height.toFixed(2) + '"></label>',
      "</div>"
    ].join("");
  }

  function renderTextBorderFields(textBorder, project) {
    return [
      '<label class="field">Text border<input type="number" min="0" max="8" step="0.1" name="textBorderWidth" value="' + textBorder.width + '"><span class="field-help">0 turns it off.</span></label>',
      renderColorPicker({
        label: "Text border color",
        sourceName: "textBorderColorSource",
        colorName: "textBorderColor",
        currentMode: textBorder.colorMode,
        currentColor: textBorder.color,
        currentSequenceRef: textBorder.colorSequenceRef,
        sequences: project.sequences.color
      })
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

  function attachEvents(appElement, store) {
    appElement.querySelectorAll("[data-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        store.setActiveTab(button.getAttribute("data-tab"));
      });
    });

    var settingsButton = appElement.querySelector("[data-action='open-settings']");
    if (settingsButton) {
      settingsButton.addEventListener("click", function () {
        store.setActiveTab("settings");
      });
    }

    var resetButton = appElement.querySelector("[data-action='reset-project']");
    if (resetButton) {
      resetButton.addEventListener("click", function () {
        if (!runtimeGlobal.confirm("Reset the current project? This clears saved tokens and sequences.")) {
          return;
        }

        store.replaceProject(Schema.createDefaultProject());
        store.updateUi(function (ui) {
          ui.editingTextSequenceId = null;
          ui.editingColorSequenceId = null;
          ui.selectedTextSequenceId = null;
          ui.selectedColorSequenceId = null;
          ui.selectedTokenId = null;
          ui.selectedComponentType = null;
          ui.selectedComponentId = null;
          ui.selectedFace = "front";
          ui.selectedPrintPreviewPage = 0;
        });
      });
    }

    bindSettingsForms(appElement, store);
    bindTransferActions(appElement, store);
    bindDesignerEvents(appElement, store);
    bindPrintEvents(appElement, store);
  }

  function bindSettingsForms(appElement, store) {
    var textDefaultsForm = appElement.querySelector("[data-form='text-defaults']");
    if (textDefaultsForm) {
      var syncTextDefaultVisibility = function () {
        syncConditionalFields(textDefaultsForm, {
          defaultTextColorSource: textDefaultsForm.querySelector('[name="defaultTextColorSource"]').value,
          defaultTextBorderColorSource: textDefaultsForm.querySelector('[name="defaultTextBorderColorSource"]').value
        });
      };
      textDefaultsForm.querySelectorAll('select[name="defaultTextColorSource"], select[name="defaultTextBorderColorSource"]').forEach(function (element) {
        element.addEventListener("change", syncTextDefaultVisibility);
      });
      syncTextDefaultVisibility();

      textDefaultsForm.addEventListener("change", function () {
        var formData = new FormData(textDefaultsForm);
        var textColorSelection = parseColorSourceValue(formData.get("defaultTextColorSource"));
        var textBorderColorSelection = parseColorSourceValue(formData.get("defaultTextBorderColorSource"));
        store.updateProject(function (project) {
          project.settings.textDefaults.fontFamily = String(formData.get("fontFamily") || project.settings.textDefaults.fontFamily);
          project.settings.textDefaults.fontWeight = String(formData.get("fontWeight") || project.settings.textDefaults.fontWeight);
          project.settings.textDefaults.colorMode = textColorSelection.mode;
          project.settings.textDefaults.color = String(formData.get("defaultTextColor") || project.settings.textDefaults.color);
          project.settings.textDefaults.colorSequenceRef = textColorSelection.sequenceRef;
          project.settings.textDefaults.textBorder.width = toNonNegativeNumberOrDefault(formData.get("defaultTextBorderWidth"), project.settings.textDefaults.textBorder.width);
          project.settings.textDefaults.textBorder.colorMode = textBorderColorSelection.mode;
          project.settings.textDefaults.textBorder.color = String(formData.get("defaultTextBorderColor") || project.settings.textDefaults.textBorder.color);
          project.settings.textDefaults.textBorder.colorSequenceRef = textBorderColorSelection.sequenceRef;
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
          upsertById(project.sequences.color, sequence);
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
          ui.editingTextSequenceId = null;
        });
      });
    }

    var newColorSequenceButton = appElement.querySelector('[data-action="new-color-sequence"]');
    if (newColorSequenceButton) {
      newColorSequenceButton.addEventListener("click", function () {
        var sequence = Sequences.createColorSequence({
          name: "New color sequence",
          valuesText: "#8a1c1c\n#3b5b92"
        });
        store.updateProject(function (project) {
          project.sequences.color.push(sequence);
        });
        store.updateUi(function (ui) {
          ui.selectedColorSequenceId = sequence.id;
          ui.editingColorSequenceId = sequence.id;
          ui.editingTextSequenceId = null;
        });
      });
    }

    var deleteSelectedColorButton = appElement.querySelector('[data-action="delete-selected-color-sequence"]');
    if (deleteSelectedColorButton) {
      deleteSelectedColorButton.addEventListener("click", function () {
        var sequenceId = deleteSelectedColorButton.getAttribute("data-sequence-id");
        if (!sequenceId) {
          return;
        }
        store.updateProject(function (project) {
          project.sequences.color = project.sequences.color.filter(function (sequence) {
            return sequence.id !== sequenceId;
          });
        });
        store.updateUi(function (ui) {
          ui.editingColorSequenceId = null;
          ui.editingTextSequenceId = null;
          if (ui.selectedColorSequenceId === sequenceId) {
            ui.selectedColorSequenceId = null;
          }
        });
      });
    }

    var closeDrawerButton = appElement.querySelector('[data-action="close-settings-drawer"]');
    if (closeDrawerButton) {
      closeDrawerButton.addEventListener("click", function () {
        store.updateUi(function (ui) {
          ui.editingTextSequenceId = null;
          ui.editingColorSequenceId = null;
        });
      });
    }
  }

  function bindTransferActions(appElement, store) {
    var exportButton = appElement.querySelector("[data-action='export-project']");
    if (exportButton) {
      exportButton.addEventListener("click", function () {
        var state = store.getState();
        var safeName = state.project.meta && state.project.meta.name && state.project.meta.name !== "Untitled Project"
          ? state.project.meta.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
          : "monster-mint";
        Utils.downloadTextFile((safeName || "monster-mint") + ".json", JSON.stringify(state.project, null, 2));
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
            ui.selectedTextSequenceId = null;
            ui.selectedColorSequenceId = null;
            ui.selectedTokenId = null;
            ui.selectedComponentType = null;
            ui.selectedComponentId = null;
            ui.selectedFace = "front";
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
  }

  function bindDesignerEvents(appElement, store) {
    appElement.querySelectorAll("[data-action='add-token']").forEach(function (button) {
      button.addEventListener("click", function () {
        var token = Tokens.createTokenTemplate({});
        store.updateProject(function (project) {
          project.tokens.push(token);
        });
        store.updateUi(function (ui) {
          ui.activeTab = "designer";
          ui.selectedTokenId = token.id;
          ui.selectedComponentType = null;
          ui.selectedComponentId = null;
          ui.selectedFace = "front";
        });
      });
    });

    appElement.querySelectorAll("[data-action='clone-token']").forEach(function (button) {
      button.addEventListener("click", function () {
        var tokenId = button.getAttribute("data-token-id");
        var sourceToken = findToken(store.getState().project, tokenId);
        if (!sourceToken) {
          return;
        }
        var token = Tokens.cloneTokenTemplate(sourceToken);
        store.updateProject(function (project) {
          project.tokens.push(token);
        });
        store.updateUi(function (ui) {
          ui.activeTab = "designer";
          ui.selectedTokenId = token.id;
          ui.selectedComponentType = null;
          ui.selectedComponentId = null;
        });
      });
    });

    var selectedTokenField = appElement.querySelector('[name="selectedTokenId"]');
    if (selectedTokenField) {
      selectedTokenField.addEventListener("change", function () {
        store.updateUi(function (ui) {
          ui.selectedTokenId = selectedTokenField.value || null;
          ui.selectedComponentType = null;
          ui.selectedComponentId = null;
        });
      });
    }

    appElement.querySelectorAll("[data-action='delete-token']").forEach(function (button) {
      button.addEventListener("click", function () {
        var tokenId = button.getAttribute("data-token-id");
        if (!runtimeGlobal.confirm("Delete the selected token?")) {
          return;
        }
        store.updateProject(function (project) {
          project.tokens = project.tokens.filter(function (token) {
            return token.id !== tokenId;
          });
        });
        store.updateUi(function (ui) {
          ui.selectedTokenId = ui.selectedTokenId === tokenId ? null : ui.selectedTokenId;
          ui.selectedComponentType = null;
          ui.selectedComponentId = null;
        });
      });
    });

    appElement.querySelectorAll("[data-face]").forEach(function (button) {
      button.addEventListener("click", function () {
        var faceName = button.getAttribute("data-face");
        store.updateUi(function (ui) {
          ui.selectedFace = faceName;
          ui.selectedComponentType = null;
          ui.selectedComponentId = null;
        });
      });
    });

    var tokenForm = appElement.querySelector("[data-form='token-settings']");
    if (tokenForm) {
      tokenForm.querySelectorAll('select[name="backgroundColorSource"], select[name="borderColorSource"]').forEach(function (element) {
        element.addEventListener("change", function () {
          syncConditionalFields(tokenForm, {
            backgroundColorSource: tokenForm.querySelector('[name="backgroundColorSource"]').value,
            borderColorSource: tokenForm.querySelector('[name="borderColorSource"]').value
          });
        });
      });
      syncConditionalFields(tokenForm, {
        backgroundColorSource: tokenForm.querySelector('[name="backgroundColorSource"]').value,
        borderColorSource: tokenForm.querySelector('[name="borderColorSource"]').value
      });
      tokenForm.addEventListener("change", function () {
        var selection = getDesignerSelection(store.getState());
        if (!selection.token) {
          return;
        }
        var formData = new FormData(tokenForm);
        store.updateProject(function (project) {
          var token = findToken(project, selection.token.id);
          var face = token[selection.faceName];
          var backgroundColorSelection = parseColorSourceValue(formData.get("backgroundColorSource"));
          var borderColorSelection = parseColorSourceValue(formData.get("borderColorSource"));
          token.name = String(formData.get("name")) || token.name;
          token.diameterIn = Number(formData.get("diameterIn")) || token.diameterIn;
          token.back.enabled = String(formData.get("backEnabled")) === "true";
          token.borderUnderContent = formData.get("borderUnderContent") === "on";
          face.backgroundColorMode = backgroundColorSelection.mode;
          face.backgroundColor = String(formData.get("backgroundColor") || face.backgroundColor);
          face.backgroundColorSequenceRef = backgroundColorSelection.sequenceRef;
          face.border.widthRatio = toNumberOrDefault(formData.get("borderWidthRatio"), face.border.widthRatio);
          face.border.colorMode = borderColorSelection.mode;
          face.border.color = String(formData.get("borderColor") || face.border.color);
          face.border.colorSequenceRef = borderColorSelection.sequenceRef;
        });
      });
    }

    appElement.querySelectorAll("[data-action='add-text']").forEach(function (button) {
      button.addEventListener("click", function () {
        var selection = getDesignerSelection(store.getState());
        if (!selection.token) {
          return;
        }
        var face = selection.token[selection.faceName];
        var textDefaults = store.getState().project.settings.textDefaults;
        var component = Tokens.createTextComponent({
          name: "Text #" + (face.texts.length + 1),
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
        store.updateProject(function (project) {
          var token = findToken(project, selection.token.id);
          token[selection.faceName].texts.push(component);
        });
        store.updateUi(function (ui) {
          ui.selectedComponentType = "text";
          ui.selectedComponentId = component.id;
        });
      });
    });

    var addImageInput = appElement.querySelector("[data-image-upload-input]");
    appElement.querySelectorAll("[data-action='add-image']").forEach(function (button) {
      button.addEventListener("click", function () {
        if (addImageInput) {
          addImageInput.click();
        }
      });
    });

    if (addImageInput) {
      addImageInput.addEventListener("change", async function () {
        var file = addImageInput.files && addImageInput.files[0];
        var selection = getDesignerSelection(store.getState());
        if (!file || !selection.token) {
          return;
        }
        try {
          var imageAsset = await Utils.readImageAssetFile(file);
          var component = Tokens.createImageComponent({
            source: imageAsset.source,
            name: file.name,
            aspectRatio: imageAsset.width / imageAsset.height
          });
          store.updateProject(function (project) {
            var token = findToken(project, selection.token.id);
            token[selection.faceName].images.push(component);
          });
          store.updateUi(function (ui) {
            ui.selectedComponentType = "image";
            ui.selectedComponentId = component.id;
          });
        } catch (error) {
          runtimeGlobal.alert("Image import failed.");
          console.error(error);
        } finally {
          addImageInput.value = "";
        }
      });
    }

    var selectedComponentField = appElement.querySelector('[name="selectedComponentKey"]');
    if (selectedComponentField) {
      selectedComponentField.addEventListener("change", function () {
        var parts = selectedComponentField.value.split(":");
        store.updateUi(function (ui) {
          ui.selectedComponentType = parts[0] || null;
          ui.selectedComponentId = parts[0] ? parts.slice(1).join(":") : null;
        });
      });
    }

    var deleteComponentButton = appElement.querySelector("[data-action='delete-component']");
    if (deleteComponentButton) {
      deleteComponentButton.addEventListener("click", function () {
        var selection = getDesignerSelection(store.getState());
        if (!selection.token || !selection.selectedComponentId || !canDeleteSelectedComponent(selection)) {
          return;
        }
        store.updateProject(function (project) {
          var token = findToken(project, selection.token.id);
          var face = token[selection.faceName];
          face.images = face.images.filter(function (component) {
            return component.id !== selection.selectedComponentId;
          });
          face.texts = face.texts.filter(function (component) {
            return component.id !== selection.selectedComponentId;
          });
        });
        store.updateUi(function (ui) {
          ui.selectedComponentType = null;
          ui.selectedComponentId = null;
        });
      });
    }

    var textComponentForm = appElement.querySelector("[data-form='text-component-settings']");
    if (textComponentForm) {
      var syncTextComponentVisibility = function () {
        var contentModeField = textComponentForm.querySelector('[name="contentMode"]');
        var colorSourceField = textComponentForm.querySelector('[name="colorSource"]');
        var textBorderColorSourceField = textComponentForm.querySelector('[name="textBorderColorSource"]');
        syncConditionalFields(textComponentForm, {
          contentMode: contentModeField ? contentModeField.value : null,
          colorSource: colorSourceField ? colorSourceField.value : null,
          textBorderColorSource: textBorderColorSourceField ? textBorderColorSourceField.value : null
        });
      };
      textComponentForm.querySelectorAll('select[name="contentMode"], select[name="colorSource"], select[name="textBorderColorSource"]').forEach(function (element) {
        element.addEventListener("change", syncTextComponentVisibility);
      });
      syncTextComponentVisibility();

      textComponentForm.addEventListener("change", function () {
        var selection = getDesignerSelection(store.getState());
        if (!selection.token || selection.selectedComponentType !== "text") {
          return;
        }
        var formData = new FormData(textComponentForm);
        store.updateProject(function (project) {
          var component = findComponent(project, selection, "text");
          if (!component) {
            return;
          }
          var textColorSelection = parseColorSourceValue(formData.get("colorSource"));
          var textBorderColorSelection = parseColorSourceValue(formData.get("textBorderColorSource"));
          component.name = String(formData.get("name") || component.name);
          component.contentMode = String(formData.get("contentMode"));
          component.customText = String(formData.get("customText") || "");
          component.sequenceStart = toIntegerOrDefault(formData.get("sequenceStart"), component.sequenceStart);
          component.sequencePad = toNonNegativeInteger(formData.get("sequencePad"), component.sequencePad);
          component.fontFamily = String(formData.get("fontFamily") || component.fontFamily);
          component.fontWeight = String(formData.get("fontWeight") || component.fontWeight);
          component.colorMode = textColorSelection.mode;
          component.color = String(formData.get("color") || component.color);
          component.colorSequenceRef = textColorSelection.sequenceRef;
          applyBoundsFromForm(component, formData);
          component.textBorder.width = toNumberOrDefault(formData.get("textBorderWidth"), component.textBorder.width);
          component.textBorder.colorMode = textBorderColorSelection.mode;
          component.textBorder.color = String(formData.get("textBorderColor") || component.textBorder.color);
          component.textBorder.colorSequenceRef = textBorderColorSelection.sequenceRef;
        });
      });
    }

    var imageComponentForm = appElement.querySelector("[data-form='image-component-settings']");
    if (imageComponentForm) {
      imageComponentForm.addEventListener("change", function () {
        var selection = getDesignerSelection(store.getState());
        if (!selection.token || selection.selectedComponentType !== "image") {
          return;
        }
        var formData = new FormData(imageComponentForm);
        store.updateProject(function (project) {
          var component = findComponent(project, selection, "image");
          if (!component) {
            return;
          }
          component.name = String(formData.get("name") || component.name);
          Tokens.updateImageComponent(component, {
            x: toNumberOrDefault(formData.get("x"), component.x),
            y: toNumberOrDefault(formData.get("y"), component.y),
            scale: toNumberOrDefault(formData.get("scale"), component.scale),
            rotationDeg: toNumberOrDefault(formData.get("rotationDeg"), component.rotationDeg),
            mirrorX: formData.get("mirrorX") === "on",
            mirrorY: formData.get("mirrorY") === "on"
          });
        });
      });

      var replaceImageButton = imageComponentForm.querySelector("[data-action='replace-image']");
      var replaceImageInput = imageComponentForm.querySelector("[data-replace-image-input]");
      if (replaceImageButton && replaceImageInput) {
        replaceImageButton.addEventListener("click", function () {
          replaceImageInput.click();
        });
        replaceImageInput.addEventListener("change", async function () {
          var file = replaceImageInput.files && replaceImageInput.files[0];
          var selection = getDesignerSelection(store.getState());
          if (!file || !selection.token || selection.selectedComponentType !== "image") {
            return;
          }
          try {
            var imageAsset = await Utils.readImageAssetFile(file);
            store.updateProject(function (project) {
              var component = findComponent(project, selection, "image");
              if (component) {
                component.source = imageAsset.source;
                component.name = file.name;
                component.aspectRatio = imageAsset.width / imageAsset.height;
              }
            });
          } catch (error) {
            runtimeGlobal.alert("Image import failed.");
            console.error(error);
          } finally {
            replaceImageInput.value = "";
          }
        });
      }
    }

    appElement.querySelectorAll("[data-drag-mode]").forEach(function (element) {
      element.addEventListener("mousedown", function (event) {
        var selection = getDesignerSelection(store.getState());
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
        var mode = event.target.getAttribute("data-drag-mode") || "move";
        var component = getSelectedComponent(selection.token[selection.faceName], componentType, componentId);
        if (!component) {
          return;
        }

        var svgElement = event.target.ownerSVGElement;
        var previewRect = svgElement.getBoundingClientRect();
        designerInteraction = {
          tokenId: selection.token.id,
          faceName: selection.faceName,
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

        store.updateUi(function (ui) {
          ui.selectedComponentType = componentType;
          ui.selectedComponentId = componentId;
        });
      });
    });

    var previewStage = appElement.querySelector("[data-preview-stage]");
    if (previewStage) {
      previewStage.addEventListener("wheel", function (event) {
        var selection = getDesignerSelection(store.getState());
        if (!selection.token || !selection.selectedComponentType) {
          return;
        }
        var component = findComponent(store.getState().project, selection, selection.selectedComponentType);
        if (!component) {
          return;
        }

        event.preventDefault();
        var factor = Math.pow(1.0015, -event.deltaY);
        store.updateProject(function (project) {
          var nextComponent = findComponent(project, selection, selection.selectedComponentType);
          if (!nextComponent) {
            return;
          }

          if (selection.selectedComponentType === "image") {
            Tokens.updateImageComponent(nextComponent, {
              x: nextComponent.x,
              y: nextComponent.y,
              scale: nextComponent.scale * factor,
              rotationDeg: nextComponent.rotationDeg,
              mirrorX: nextComponent.mirrorX,
              mirrorY: nextComponent.mirrorY
            });
          } else {
            Tokens.updateComponentRect(nextComponent, {
              x: nextComponent.x,
              y: nextComponent.y,
              width: nextComponent.width * factor,
              height: nextComponent.height * factor
            });
          }
        }, { persist: false });
        scheduleDesignerPersist();
      }, { passive: false });

      previewStage.addEventListener("click", function (event) {
        var componentElement = event.target.closest("[data-component-id]");
        if (componentElement) {
          store.updateUi(function (ui) {
            ui.selectedComponentType = componentElement.getAttribute("data-component-type");
            ui.selectedComponentId = componentElement.getAttribute("data-component-id");
          });
          return;
        }
        store.updateUi(function (ui) {
          ui.selectedComponentType = null;
          ui.selectedComponentId = null;
        });
      });
    }
  }

  function bindPrintEvents(appElement, store) {
    var pageSettingsForm = appElement.querySelector("[data-form='page-settings']");
    if (pageSettingsForm) {
      pageSettingsForm.addEventListener("change", function () {
        var formData = new FormData(pageSettingsForm);
        store.updateProject(function (project) {
          project.settings.pagePresetId = String(formData.get("pagePresetId"));
          project.settings.pageOrientation = String(formData.get("pageOrientation"));
          project.settings.pageMarginIn = toNonNegativeNumberOrDefault(formData.get("pageMarginIn"), project.settings.pageMarginIn);
          project.settings.bleedIn = toNonNegativeNumberOrDefault(formData.get("bleedIn"), project.settings.bleedIn);
        });
      });
    }

    var printForm = appElement.querySelector("[data-form='print-selections']");
    if (printForm) {
      var syncPrintSelections = function () {
        var rows = collectPrintSelectionRows(printForm, store.getState().project);
        store.updateProject(function (project) {
          project.printSelections = Print.normalizeSelections(project, rows);
        });
      };

      printForm.addEventListener("input", syncPrintSelections);
      printForm.addEventListener("change", syncPrintSelections);
    }

    var layout = Print.layoutProject(store.getState().project);
    var hasPages = layout.pages.length && layout.pages[0].items.length;

    var printLayoutButton = appElement.querySelector("[data-action='print-layout']");
    if (printLayoutButton) {
      printLayoutButton.addEventListener("click", function () {
        if (hasPages) {
          openPrintWindow(layout, store.getState().project);
        }
      });
    }

    appElement.querySelectorAll("[data-action='select-preview-page']").forEach(function (button) {
      button.addEventListener("click", function () {
        store.updateUi(function (ui) {
          ui.selectedPrintPreviewPage = Number(button.getAttribute("data-page-index")) || 0;
        });
      });
    });
  }

  function handleGlobalPointerMove(event) {
    if (!designerInteraction || !mountedStore) {
      return;
    }

    var deltaX = (event.clientX - designerInteraction.startClientX) / designerInteraction.previewRect.width;
    var deltaY = (event.clientY - designerInteraction.startClientY) / designerInteraction.previewRect.height;
    mountedStore.updateProject(function (project) {
      var token = findToken(project, designerInteraction.tokenId);
      if (!token) {
        return;
      }
      var selection = {
        token: token,
        faceName: designerInteraction.faceName,
        selectedComponentId: designerInteraction.componentId
      };
      var component = findComponent(project, selection, designerInteraction.componentType);
      if (!component) {
        return;
      }

      if (designerInteraction.mode === "resize") {
        if (designerInteraction.componentType === "image") {
          var startDimensions = Tokens.getImageDimensions(designerInteraction.startRect);
          var widthRatio = (startDimensions.width / 2 + deltaX) / Math.max(startDimensions.width / 2, 0.001);
          var heightRatio = (startDimensions.height / 2 + deltaY) / Math.max(startDimensions.height / 2, 0.001);
          var nextScale = designerInteraction.startRect.scale * Math.max(0.1, widthRatio, heightRatio);
          Tokens.updateImageComponent(component, {
            x: designerInteraction.startRect.x,
            y: designerInteraction.startRect.y,
            scale: nextScale,
            rotationDeg: component.rotationDeg,
            mirrorX: component.mirrorX,
            mirrorY: component.mirrorY
          });
        } else {
          Tokens.updateComponentRect(component, {
            x: designerInteraction.startRect.x,
            y: designerInteraction.startRect.y,
            width: designerInteraction.startRect.width + deltaX * 2,
            height: designerInteraction.startRect.height + deltaY * 2
          });
        }
      } else if (designerInteraction.mode === "rotate" && designerInteraction.componentType === "image") {
        var startAngle = Math.atan2(
          designerInteraction.startClientY - designerInteraction.centerClientY,
          designerInteraction.startClientX - designerInteraction.centerClientX
        );
        var nextAngle = Math.atan2(
          event.clientY - designerInteraction.centerClientY,
          event.clientX - designerInteraction.centerClientX
        );
        var deltaDeg = (nextAngle - startAngle) * 180 / Math.PI;
        Tokens.updateImageComponent(component, {
          x: designerInteraction.startRect.x,
          y: designerInteraction.startRect.y,
          scale: designerInteraction.startRect.scale,
          rotationDeg: designerInteraction.startRect.rotationDeg + deltaDeg,
          mirrorX: component.mirrorX,
          mirrorY: component.mirrorY
        });
      } else {
        if (designerInteraction.componentType === "image") {
          Tokens.updateImageComponent(component, {
            x: designerInteraction.startRect.x + deltaX,
            y: designerInteraction.startRect.y + deltaY,
            scale: designerInteraction.startRect.scale,
            rotationDeg: component.rotationDeg,
            mirrorX: component.mirrorX,
            mirrorY: component.mirrorY
          });
        } else {
          Tokens.updateComponentRect(component, {
            x: designerInteraction.startRect.x + deltaX,
            y: designerInteraction.startRect.y + deltaY,
            width: designerInteraction.startRect.width,
            height: designerInteraction.startRect.height
          });
        }
      }
    }, { persist: false });
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
    mountedStore.persistProject();
  }

  function scheduleDesignerPersist() {
    if (designerWheelPersistTimer) {
      runtimeGlobal.clearTimeout(designerWheelPersistTimer);
    }
    designerWheelPersistTimer = runtimeGlobal.setTimeout(function () {
      designerWheelPersistTimer = null;
      if (mountedStore) {
        mountedStore.persistProject();
      }
    }, 180);
  }

  function getDesignerSelection(state) {
    var token = state.project.tokens.find(function (candidate) {
      return candidate.id === state.ui.selectedTokenId;
    }) || state.project.tokens[0] || null;
    var faceName = state.ui.selectedFace === "back" ? "back" : "front";

    return {
      token: token,
      faceName: faceName,
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
    var face = token[selection.faceName];
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
      y: toNumberOrDefault(formData.get("y"), component.y),
      width: toNumberOrDefault(formData.get("width"), component.width),
      height: toNumberOrDefault(formData.get("height"), component.height)
    });
  }

  function toNumberOrDefault(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function toIntegerOrDefault(value, fallback) {
    var parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function toNonNegativeNumberOrDefault(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function toNonNegativeInteger(value, fallback) {
    var parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
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

  function nullableValue(value) {
    return value ? String(value) : null;
  }

  function syncConditionalFields(form, values) {
    form.querySelectorAll("[data-visible-when]").forEach(function (element) {
      var parts = element.getAttribute("data-visible-when").split(":");
      var fieldName = parts[0];
      var expectedValues = parts[1].split("|");
      var isVisible = expectedValues.indexOf(values[fieldName]) !== -1;
      element.hidden = !isVisible;
      element.style.display = isVisible ? "" : "none";
      element.querySelectorAll("input, select, textarea, button").forEach(function (control) {
        if (control.name === "contentMode" || control.name === "colorSource" || control.name === "textBorderColorSource" || control.name === "backgroundColorSource" || control.name === "borderColorSource") {
          return;
        }
        control.disabled = !isVisible;
      });
    });
  }

  function renderConditionalField(visibleWhen, isVisible, innerHtml) {
    return '<label class="field" data-visible-when="' + visibleWhen + '"' + (isVisible ? "" : ' hidden style="display:none"') + ">" + innerHtml + "</label>";
  }

  function renderConditionalBlock(visibleWhen, isVisible, innerHtml) {
    return '<div data-visible-when="' + visibleWhen + '"' + (isVisible ? "" : ' hidden style="display:none"') + ">" + innerHtml + "</div>";
  }

  function parseColorSourceValue(value) {
    var source = value ? String(value) : "manual";
    return source === "manual"
      ? { mode: "manual", sequenceRef: null }
      : { mode: "sequence", sequenceRef: source };
  }

  function renderTextSequenceManager(sequences, selectedSequence, editingSequence) {
    return renderSequenceManager({
      selectedName: "selectedTextSequenceId",
      selectedSequence: selectedSequence,
      sequences: sequences,
      summary: selectedSequence
        ? Sequences.summarizeTextSequence(selectedSequence)
        : (sequences.length ? "Select a custom sequence to edit it in the drawer." : "No custom text sequences yet."),
      helperText: "Built-in text sequences stay available in token settings and are not edited here.",
      newAction: "new-text-sequence",
      isEditing: !!editingSequence
    });
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

  function renderTextSequenceForm(sequence) {
    var type = sequence ? sequence.type : "numeric";
    return [
      '<form class="form-grid" data-form="text-sequence">',
      '  <input type="hidden" name="id" value="' + escapeHtml(sequence ? sequence.id : "") + '">',
      '  <label class="field">Name<input name="name" value="' + escapeHtml(sequence ? sequence.name : "") + '" required></label>',
      '  <div class="field-row two-up">',
      '    <label class="field">Type<select name="type">' + renderTextTypeOptions(type) + "</select></label>",
      '    <label class="field">Pad digits<input type="number" min="0" step="1" name="padTo" value="' + escapeHtml(sequence && sequence.type === "numeric" ? sequence.padTo : 0) + '"></label>',
      "  </div>",
      '  <div class="field-row three-up" data-type-only="numeric"' + (type === "numeric" ? "" : " hidden") + '>',
      '    <label class="field">Start<input type="number" step="1" name="start" value="' + escapeHtml(sequence && sequence.type === "numeric" ? sequence.start : 1) + '"></label>',
      '    <label class="field">Step<input type="number" step="1" name="step" value="' + escapeHtml(sequence && sequence.type === "numeric" ? sequence.step : 1) + '"></label>',
      '    <label class="field">Prefix<input name="prefix" value="' + escapeHtml(sequence ? sequence.prefix : "") + '"></label>',
      "  </div>",
      '  <div class="field-row two-up"><label class="field">Suffix<input name="suffix" value="' + escapeHtml(sequence ? sequence.suffix : "") + '"></label></div>',
      '  <label class="field" data-type-only="custom"' + (type === "custom" ? "" : " hidden") + '>Custom values<textarea name="customValuesText">' + escapeHtml(sequence && sequence.type === "custom" ? sequence.customValues.join("\n") : "") + '</textarea><span class="field-help">One value per line.</span></label>',
      '  <p class="field-help">Changes save automatically when you leave a field.</p>',
      "</form>"
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

  function renderTextTypeOptions(currentValue) {
    return [
      { id: "numeric", label: "Numeric" },
      { id: "alphabetic", label: "Alphabetic" },
      { id: "custom", label: "Custom" }
    ].map(function (option) {
      return '<option value="' + option.id + '"' + (currentValue === option.id ? " selected" : "") + ">" + option.label + "</option>";
    }).join("");
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

  function renderColorModeOptions(currentValue) {
    return [
      { id: "manual", label: "Manual" },
      { id: "sequence", label: "Sequence" }
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

  function normalizeColorInput(value) {
    if (typeof value === "string" && value.startsWith("#")) {
      return value;
    }

    return "#000000";
  }

  function renderPageSettingsForm(settings) {
    return [
      '<form class="form-grid" data-form="page-settings">',
      '  <div class="field-row two-up">',
      '    <label class="field">Page size<select name="pagePresetId">' + Schema.PAGE_PRESETS.map(function (candidate) {
        return '<option value="' + candidate.id + '"' + (candidate.id === settings.pagePresetId ? " selected" : "") + ">" + candidate.label + "</option>";
      }).join("") + '</select></label>',
      '    <label class="field">Orientation<select name="pageOrientation">' +
        '<option value="portrait"' + (settings.pageOrientation === "portrait" ? " selected" : "") + '>Portrait</option>' +
        '<option value="landscape"' + (settings.pageOrientation === "landscape" ? " selected" : "") + '>Landscape</option>' +
        "</select></label>",
      "  </div>",
      '  <div class="field-row two-up">',
      '    <label class="field">Margin (in)<input type="number" min="0.05" step="0.05" name="pageMarginIn" value="' + settings.pageMarginIn + '"></label>',
      '    <label class="field">Bleed (in)<input type="number" min="0" step="0.01" name="bleedIn" value="' + settings.bleedIn + '"></label>',
      "  </div>",
      '  <p class="field-help">Changes save automatically.</p>',
      "</form>"
    ].join("");
  }

  function renderPrintSelectionForm(rows) {
    if (!rows.length) {
      return '<div class="empty-state">Create token templates in the designer before preparing print pages.</div>';
    }

    return [
      '<form class="form-grid" data-form="print-selections" novalidate>',
      '  <table class="print-table">',
      "    <thead><tr><th>Token</th><th>Copies</th><th>Start</th></tr></thead>",
      "    <tbody>",
      rows.map(function (row) {
        return [
          "      <tr>",
          "        <td>" + escapeHtml(row.tokenName) + " (" + row.diameterIn + '&quot;)</td>',
          '        <td><input type="number" min="0" step="1" name="copies-' + row.tokenId + '" value="' + row.copies + '"></td>',
          '        <td><input type="number" min="0" step="1" name="start-' + row.tokenId + '" value="' + row.sequenceStart + '"></td>',
          "      </tr>"
        ].join("");
      }).join(""),
      "    </tbody>",
      "  </table>",
      '  <p class="field-help">Changes update the preview automatically. Color sequences repeat when copies exceed their length.</p>',
      "</form>"
    ].join("");
  }

  function renderPreviewTabs(layout, project, activeIndex) {
    return [
      '<div class="preview-tab-list" role="tablist" aria-label="Preview pages">',
      layout.pages.map(function (page, index) {
        return '<button class="preview-tab' + (index === activeIndex ? " is-active" : "") + '" type="button" role="tab" aria-selected="' + (index === activeIndex ? "true" : "false") + '" data-action="select-preview-page" data-page-index="' + index + '">Page ' + (index + 1) + "</button>";
      }).join(""),
      "</div>",
      renderPreviewSection(layout.pages[activeIndex], project, activeIndex)
    ].join("");
  }

  function renderPreviewSection(page, project, index) {
    return [
      '<div class="preview-page-grid">',
      renderPreviewCard(page, project, index),
      "</div>"
    ].join("");
  }

  function renderPreviewCard(page, project, index) {
    return [
      '<article class="preview-page-card">',
      '  <p class="preview-page-label">Page ' + (index + 1) + "</p>",
      '  <div class="preview-page-svg">',
      renderPageSvg(page, project, true),
      "  </div>",
      "</article>"
    ].join("");
  }

  function renderPageSvg(page, project, isPreview) {
    var pageWidth = page.pageWidthIn * 100;
    var pageHeight = page.pageHeightIn * 100;
    return [
      '<svg viewBox="0 0 ' + pageWidth + " " + pageHeight + '" xmlns="http://www.w3.org/2000/svg"' + (isPreview ? "" : ' width="100%" height="100%"') + '>',
      '  <rect x="0" y="0" width="' + pageWidth + '" height="' + pageHeight + '" fill="#ffffff"></rect>',
      page.items.map(function (item) {
        return renderPageCellFill(item, project);
      }).join(""),
      page.items.map(function (item) {
        return renderPageItem(item, project);
      }).join(""),
      renderCutLines(page),
      "</svg>"
    ].join("");
  }

  function renderPageCellFill(item, project) {
    var face = item.token[item.faceName];
    var fill = getPageCellFill(face, project.sequences.color, item.sequenceIndex);
    return '<rect x="' + (item.cellXIn * 100) + '" y="' + (item.cellYIn * 100) + '" width="' + (item.cellSizeIn * 100) + '" height="' + (item.cellSizeIn * 100) + '" fill="' + escapeHtml(fill) + '"></rect>';
  }

  function renderPageItem(item, project) {
    var x = item.xIn * 100;
    var y = item.yIn * 100;
    var size = item.diameterIn * 100;
    return Renderer.renderTokenSvg(item.token, project, {
        face: item.faceName,
        sequenceIndex: item.sequenceIndex,
        interactive: false,
        outerSquareFill: getPageCellFill(item.token[item.faceName], project.sequences.color, item.sequenceIndex),
        svgAttributes: 'x="' + x + '" y="' + y + '" width="' + size + '" height="' + size + '"'
      });
  }

  function renderCutLines(page) {
    var bounds = getPageGridBounds(page);
    if (!bounds) {
      return "";
    }
    return collectInternalBoundaries(page, "x").map(function (value) {
      return '<line x1="' + value + '" y1="' + bounds.minY + '" x2="' + value + '" y2="' + bounds.maxY + '" stroke="#7f7f7f" stroke-width="0.75" stroke-dasharray="2 2"></line>';
    }).concat(collectInternalBoundaries(page, "y").map(function (value) {
      return '<line x1="' + bounds.minX + '" y1="' + value + '" x2="' + bounds.maxX + '" y2="' + value + '" stroke="#7f7f7f" stroke-width="0.75" stroke-dasharray="2 2"></line>';
    })).join("");
  }

  function getPageGridBounds(page) {
    if (!page.items.length) {
      return null;
    }
    var minX = Math.min.apply(Math, page.items.map(function (item) { return item.cellXIn * 100; }));
    var minY = Math.min.apply(Math, page.items.map(function (item) { return item.cellYIn * 100; }));
    var maxX = Math.max.apply(Math, page.items.map(function (item) { return (item.cellXIn + item.cellSizeIn) * 100; }));
    var maxY = Math.max.apply(Math, page.items.map(function (item) { return (item.cellYIn + item.cellSizeIn) * 100; }));
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function collectInternalBoundaries(page, axis) {
    var values = page.items.map(function (item) {
      return axis === "x"
        ? (item.cellXIn + item.cellSizeIn) * 100
        : (item.cellYIn + item.cellSizeIn) * 100;
    }).filter(function (value, index, all) {
      return all.indexOf(value) === index;
    }).sort(function (a, b) {
      return a - b;
    });
    values.pop();
    return values;
  }

  function getPageCellFill(face, colorSequences, sequenceIndex) {
    if (face.border && face.border.widthRatio > 0) {
      return Tokens.getColorValue(
        face.border.colorMode,
        face.border.color,
        face.border.colorSequenceRef,
        colorSequences,
        sequenceIndex
      );
    }

    return Tokens.getColorValue(
      face.backgroundColorMode,
      face.backgroundColor,
      face.backgroundColorSequenceRef,
      colorSequences,
      sequenceIndex
    );
  }

  function openPrintWindow(layout, project) {
    if (!runtimeGlobal.document || !runtimeGlobal.document.body) {
      return;
    }

    cleanupPrintFrame();
    var pages = layout.pages.map(function (page) {
      return renderPrintablePage(page, project);
    });
    var iframe = runtimeGlobal.document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.className = "print-frame";
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    runtimeGlobal.document.body.appendChild(iframe);
    activePrintFrame = iframe;

    var printWindow = iframe.contentWindow;
    if (!printWindow) {
      cleanupPrintFrame();
      return;
    }

    printWindow.document.open();
    printWindow.document.write([
      "<!doctype html><html><head><title>Monster Mint Print</title><style>",
      "html,body{margin:0;padding:0;background:#fff;font-family:Georgia,serif;}",
      ".print-page{page-break-after:always;break-after:page;display:block;}",
      ".print-page:last-child{page-break-after:auto;break-after:auto;}",
      "</style></head><body>",
      pages.join(""),
      "</body></html>"
    ].join(""));
    printWindow.document.close();
    runtimeGlobal.setTimeout(function () {
      try {
        printWindow.focus();
        printWindow.print();
      } finally {
        runtimeGlobal.setTimeout(cleanupPrintFrame, 1000);
      }
    }, 50);
  }

  function cleanupPrintFrame() {
    if (!activePrintFrame) {
      return;
    }

    if (activePrintFrame.parentNode) {
      activePrintFrame.parentNode.removeChild(activePrintFrame);
    }
    activePrintFrame = null;
  }

  function renderPrintablePage(page, project) {
    return [
      '<div class="print-page" style="width:' + page.pageWidthIn + "in;height:" + page.pageHeightIn + 'in;">',
      renderPageSvg(page, project, false),
      "</div>"
    ].join("");
  }

  function mount() {
    var appElement = document.getElementById("app");
    var store = State.createStore({ storage: runtimeGlobal.localStorage });
    mountedStore = store;
    store.subscribe(function () {
      render(appElement, store);
    });
    bindGlobalPointerHandlers();
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

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", mount);
  }

  return {
    mount: mount
  };
});
