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
    { id: "settings", label: "Settings" },
    { id: "designer", label: "Designer" },
    { id: "print", label: "Print" }
  ];
  var designerInteraction = null;
  var mountedStore = null;

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
    return [
      '<div class="designer-layout">',
      '  <aside class="designer-column">',
      '    <section class="panel-card">',
      "      <h2>Tokens</h2>",
      '      <div class="token-toolbar">',
      '        <button class="button button-primary" type="button" data-action="add-token">New Token</button>',
      '        <button class="button" type="button" data-action="duplicate-token" data-token-id="' + token.id + '">Duplicate</button>',
      '        <button class="button" type="button" data-action="delete-token" data-token-id="' + token.id + '">Delete</button>',
      "      </div>",
      renderTokenList(state.project.tokens, token.id),
      "    </section>",
      "  </aside>",
      '  <section class="designer-column">',
      '    <section class="panel-card preview-shell">',
      '      <div class="preview-toolbar">',
      '        <div class="face-toggle">',
      '          <button type="button" class="' + (selection.faceName === "front" ? "is-active" : "") + '" data-face="front">Front</button>',
      '          <button type="button" class="' + (selection.faceName === "back" ? "is-active" : "") + '" data-face="back">Back</button>',
      "        </div>",
      '        <button class="button" type="button" data-action="add-text" data-face="' + selection.faceName + '">Add Text</button>',
      '        <button class="button" type="button" data-action="add-image" data-face="' + selection.faceName + '">Add Image</button>',
      '        <input class="visually-hidden" type="file" accept="image/*" data-image-upload-input>',
      "      </div>",
      '      <div class="preview-stage" data-preview-stage>',
      Renderer.renderTokenSvg(token, state.project, {
        face: selection.faceName,
        sequenceIndex: 0,
        interactive: true,
        selectedComponentType: selection.selectedComponentType,
        selectedComponentId: selection.selectedComponentId
      }),
      "      </div>",
      '      <p class="preview-note">Drag to move. Use the lower-right handle to resize. Components stay inside the token square.</p>',
      "    </section>",
      '    <section class="panel-card">',
      "      <h2>Components</h2>",
      renderComponentList(face, selection.selectedComponentType, selection.selectedComponentId),
      '      <div class="component-toolbar">',
      '        <button class="button" type="button" data-action="delete-component"' + (selectedComponent ? "" : " disabled") + '>Delete Selected</button>',
      "      </div>",
      "    </section>",
      "  </section>",
      '  <aside class="designer-column">',
      '    <section class="panel-card">',
      "      <h2>Token</h2>",
      renderTokenForm(token),
      "    </section>",
      '    <section class="panel-card">',
      "      <h2>" + (selection.faceName === "front" ? "Front" : "Back") + " Face</h2>",
      renderFaceForm(token, state.project, selection.faceName),
      "    </section>",
      '    <section class="panel-card">',
      "      <h2>Selected Component</h2>",
      renderSelectedComponentForm(selectedComponent, selection, state.project),
      "    </section>",
      "  </aside>",
      "</div>"
    ].join("");
  }

  function renderPrintPanel(state) {
    var rows = Print.getSelectionRows(state.project);
    var layout = Print.layoutProject(state.project);
    var hasBacks = state.project.tokens.some(function (token) {
      return token.back.enabled && (token.back.images.length || token.back.texts.length || token.back.backgroundColor);
    });
    return [
      '<div class="print-layout">',
      '  <section class="panel-card">',
      "    <h2>Print Selections</h2>",
      renderPrintSelectionForm(rows),
      "  </section>",
      '  <section class="panel-card">',
      "    <h2>Preview</h2>",
      '    <div class="button-row">',
      '      <button class="button button-primary" type="button" data-action="print-fronts">Print Fronts</button>',
      '      <button class="button" type="button" data-action="print-backs"' + (hasBacks ? "" : " disabled") + '>Print Backs</button>',
      '      <button class="button" type="button" data-action="print-both"' + (hasBacks ? "" : " disabled") + '>Print Both</button>',
      "    </div>",
      layout.pages.length && layout.pages[0].items.length
        ? renderPreviewSection(layout, state.project, "front", "Front Pages")
        : '<div class="empty-state">Choose at least one token copy to generate pages.</div>',
      hasBacks && layout.pages.length && layout.pages[0].items.length
        ? renderPreviewSection(layout, state.project, "back", "Back Pages")
        : "",
      "  </section>",
      "</div>"
    ].join("");
  }

  function renderTokenList(tokens, selectedTokenId) {
    return '<div class="token-list">' + tokens.map(function (token) {
      return [
        '<button class="token-card' + (token.id === selectedTokenId ? " is-selected" : "") + '" type="button" data-action="select-token" data-token-id="' + token.id + '">',
        "  <strong>" + escapeHtml(token.name) + "</strong>",
        "  <span>" + token.diameterIn + '&quot; token</span>',
        "</button>"
      ].join("");
    }).join("") + "</div>";
  }

  function renderComponentList(face, selectedType, selectedId) {
    var items = face.images.map(function (component) {
      return { type: "image", id: component.id, label: component.name || "Image" };
    }).concat(face.texts.map(function (component) {
      return {
        type: "text",
        id: component.id,
        label: component.contentMode === "sequence" ? "Sequence text" : (component.customText || "Custom text")
      };
    }));

    if (!items.length) {
      return '<div class="empty-state">No text or image components on this face.</div>';
    }

    return '<div class="component-list">' + items.map(function (item) {
      return [
        '<button class="component-item' + (selectedType === item.type && selectedId === item.id ? " is-selected" : "") + '" type="button" data-action="select-component" data-component-type="' + item.type + '" data-component-id="' + item.id + '">',
        "  " + escapeHtml(item.label),
        "  <small>" + escapeHtml(item.type) + "</small>",
        "</button>"
      ].join("");
    }).join("") + "</div>";
  }

  function renderTokenForm(token) {
    return [
      '<form class="form-grid" data-form="token-settings">',
      '  <label class="field">Name<input name="name" value="' + escapeHtml(token.name) + '" required></label>',
      '  <label class="field">Diameter<select name="diameterIn">' + Schema.TOKEN_SIZES.map(function (size) {
        return '<option value="' + size + '"' + (size === token.diameterIn ? " selected" : "") + ">" + size + '&quot;</option>';
      }).join("") + "</select></label>",
      '  <div class="button-row"><button class="button button-primary" type="submit">Save Token</button></div>',
      "</form>"
    ].join("");
  }

  function renderFaceForm(token, project, faceName) {
    var face = token[faceName];
    return [
      '<form class="form-grid" data-form="face-settings">',
      faceName === "back"
        ? '<label class="field"><span>Back enabled</span><select name="enabled"><option value="true"' + (face.enabled ? " selected" : "") + '>Enabled</option><option value="false"' + (!face.enabled ? " selected" : "") + '>Disabled</option></select></label>'
        : "",
      '<label class="field">Background color mode<select name="backgroundColorMode">' +
        renderColorModeOptions(face.backgroundColorMode) +
        "</select></label>",
      face.backgroundColorMode === "manual"
        ? '<label class="field">Background color<input type="color" name="backgroundColor" value="' + escapeHtml(face.backgroundColor) + '"></label>'
        : '<label class="field">Background sequence<select name="backgroundColorSequenceRef">' + renderSequenceOptions(project.sequences.color, face.backgroundColorSequenceRef, "No sequence") + "</select></label>",
      faceName === "front"
        ? [
          '<label class="field">Border enabled<select name="borderEnabled">',
          '<option value="true"' + (face.border.enabled ? " selected" : "") + '>Enabled</option>',
          '<option value="false"' + (!face.border.enabled ? " selected" : "") + '>Disabled</option>',
          "</select></label>",
          face.border.enabled ? '<label class="field">Border width (pt)<input type="number" min="0.5" step="0.5" name="borderWidthPt" value="' + face.border.widthPt + '"></label>' : "",
          face.border.enabled ? '<label class="field">Border color mode<select name="borderColorMode">' + renderColorModeOptions(face.border.colorMode) + "</select></label>" : "",
          face.border.enabled && face.border.colorMode === "manual"
            ? '<label class="field">Border color<input type="color" name="borderColor" value="' + escapeHtml(face.border.color) + '"></label>'
            : "",
          face.border.enabled && face.border.colorMode === "sequence"
            ? '<label class="field">Border sequence<select name="borderColorSequenceRef">' + renderSequenceOptions(project.sequences.color, face.border.colorSequenceRef, "No sequence") + "</select></label>"
            : ""
        ].join("")
        : "",
      '  <div class="button-row"><button class="button button-primary" type="submit">Save Face</button></div>',
      "</form>"
    ].join("");
  }

  function renderSelectedComponentForm(component, selection, project) {
    if (!component) {
      return '<div class="empty-state">Select a text block or image to edit it.</div>';
    }

    if (selection.selectedComponentType === "text") {
      return renderTextComponentForm(component, project);
    }

    return renderImageComponentForm(component);
  }

  function renderTextComponentForm(component, project) {
    return [
      '<form class="form-grid" data-form="text-component-settings">',
      '  <label class="field">Content mode<select name="contentMode">' + renderTextContentModeOptions(component.contentMode) + "</select></label>",
      renderConditionalField("contentMode:custom", component.contentMode === "custom", 'Text<input name="customText" value="' + escapeHtml(component.customText) + '">'),
      renderConditionalField("contentMode:sequence", component.contentMode === "sequence", 'Text sequence<select name="textSequenceRef">' + renderSequenceOptions(project.sequences.text, component.textSequenceRef, "No sequence") + "</select>"),
      '  <div class="field-row two-up">',
      '    <label class="field">Font family<input name="fontFamily" value="' + escapeHtml(component.fontFamily) + '"></label>',
      '    <label class="field">Font weight<select name="fontWeight">' + renderFontWeightOptions(component.fontWeight) + "</select></label>",
      "  </div>",
      '  <label class="field">Text color mode<select name="colorMode">' + renderColorModeOptions(component.colorMode) + "</select></label>",
      renderConditionalField("colorMode:manual", component.colorMode === "manual", 'Text color<input type="color" name="color" value="' + escapeHtml(component.color) + '">'),
      renderConditionalField("colorMode:sequence", component.colorMode === "sequence", 'Color sequence<select name="colorSequenceRef">' + renderSequenceOptions(project.sequences.color, component.colorSequenceRef, "No sequence") + "</select>"),
      renderBoundsFields(component),
      renderShadowFields(component.shadow),
      '  <div class="button-row"><button class="button button-primary" type="submit">Save Text</button></div>',
      "</form>"
    ].join("");
  }

  function renderImageComponentForm(component) {
    return [
      '<form class="form-grid" data-form="image-component-settings">',
      '  <label class="field">Label<input name="name" value="' + escapeHtml(component.name) + '"></label>',
      '  <label class="field">Fit<select name="fit">' + renderImageFitOptions(component.fit) + "</select></label>",
      renderBoundsFields(component),
      '  <div class="button-row">',
      '    <button class="button button-primary" type="submit">Save Image</button>',
      '    <button class="button" type="button" data-action="replace-image">Replace Image</button>',
      '    <input class="visually-hidden" type="file" accept="image/*" data-replace-image-input>',
      "  </div>",
      "</form>"
    ].join("");
  }

  function renderBoundsFields(component) {
    return [
      '<div class="field-row two-up">',
      '  <label class="field">X<input type="number" min="0" max="1" step="0.01" name="x" value="' + component.x.toFixed(2) + '"></label>',
      '  <label class="field">Y<input type="number" min="0" max="1" step="0.01" name="y" value="' + component.y.toFixed(2) + '"></label>',
      "</div>",
      '<div class="field-row two-up">',
      '  <label class="field">Width<input type="number" min="0.05" max="1" step="0.01" name="width" value="' + component.width.toFixed(2) + '"></label>',
      '  <label class="field">Height<input type="number" min="0.05" max="1" step="0.01" name="height" value="' + component.height.toFixed(2) + '"></label>',
      "</div>"
    ].join("");
  }

  function renderShadowFields(shadow) {
    return [
      '<label class="field">Drop shadow<select name="shadowEnabled">',
      '<option value="false"' + (!shadow.enabled ? " selected" : "") + '>Disabled</option>',
      '<option value="true"' + (shadow.enabled ? " selected" : "") + '>Enabled</option>',
      "</select></label>",
      '<div class="field-row two-up">',
      '  <label class="field">Shadow X<input type="number" step="0.5" name="shadowDx" value="' + shadow.dx + '"></label>',
      '  <label class="field">Shadow Y<input type="number" step="0.5" name="shadowDy" value="' + shadow.dy + '"></label>',
      "</div>",
      '<div class="field-row two-up">',
      '  <label class="field">Blur<input type="number" min="0" step="0.5" name="shadowBlur" value="' + shadow.blur + '"></label>',
      '  <label class="field">Shadow color<input type="color" name="shadowColor" value="' + normalizeColorInput(shadow.color) + '"></label>',
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
        if (!runtimeGlobal.confirm("Reset the current project? This clears saved tokens and sequences.")) {
          return;
        }

        store.replaceProject(Schema.createDefaultProject());
        store.updateUi(function (ui) {
          ui.editingTextSequenceId = null;
          ui.editingColorSequenceId = null;
          ui.selectedTokenId = null;
          ui.selectedComponentType = null;
          ui.selectedComponentId = null;
          ui.selectedFace = "front";
        });
      });
    }

    bindSettingsForms(appElement, store);
    bindTransferActions(appElement, store);
    bindDesignerEvents(appElement, store);
    bindPrintEvents(appElement, store);
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
          upsertById(project.sequences.text, sequence);
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
          upsertById(project.sequences.color, sequence);
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
            ui.selectedTokenId = null;
            ui.selectedComponentType = null;
            ui.selectedComponentId = null;
            ui.selectedFace = "front";
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

    appElement.querySelectorAll("[data-action='select-token']").forEach(function (button) {
      button.addEventListener("click", function () {
        store.updateUi(function (ui) {
          ui.selectedTokenId = button.getAttribute("data-token-id");
          ui.selectedComponentType = null;
          ui.selectedComponentId = null;
        });
      });
    });

    appElement.querySelectorAll("[data-action='duplicate-token']").forEach(function (button) {
      button.addEventListener("click", function () {
        var tokenId = button.getAttribute("data-token-id");
        var selection = getDesignerSelection(store.getState());
        if (!selection.token || selection.token.id !== tokenId) {
          return;
        }

        var duplicate = Tokens.createTokenTemplate(Schema.clone(selection.token));
        duplicate.name = selection.token.name + " Copy";
        store.updateProject(function (project) {
          project.tokens.push(duplicate);
        });
        store.updateUi(function (ui) {
          ui.selectedTokenId = duplicate.id;
          ui.selectedComponentType = null;
          ui.selectedComponentId = null;
          ui.selectedFace = "front";
        });
      });
    });

    appElement.querySelectorAll("[data-action='delete-token']").forEach(function (button) {
      button.addEventListener("click", function () {
        var tokenId = button.getAttribute("data-token-id");
        store.updateProject(function (project) {
          project.tokens = project.tokens.filter(function (token) {
            return token.id !== tokenId;
          });
        });
        store.updateUi(function (ui) {
          if (ui.selectedTokenId === tokenId) {
            ui.selectedTokenId = null;
            ui.selectedComponentType = null;
            ui.selectedComponentId = null;
          }
        });
      });
    });

    appElement.querySelectorAll("[data-face]").forEach(function (button) {
      button.addEventListener("click", function () {
        store.updateUi(function (ui) {
          ui.selectedFace = button.getAttribute("data-face");
          ui.selectedComponentType = null;
          ui.selectedComponentId = null;
        });
      });
    });

    var tokenForm = appElement.querySelector("[data-form='token-settings']");
    if (tokenForm) {
      tokenForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var selection = getDesignerSelection(store.getState());
        if (!selection.token) {
          return;
        }
        var formData = new FormData(tokenForm);
        store.updateProject(function (project) {
          var token = findToken(project, selection.token.id);
          token.name = String(formData.get("name")) || token.name;
          token.diameterIn = Number(formData.get("diameterIn")) || token.diameterIn;
        });
      });
    }

    var faceForm = appElement.querySelector("[data-form='face-settings']");
    if (faceForm) {
      faceForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var selection = getDesignerSelection(store.getState());
        if (!selection.token) {
          return;
        }
        var formData = new FormData(faceForm);
        store.updateProject(function (project) {
          var token = findToken(project, selection.token.id);
          var face = token[selection.faceName];
          if (selection.faceName === "back") {
            face.enabled = String(formData.get("enabled")) === "true";
          }
          face.backgroundColorMode = String(formData.get("backgroundColorMode"));
          face.backgroundColor = String(formData.get("backgroundColor") || face.backgroundColor);
          face.backgroundColorSequenceRef = nullableValue(formData.get("backgroundColorSequenceRef"));
          if (selection.faceName === "front") {
            face.border.enabled = String(formData.get("borderEnabled")) === "true";
            face.border.widthPt = Number(formData.get("borderWidthPt")) || face.border.widthPt;
            face.border.colorMode = String(formData.get("borderColorMode") || face.border.colorMode);
            face.border.color = String(formData.get("borderColor") || face.border.color);
            face.border.colorSequenceRef = nullableValue(formData.get("borderColorSequenceRef"));
          }
        });
      });
    }

    appElement.querySelectorAll("[data-action='add-text']").forEach(function (button) {
      button.addEventListener("click", function () {
        var selection = getDesignerSelection(store.getState());
        if (!selection.token) {
          return;
        }
        var component = Tokens.createTextComponent({});
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
        var source = await Utils.readDataUrlFile(file);
        var component = Tokens.createImageComponent({
          source: source,
          name: file.name
        });
        store.updateProject(function (project) {
          var token = findToken(project, selection.token.id);
          token[selection.faceName].images.push(component);
        });
        store.updateUi(function (ui) {
          ui.selectedComponentType = "image";
          ui.selectedComponentId = component.id;
        });
        addImageInput.value = "";
      });
    }

    appElement.querySelectorAll("[data-action='select-component']").forEach(function (button) {
      button.addEventListener("click", function () {
        store.updateUi(function (ui) {
          ui.selectedComponentType = button.getAttribute("data-component-type");
          ui.selectedComponentId = button.getAttribute("data-component-id");
        });
      });
    });

    var deleteComponentButton = appElement.querySelector("[data-action='delete-component']");
    if (deleteComponentButton) {
      deleteComponentButton.addEventListener("click", function () {
        var selection = getDesignerSelection(store.getState());
        if (!selection.token || !selection.selectedComponentId) {
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
        var colorModeField = textComponentForm.querySelector('[name="colorMode"]');
        syncConditionalFields(textComponentForm, {
          contentMode: contentModeField ? contentModeField.value : null,
          colorMode: colorModeField ? colorModeField.value : null
        });
      };
      textComponentForm.querySelectorAll('select[name="contentMode"], select[name="colorMode"]').forEach(function (element) {
        element.addEventListener("change", syncTextComponentVisibility);
      });
      syncTextComponentVisibility();

      textComponentForm.addEventListener("submit", function (event) {
        event.preventDefault();
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
          component.contentMode = String(formData.get("contentMode"));
          component.customText = String(formData.get("customText") || "");
          component.textSequenceRef = nullableValue(formData.get("textSequenceRef"));
          component.fontFamily = String(formData.get("fontFamily") || component.fontFamily);
          component.fontWeight = String(formData.get("fontWeight") || component.fontWeight);
          component.colorMode = String(formData.get("colorMode"));
          component.color = String(formData.get("color") || component.color);
          component.colorSequenceRef = nullableValue(formData.get("colorSequenceRef"));
          applyBoundsFromForm(component, formData);
          component.shadow.enabled = String(formData.get("shadowEnabled")) === "true";
          component.shadow.dx = Number(formData.get("shadowDx")) || 0;
          component.shadow.dy = Number(formData.get("shadowDy")) || 0;
          component.shadow.blur = Number(formData.get("shadowBlur")) || 0;
          component.shadow.color = String(formData.get("shadowColor") || component.shadow.color);
        });
      });
    }

    var imageComponentForm = appElement.querySelector("[data-form='image-component-settings']");
    if (imageComponentForm) {
      imageComponentForm.addEventListener("submit", function (event) {
        event.preventDefault();
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
          component.fit = String(formData.get("fit") || component.fit);
          applyBoundsFromForm(component, formData);
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
          var source = await Utils.readDataUrlFile(file);
          store.updateProject(function (project) {
            var component = findComponent(project, selection, "image");
            if (component) {
              component.source = source;
              component.name = file.name;
            }
          });
          replaceImageInput.value = "";
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
        designerInteraction = {
          tokenId: selection.token.id,
          faceName: selection.faceName,
          componentId: componentId,
          componentType: componentType,
          mode: mode,
          startClientX: event.clientX,
          startClientY: event.clientY,
          previewRect: svgElement.getBoundingClientRect(),
          startRect: {
            x: component.x,
            y: component.y,
            width: component.width,
            height: component.height
          }
        };

        store.updateUi(function (ui) {
          ui.selectedComponentType = componentType;
          ui.selectedComponentId = componentId;
        });
      });
    });
  }

  function bindPrintEvents(appElement, store) {
    var printForm = appElement.querySelector("[data-form='print-selections']");
    if (printForm) {
      printForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var rows = Print.getSelectionRows(store.getState().project).map(function (row) {
          return {
            tokenId: row.tokenId,
            copies: printForm.querySelector('[name="copies-' + row.tokenId + '"]').value,
            sequenceStartIndex: printForm.querySelector('[name="start-' + row.tokenId + '"]').value
          };
        });

        store.updateProject(function (project) {
          project.printSelections = Print.normalizeSelections(project, rows);
        });
      });
    }

    var layout = Print.layoutProject(store.getState().project);
    var hasPages = layout.pages.length && layout.pages[0].items.length;

    var printFrontsButton = appElement.querySelector("[data-action='print-fronts']");
    if (printFrontsButton) {
      printFrontsButton.addEventListener("click", function () {
        if (hasPages) {
          openPrintWindow(layout, store.getState().project, "front");
        }
      });
    }

    var printBacksButton = appElement.querySelector("[data-action='print-backs']");
    if (printBacksButton) {
      printBacksButton.addEventListener("click", function () {
        if (hasPages) {
          openPrintWindow(layout, store.getState().project, "back");
        }
      });
    }

    var printBothButton = appElement.querySelector("[data-action='print-both']");
    if (printBothButton) {
      printBothButton.addEventListener("click", function () {
        if (hasPages) {
          openPrintWindow(layout, store.getState().project, "both");
        }
      });
    }
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
        Tokens.updateComponentRect(component, {
          x: designerInteraction.startRect.x,
          y: designerInteraction.startRect.y,
          width: designerInteraction.startRect.width + deltaX,
          height: designerInteraction.startRect.height + deltaY
        });
      } else {
        Tokens.updateComponentRect(component, {
          x: designerInteraction.startRect.x + deltaX,
          y: designerInteraction.startRect.y + deltaY,
          width: designerInteraction.startRect.width,
          height: designerInteraction.startRect.height
        });
      }
    }, { persist: false });
  }

  function handleGlobalPointerUp() {
    if (!designerInteraction || !mountedStore) {
      return;
    }

    designerInteraction = null;
    mountedStore.persistProject();
  }

  function getDesignerSelection(state) {
    var token = state.project.tokens.find(function (candidate) {
      return candidate.id === state.ui.selectedTokenId;
    }) || state.project.tokens[0] || null;

    return {
      token: token,
      faceName: state.ui.selectedFace === "back" ? "back" : "front",
      selectedComponentType: state.ui.selectedComponentType,
      selectedComponentId: state.ui.selectedComponentId
    };
  }

  function getSelectedComponent(face, type, componentId) {
    if (!face || !componentId) {
      return null;
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
    var collection = type === "image" ? face.images : face.texts;
    return collection.find(function (component) {
      return component.id === selection.selectedComponentId;
    }) || null;
  }

  function applyBoundsFromForm(component, formData) {
    Tokens.updateComponentRect(component, {
      x: Number(formData.get("x")),
      y: Number(formData.get("y")),
      width: Number(formData.get("width")),
      height: Number(formData.get("height"))
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
      var expectedValue = parts[1];
      element.hidden = values[fieldName] !== expectedValue;
    });
  }

  function renderConditionalField(visibleWhen, isVisible, innerHtml) {
    return '<label class="field" data-visible-when="' + visibleWhen + '"' + (isVisible ? "" : " hidden") + ">" + innerHtml + "</label>";
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
        '      <p class="sequence-item-meta">' + escapeHtml(Sequences.summarizeTextSequence(sequence)) + (sequence.builtIn ? " · Built in" : "") + "</p>",
        "    </div>",
        sequence.builtIn
          ? ""
          : '    <div class="button-row">' +
            '      <button class="button" type="button" data-action="edit-text-sequence" data-sequence-id="' + sequence.id + '">Edit</button>' +
            '      <button class="button" type="button" data-action="delete-text-sequence" data-sequence-id="' + sequence.id + '">Delete</button>' +
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
        '      <p class="sequence-item-meta">' + escapeHtml(Sequences.summarizeColorSequence(sequence)) + (sequence.builtIn ? " · Built in" : "") + "</p>",
        "    </div>",
        sequence.builtIn
          ? ""
          : '    <div class="button-row">' +
            '      <button class="button" type="button" data-action="edit-color-sequence" data-sequence-id="' + sequence.id + '">Edit</button>' +
            '      <button class="button" type="button" data-action="delete-color-sequence" data-sequence-id="' + sequence.id + '">Delete</button>' +
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

  function renderTextContentModeOptions(currentValue) {
    return [
      { id: "custom", label: "Custom text" },
      { id: "sequence", label: "Sequence" }
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

  function renderImageFitOptions(currentValue) {
    return [
      { id: "cover", label: "Cover" },
      { id: "contain", label: "Contain" },
      { id: "stretch", label: "Stretch" }
    ].map(function (option) {
      return '<option value="' + option.id + '"' + (currentValue === option.id ? " selected" : "") + ">" + option.label + "</option>";
    }).join("");
  }

  function renderSequenceOptions(sequences, selectedId, emptyLabel) {
    return ['<option value="">' + emptyLabel + "</option>"].concat(sequences.map(function (sequence) {
      return '<option value="' + sequence.id + '"' + (selectedId === sequence.id ? " selected" : "") + ">" + escapeHtml(sequence.name) + "</option>";
    })).join("");
  }

  function normalizeColorInput(value) {
    if (typeof value === "string" && value.startsWith("#")) {
      return value;
    }

    return "#000000";
  }

  function renderPrintSelectionForm(rows) {
    if (!rows.length) {
      return '<div class="empty-state">Create token templates in the designer before preparing print pages.</div>';
    }

    return [
      '<form class="form-grid" data-form="print-selections" novalidate>',
      '  <table class="print-table">',
      "    <thead><tr><th>Token</th><th>Copies</th><th>Start Index</th><th>Max</th></tr></thead>",
      "    <tbody>",
      rows.map(function (row) {
        return [
          "      <tr>",
          "        <td>" + escapeHtml(row.tokenName) + " (" + row.diameterIn + '&quot;)</td>',
          '        <td><input type="number" min="0" step="1" name="copies-' + row.tokenId + '" value="' + row.copies + '"' + (Number.isFinite(row.maxCopies) ? ' max="' + row.maxCopies + '"' : "") + "></td>",
          '        <td><input type="number" min="0" step="1" name="start-' + row.tokenId + '" value="' + row.sequenceStartIndex + '"></td>',
          "        <td>" + (Number.isFinite(row.maxCopies) ? row.maxCopies : "&infin;") + "</td>",
          "      </tr>"
        ].join("");
      }).join(""),
      "    </tbody>",
      "  </table>",
      '  <div class="button-row"><button class="button button-primary" type="submit">Save Print Selections</button></div>',
      "</form>"
    ].join("");
  }

  function renderPreviewSection(layout, project, faceName, title) {
    return [
      "    <h3>" + title + "</h3>",
      '    <div class="preview-page-grid">',
      layout.pages.map(function (page, index) {
        return [
          '<article class="preview-page-card">',
          '  <p class="preview-page-label">Page ' + (index + 1) + "</p>",
          '  <div class="preview-page-svg">',
          renderPageSvg(page, project, faceName, true),
          "  </div>",
          "</article>"
        ].join("");
      }).join(""),
      "    </div>"
    ].join("");
  }

  function renderPageSvg(page, project, faceName, isPreview) {
    var pageWidth = page.pageWidthIn * 100;
    var pageHeight = page.pageHeightIn * 100;
    return [
      '<svg viewBox="0 0 ' + pageWidth + " " + pageHeight + '" xmlns="http://www.w3.org/2000/svg"' + (isPreview ? "" : ' width="100%" height="100%"') + '>',
      '  <rect x="0" y="0" width="' + pageWidth + '" height="' + pageHeight + '" fill="#ffffff"></rect>',
      page.items.map(function (item) {
        return renderPageItem(item, project, faceName);
      }).join(""),
      "</svg>"
    ].join("");
  }

  function renderPageItem(item, project, faceName) {
    var x = item.xIn * 100;
    var y = item.yIn * 100;
    var size = item.diameterIn * 100;
    var centerX = x + size / 2;
    var centerY = y + size / 2;
    var guideStyle = project.settings.guideStyle;
    var tokenSvg = faceName === "back" && !item.token.back.enabled
      ? ""
      : Renderer.renderTokenSvg(item.token, project, {
        face: faceName,
        sequenceIndex: item.sequenceIndex,
        interactive: false,
        svgAttributes: 'x="' + x + '" y="' + y + '" width="' + size + '" height="' + size + '"'
      });

    return [
      renderGuideMarks(centerX, centerY, size / 2, guideStyle),
      tokenSvg
    ].join("");
  }

  function renderGuideMarks(centerX, centerY, radius, guideStyle) {
    var parts = [];

    if (guideStyle === "cut" || guideStyle === "cut-and-punch") {
      parts.push('<circle cx="' + centerX + '" cy="' + centerY + '" r="' + radius + '" fill="none" stroke="#777777" stroke-width="0.75"></circle>');
    }

    if (guideStyle === "punch" || guideStyle === "cut-and-punch") {
      parts.push('<line x1="' + (centerX - 4) + '" y1="' + centerY + '" x2="' + (centerX + 4) + '" y2="' + centerY + '" stroke="#999999" stroke-width="0.6"></line>');
      parts.push('<line x1="' + centerX + '" y1="' + (centerY - 4) + '" x2="' + centerX + '" y2="' + (centerY + 4) + '" stroke="#999999" stroke-width="0.6"></line>');
    }

    return parts.join("");
  }

  function openPrintWindow(layout, project, mode) {
    var printWindow = runtimeGlobal.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      runtimeGlobal.alert("The print window was blocked by the browser.");
      return;
    }

    var pages = [];
    if (mode === "front" || mode === "both") {
      pages = pages.concat(layout.pages.map(function (page) {
        return renderPrintablePage(page, project, "front");
      }));
    }
    if (mode === "back" || mode === "both") {
      pages = pages.concat(layout.pages.map(function (page) {
        return renderPrintablePage(page, project, "back");
      }));
    }

    printWindow.document.write([
      "<!doctype html><html><head><title>Monster Mint Print</title><style>",
      "html,body{margin:0;padding:0;background:#fff;font-family:Georgia,serif;}",
      ".print-page{page-break-after:always;break-after:page;display:block;}",
      ".print-page:last-child{page-break-after:auto;break-after:auto;}",
      "</style></head><body>",
      pages.join(""),
      "<script>window.addEventListener('load',function(){window.print();});<\/script>",
      "</body></html>"
    ].join(""));
    printWindow.document.close();
  }

  function renderPrintablePage(page, project, faceName) {
    return [
      '<div class="print-page" style="width:' + page.pageWidthIn + "in;height:" + page.pageHeightIn + 'in;">',
      renderPageSvg(page, project, faceName, false),
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
