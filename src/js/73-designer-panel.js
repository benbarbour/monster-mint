(function (global, factory) {
  var api = factory(
    global.MonsterMintSchema,
    global.MonsterMintTokens,
    global.MonsterMintRenderer,
    global.MonsterMintUi
  );
  global.MonsterMintAppDesignerPanel = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (Schema, Tokens, Renderer, Ui) {
  var runtimeGlobal = typeof globalThis !== "undefined" ? globalThis : window;
  var escapeHtml = Ui.escapeHtml;

  function naturalLabelCompare(left, right) {
    return String(left || "").localeCompare(String(right || ""), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  function renderPanel(state, helpers) {
    var selection = helpers.getDesignerSelection(state);
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

    var face = token.front;
    var selectedComponent = helpers.getSelectedComponent(face, selection.selectedComponentType, selection.selectedComponentId);
    var componentItems = getComponentItems(face);
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
      "        </div>",
      '        <div class="designer-toolbar-row component-row">',
      '          <label class="field toolbar-field">Component<select name="selectedComponentKey">' + renderComponentOptions(componentItems, selection.selectedComponentType, selection.selectedComponentId) + '</select></label>',
      '          <div class="button-row">',
      '            <button class="button" type="button" data-action="add-text">Add Text</button>',
      '            <button class="button" type="button" data-action="add-image">Add Image</button>',
      '            <button class="button icon-trash" type="button" data-action="delete-component"' + (canDeleteSelectedComponent(selection) ? "" : " disabled") + ' aria-label="Delete Selected Component" title="Delete Selected Component"><span aria-hidden="true">&#128465;</span></button>',
      '            <input class="visually-hidden" type="file" accept="image/*" data-image-upload-input>',
      "          </div>",
      "        </div>",
      "      </div>",
      "    </section>",
      '    <section class="panel-card preview-shell">',
      '      <div class="preview-stage" data-preview-stage>',
      Renderer.renderTokenSvg(token, state.project, {
        sequenceIndex: 0,
        instanceId: "designer-front",
        interactive: true,
        selectedComponentType: selection.selectedComponentType,
        selectedComponentId: selection.selectedComponentId
      }),
      "      </div>",
      '      <p class="preview-note">Drag visible content to move it. Resize images from any edge, resize text from any edge or the corner handle, rotate images from the top handle, or use the mouse wheel to scale the selected component.</p>',
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
      (selectedComponent ? renderSelectedComponentForm(selectedComponent, selection, state.project, helpers) : renderTokenForm(token, state.project, helpers)),
      "      </section>",
      "    </div>",
      "  </aside>",
      "</div>"
    ].join("");
  }

  function renderTokenOptions(tokens, selectedTokenId) {
    return tokens.slice().sort(function (left, right) {
      return naturalLabelCompare(left.name + " (" + left.diameterIn + '")', right.name + " (" + right.diameterIn + '")');
    }).map(function (token) {
      return '<option value="' + token.id + '"' + (token.id === selectedTokenId ? " selected" : "") + ">" + escapeHtml(token.name) + " (" + token.diameterIn + '&quot;)</option>';
    }).join("");
  }

  function getComponentItems(face) {
    return Tokens.getSortedFaceComponents(face, "desc").map(function (entry) {
      var component = entry.component;
      return {
        type: entry.type,
        id: component.id,
        label: component.name || (entry.type === "image" ? "Image" : "Text")
      };
    });
  }

  function renderComponentOptions(items, selectedType, selectedId) {
    return ['<option value="">' + "Token settings" + "</option>"].concat(items.slice().sort(function (left, right) {
      return naturalLabelCompare(left.label, right.label);
    }).map(function (item) {
      var isSelected = selectedType === item.type && selectedId === item.id;
      return '<option value="' + item.type + ":" + item.id + '"' + (isSelected ? " selected" : "") + ">" + escapeHtml(item.label) + "</option>";
    })).join("");
  }

  function canDeleteSelectedComponent(selection) {
    return selection.selectedComponentType === "image" || selection.selectedComponentType === "text";
  }

  function renderTokenForm(token, project, helpers) {
    var face = token.front;
    return [
      '<form class="form-grid" data-form="token-settings">',
      '  <label class="field">Name<input name="name" value="' + escapeHtml(token.name) + '" required></label>',
      '  <label class="field">Diameter<select name="diameterIn">' + Schema.TOKEN_SIZES.slice().sort(function (left, right) {
        return Number(left) - Number(right);
      }).map(function (size) {
        return '<option value="' + size + '"' + (size === token.diameterIn ? " selected" : "") + ">" + size + '&quot;</option>';
      }).join("") + "</select></label>",
      '  <p class="field-help">Editing token appearance.</p>',
      helpers.renderBackgroundControls({
        modeName: "backgroundMode",
        currentMode: face.backgroundMode,
        colorLabel: "Background",
        sourceName: "backgroundColorSource",
        colorName: "backgroundColor",
        currentColorMode: face.backgroundColorMode,
        currentColor: face.backgroundColor,
        currentSequenceRef: face.backgroundColorSequenceRef,
        sequences: project.sequences.color,
        imageSource: face.backgroundImageSource,
        uploadAction: "upload-token-background",
        removeAction: "remove-token-background",
        inputAttributes: 'data-token-background-input'
      }),
      '  <label class="field">Border width<input type="range" min="0" max="0.25" step="0.01" name="borderWidthRatio" value="' + face.border.widthRatio.toFixed(2) + '"><span class="field-help">' + Math.round(face.border.widthRatio * 100) + '% of token width</span></label>',
      helpers.renderColorPicker({
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

  function renderSelectedComponentForm(component, selection, project, helpers) {
    if (!component) {
      return '<div class="empty-state">Select a component to edit it.</div>';
    }

    if (selection.selectedComponentType === "text") {
      return renderTextComponentForm(component, selection, project, helpers);
    }

    return renderImageComponentForm(component, selection);
  }

  function renderTextComponentForm(component, selection, project, helpers) {
    return [
      '<form class="form-grid" data-form="text-component-settings">',
      '  <label class="field">Label<input name="name" value="' + escapeHtml(component.name || "Text") + '"></label>',
      renderZOrderControls(component, selection),
      '  <label class="field">Content mode<select name="contentMode">' + helpers.renderTextContentModeOptions(component.contentMode) + "</select></label>",
      helpers.renderConditionalField("contentMode:custom", component.contentMode === "custom", 'Text<input name="customText" value="' + escapeHtml(component.customText) + '">'),
      helpers.renderConditionalBlock("contentMode:numeric|alphabetic", component.contentMode === "numeric" || component.contentMode === "alphabetic", [
        '<div class="field-row two-up">',
        '  <label class="field">Start<input type="number" step="1" name="sequenceStart" value="' + component.sequenceStart + '"></label>',
        component.contentMode === "numeric"
          ? '  <label class="field">Pad<input type="number" min="0" step="1" name="sequencePad" value="' + component.sequencePad + '"></label>'
          : "  <div></div>",
        "</div>"
      ].join("")),
      '  <div class="field-row two-up">',
      '    <label class="field">Font family<select name="fontFamily">' + helpers.renderFontFamilyOptions(component.fontFamily) + "</select></label>",
      '    <label class="field">Font weight<select name="fontWeight">' + helpers.renderFontWeightOptions(component.fontWeight) + "</select></label>",
      "  </div>",
      helpers.renderColorPicker({
        label: "Text color",
        sourceName: "colorSource",
        colorName: "color",
        currentMode: component.colorMode,
        currentColor: component.color,
        currentSequenceRef: component.colorSequenceRef,
        sequences: project.sequences.color
      }),
      renderBoundsFields(component),
      renderTextBorderFields(component.textBorder, project, helpers),
      '  <p class="field-help">Changes save automatically.</p>',
      "</form>"
    ].join("");
  }

  function renderImageComponentForm(component, selection) {
    return [
      '<form class="form-grid" data-form="image-component-settings">',
      '  <label class="field">Label<input name="name" value="' + escapeHtml(component.name) + '"></label>',
      renderZOrderControls(component, selection),
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

  function renderZOrderControls(component, selection) {
    var face = selection.token ? selection.token.front : null;
    var canMoveUp = face ? Tokens.canMoveComponentZ(face, selection.selectedComponentType, component.id, "up") : false;
    var canMoveDown = face ? Tokens.canMoveComponentZ(face, selection.selectedComponentType, component.id, "down") : false;
    return [
      '<div class="field">',
      '  <span>Z-order</span>',
      '  <div class="button-row">',
      '    <button class="button" type="button" data-action="move-component-up"' + (canMoveUp ? "" : " disabled") + '>Up</button>',
      '    <button class="button" type="button" data-action="move-component-down"' + (canMoveDown ? "" : " disabled") + '>Down</button>',
      "  </div>",
      '  <span class="field-help">Border is layer 0. Lower layers render below it, higher layers above it.</span>',
      "</div>"
    ].join("");
  }

  function renderPositionFields(component) {
    return [
      '<div class="field-row two-up">',
      '  <label class="field">Center X<input type="number" step="0.01" name="x" value="' + component.x.toFixed(2) + '"></label>',
      '  <label class="field">Center Y<input type="number" step="0.01" name="y" value="' + (-Number(component.y || 0)).toFixed(2) + '"></label>',
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

  function renderTextBorderFields(textBorder, project, helpers) {
    return [
      '<label class="field">Text border<input type="number" min="0" max="8" step="0.1" name="textBorderWidth" value="' + textBorder.width + '"><span class="field-help">0 turns it off.</span></label>',
      helpers.renderColorPicker({
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

  function bindForms(appElement, store, helpers) {
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

    var tokenForm = appElement.querySelector("[data-form='token-settings']");
    if (tokenForm) {
      tokenForm.querySelectorAll('select[name="backgroundMode"], select[name="backgroundColorSource"], select[name="borderColorSource"]').forEach(function (element) {
        element.addEventListener("change", function () {
          helpers.syncConditionalFields(tokenForm, {
            backgroundMode: tokenForm.querySelector('[name="backgroundMode"]').value,
            backgroundColorSource: tokenForm.querySelector('[name="backgroundColorSource"]').value,
            borderColorSource: tokenForm.querySelector('[name="borderColorSource"]').value
          }, helpers.conditionalFieldPreserve);
        });
      });
      helpers.syncConditionalFields(tokenForm, {
        backgroundMode: tokenForm.querySelector('[name="backgroundMode"]').value,
        backgroundColorSource: tokenForm.querySelector('[name="backgroundColorSource"]').value,
        borderColorSource: tokenForm.querySelector('[name="borderColorSource"]').value
      }, helpers.conditionalFieldPreserve);
      tokenForm.addEventListener("change", function () {
        var selection = helpers.getDesignerSelection(store.getState());
        if (!selection.token) {
          return;
        }
        var formData = new FormData(tokenForm);
        store.updateProject(function (project) {
          var token = helpers.findToken(project, selection.token.id);
          var face = token.front;
          var backgroundColorSelection = helpers.parseColorSourceValue(formData.get("backgroundColorSource"));
          var borderColorSelection = helpers.parseColorSourceValue(formData.get("borderColorSource"));
          token.name = String(formData.get("name")) || token.name;
          token.diameterIn = Number(formData.get("diameterIn")) || token.diameterIn;
          face.backgroundMode = String(formData.get("backgroundMode")) === "image" ? "image" : "color";
          face.backgroundColorMode = backgroundColorSelection.mode;
          face.backgroundColor = String(formData.get("backgroundColor") || face.backgroundColor);
          face.backgroundColorSequenceRef = backgroundColorSelection.sequenceRef;
          face.border.widthRatio = helpers.toNumberOrDefault(formData.get("borderWidthRatio"), face.border.widthRatio);
          face.border.colorMode = borderColorSelection.mode;
          face.border.color = String(formData.get("borderColor") || face.border.color);
          face.border.colorSequenceRef = borderColorSelection.sequenceRef;
        });
      });

      helpers.bindBackgroundUploadControls(tokenForm, {
        inputSelector: "[data-token-background-input]",
        importOptions: helpers.getImageImportOptions(store.getState().project),
        onUpload: function (imageAsset) {
          var selection = helpers.getDesignerSelection(store.getState());
          if (!selection.token) {
            return;
          }
          store.updateProject(function (project) {
            var token = helpers.findToken(project, selection.token.id);
            if (!token) {
              return;
            }
            token.front.backgroundMode = "image";
            token.front.backgroundImageSource = imageAsset.source;
          });
        }
      });
    }

    var addImageInput = appElement.querySelector("[data-image-upload-input]");
    if (addImageInput) {
      addImageInput.addEventListener("change", async function () {
        var file = addImageInput.files && addImageInput.files[0];
        var selection = helpers.getDesignerSelection(store.getState());
        if (!file || !selection.token) {
          return;
        }
        try {
          var imageAsset = await helpers.readImageAssetFile(file, helpers.getImageImportOptions(store.getState().project));
          var component = Tokens.createImageComponent({
            source: imageAsset.source,
            name: file.name,
            aspectRatio: imageAsset.width / imageAsset.height,
            zIndex: Tokens.getNextComponentZ(selection.token.front)
          });
          store.updateProject(function (project) {
            var token = helpers.findToken(project, selection.token.id);
            token.front.images.push(component);
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

    var textComponentForm = appElement.querySelector("[data-form='text-component-settings']");
    if (textComponentForm) {
      var syncTextComponentVisibility = function () {
        var contentModeField = textComponentForm.querySelector('[name="contentMode"]');
        var colorSourceField = textComponentForm.querySelector('[name="colorSource"]');
        var textBorderColorSourceField = textComponentForm.querySelector('[name="textBorderColorSource"]');
        helpers.syncConditionalFields(textComponentForm, {
          contentMode: contentModeField ? contentModeField.value : null,
          colorSource: colorSourceField ? colorSourceField.value : null,
          textBorderColorSource: textBorderColorSourceField ? textBorderColorSourceField.value : null
        }, helpers.conditionalFieldPreserve);
      };
      textComponentForm.querySelectorAll('select[name="contentMode"], select[name="colorSource"], select[name="textBorderColorSource"]').forEach(function (element) {
        element.addEventListener("change", syncTextComponentVisibility);
      });
      syncTextComponentVisibility();

      textComponentForm.addEventListener("change", function () {
        var selection = helpers.getDesignerSelection(store.getState());
        if (!selection.token || selection.selectedComponentType !== "text") {
          return;
        }
        var formData = new FormData(textComponentForm);
        store.updateProject(function (project) {
          var component = helpers.findComponent(project, selection, "text");
          if (!component) {
            return;
          }
          var textColorSelection = helpers.parseColorSourceValue(formData.get("colorSource"));
          var textBorderColorSelection = helpers.parseColorSourceValue(formData.get("textBorderColorSource"));
          component.name = String(formData.get("name") || component.name);
          component.contentMode = String(formData.get("contentMode"));
          component.customText = String(formData.get("customText") || "");
          component.sequenceStart = helpers.toIntegerOrDefault(formData.get("sequenceStart"), component.sequenceStart);
          component.sequencePad = helpers.toNonNegativeInteger(formData.get("sequencePad"), component.sequencePad);
          component.fontFamily = String(formData.get("fontFamily") || component.fontFamily);
          component.fontWeight = String(formData.get("fontWeight") || component.fontWeight);
          component.colorMode = textColorSelection.mode;
          component.color = String(formData.get("color") || component.color);
          component.colorSequenceRef = textColorSelection.sequenceRef;
          helpers.applyBoundsFromForm(component, formData);
          component.textBorder.width = helpers.toNumberOrDefault(formData.get("textBorderWidth"), component.textBorder.width);
          component.textBorder.colorMode = textBorderColorSelection.mode;
          component.textBorder.color = String(formData.get("textBorderColor") || component.textBorder.color);
          component.textBorder.colorSequenceRef = textBorderColorSelection.sequenceRef;
        });
      });
    }

    var imageComponentForm = appElement.querySelector("[data-form='image-component-settings']");
    if (imageComponentForm) {
      imageComponentForm.addEventListener("change", function () {
        var selection = helpers.getDesignerSelection(store.getState());
        if (!selection.token || selection.selectedComponentType !== "image") {
          return;
        }
        var formData = new FormData(imageComponentForm);
        store.updateProject(function (project) {
          var component = helpers.findComponent(project, selection, "image");
          if (!component) {
            return;
          }
          component.name = String(formData.get("name") || component.name);
          Tokens.updateImageComponent(component, {
            x: helpers.toNumberOrDefault(formData.get("x"), component.x),
            y: helpers.fromDisplayCenterY(formData.get("y"), component.y),
            scale: helpers.toNumberOrDefault(formData.get("scale"), component.scale),
            rotationDeg: helpers.toNumberOrDefault(formData.get("rotationDeg"), component.rotationDeg),
            mirrorX: formData.get("mirrorX") === "on",
            mirrorY: formData.get("mirrorY") === "on"
          });
        });
      });

      var replaceImageInput = imageComponentForm.querySelector("[data-replace-image-input]");
      if (replaceImageInput) {
        replaceImageInput.addEventListener("change", async function () {
          var file = replaceImageInput.files && replaceImageInput.files[0];
          var selection = helpers.getDesignerSelection(store.getState());
          if (!file || !selection.token || selection.selectedComponentType !== "image") {
            return;
          }
          try {
            var imageAsset = await helpers.readImageAssetFile(file, helpers.getImageImportOptions(store.getState().project));
            store.updateProject(function (project) {
              var component = helpers.findComponent(project, selection, "image");
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
  }

  return {
    renderPanel: renderPanel,
    bindForms: bindForms,
    canDeleteSelectedComponent: canDeleteSelectedComponent
  };
});
