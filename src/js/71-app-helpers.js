(function (global, factory) {
  var api = factory(
    global.MonsterMintSchema,
    global.MonsterMintSequences,
    global.MonsterMintUtils,
    global.MonsterMintPrint,
    global.MonsterMintTokens,
    global.MonsterMintUi
  );
  global.MonsterMintAppHelpers = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (Schema, Sequences, Utils, Print, Tokens, Ui) {
  var runtimeGlobal = typeof globalThis !== "undefined" ? globalThis : window;
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
  var escapeHtml = Ui.escapeHtml;
  var renderConditionalBlock = Ui.renderConditionalBlock;
  var decomposeColorValue = Ui.decomposeColorValue;
  var normalizeColorInput = Ui.normalizeColorInput;
  var getColorTransparencyInput = Ui.getColorTransparencyInput;
  var resolveManualColorValue = Ui.resolveManualColorValue;
  var toNumberOrDefault = Ui.toNumberOrDefault;

  function naturalLabelCompare(left, right) {
    return String(left || "").localeCompare(String(right || ""), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  function sortByLabel(items, getLabel) {
    return items.slice().sort(function (left, right) {
      return naturalLabelCompare(getLabel(left), getLabel(right));
    });
  }

  function renderDefaultTokenSettingsForm(tokenDefaults, colorSequences) {
    return [
      '<form class="form-grid" data-form="token-defaults">',
      '  <label class="field">Diameter<select name="defaultDiameterIn">' + Schema.TOKEN_SIZES.slice().sort(function (left, right) {
        return Number(left) - Number(right);
      }).map(function (size) {
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
      '  <p class="field-help">New tokens start with these defaults.</p>',
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
    var manualColor = decomposeColorValue(config.currentColor);
    var summary = isManual
      ? manualColor.hex + (manualColor.transparency > 0 ? " · " + manualColor.transparency + "% transparent" : "")
      : "Sequence: " + getSequenceName(config.sequences, sourceValue);
    var swatch = isManual
      ? resolveManualColorValue(manualColor.hex, manualColor.transparency, config.currentColor)
      : (config.currentColor || "#ffffff");

    return [
      '<div class="field color-picker-field">',
      '  <span>' + escapeHtml(config.label) + "</span>",
      '  <details class="color-picker" data-color-picker>',
      '    <summary class="color-picker-summary"><span class="color-picker-swatch" style="--swatch:' + escapeHtml(swatch) + '"></span><span>' + escapeHtml(summary) + "</span></summary>",
      '    <div class="color-picker-panel">',
      '      <label class="field">Color<select name="' + config.sourceName + '">' + renderColorSourceOptions(config.sequences, sourceValue) + "</select></label>",
      renderConditionalBlock(config.sourceName + ':manual', isManual, [
        '<label class="field">Custom color<input type="color" name="' + config.colorName + 'Base" value="' + normalizeColorInput(config.currentColor) + '"></label>',
        '<label class="field">Transparency<input type="range" min="0" max="100" step="1" name="' + config.colorName + 'Transparency" value="' + getColorTransparencyInput(config.currentColor) + '"><span class="field-help">' + getColorTransparencyInput(config.currentColor) + '% transparent</span></label>'
      ].join("")),
      "    </div>",
      "  </details>",
      "</div>"
    ].join("");
  }

  function readColorFormValue(formData, colorName, fallback) {
    return resolveManualColorValue(
      formData.get(colorName + "Base"),
      formData.get(colorName + "Transparency"),
      fallback
    );
  }

  function renderColorSourceOptions(sequences, selectedValue) {
    return ['<option value="manual"' + (selectedValue === "manual" ? " selected" : "") + '>Manual</option>']
      .concat(sortByLabel(sequences, function (sequence) {
        return sequence.name;
      }).map(function (sequence) {
        return '<option value="' + sequence.id + '"' + (selectedValue === sequence.id ? " selected" : "") + ">" + escapeHtml(sequence.name) + "</option>";
      }))
      .join("");
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
    if (!input) {
      return;
    }

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
    return sortByLabel([
      { id: "numeric", label: "Number Sequence" },
      { id: "alphabetic", label: "Alphabet Sequence" },
      { id: "custom", label: "Custom Text" }
    ], function (option) {
      return option.label;
    }).map(function (option) {
      return '<option value="' + option.id + '"' + (currentValue === option.id ? " selected" : "") + ">" + option.label + "</option>";
    }).join("");
  }

  function renderFontWeightOptions(currentValue) {
    return ["400", "500", "600", "700", "800"].slice().sort(function (left, right) {
      return Number(left) - Number(right);
    }).map(function (value) {
      return '<option value="' + value + '"' + (currentValue === value ? " selected" : "") + ">" + value + "</option>";
    }).join("");
  }

  function renderFontFamilyOptions(currentValue) {
    var options = FONT_CHOICES.slice();
    if (currentValue && !options.some(function (option) { return option.value === currentValue; })) {
      options.push({ value: currentValue, label: currentValue });
    }
    return sortByLabel(options, function (option) {
      return option.label;
    }).map(function (option) {
      return '<option value="' + escapeHtml(option.value) + '"' + (currentValue === option.value ? " selected" : "") + ">" + escapeHtml(option.label) + "</option>";
    }).join("");
  }

  function renderSequenceOptions(sequences, selectedId, emptyLabel, options) {
    var opts = options || {};
    var builtIns = sortByLabel(sequences.filter(function (sequence) {
      return sequence.builtIn;
    }), function (sequence) {
      return sequence.name;
    });
    var custom = sortByLabel(sequences.filter(function (sequence) {
      return !sequence.builtIn;
    }), function (sequence) {
      return sequence.name;
    });

    if (opts.grouped === false) {
      return ['<option value="">' + emptyLabel + "</option>"].concat(sortByLabel(sequences, function (sequence) {
        return sequence.name;
      }).map(function (sequence) {
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

  return {
    FONT_CHOICES: FONT_CHOICES,
    renderDefaultTokenSettingsForm: renderDefaultTokenSettingsForm,
    renderDefaultTextSettingsForm: renderDefaultTextSettingsForm,
    renderImageImportSettingsForm: renderImageImportSettingsForm,
    renderBackgroundControls: renderBackgroundControls,
    renderColorPicker: renderColorPicker,
    readColorFormValue: readColorFormValue,
    getDesignerSelection: getDesignerSelection,
    getSelectedComponent: getSelectedComponent,
    findToken: findToken,
    findComponent: findComponent,
    applyBoundsFromForm: applyBoundsFromForm,
    toDisplayCenterY: toDisplayCenterY,
    fromDisplayCenterY: fromDisplayCenterY,
    getImageImportOptions: getImageImportOptions,
    collectPrintSelectionRows: collectPrintSelectionRows,
    upsertById: upsertById,
    applyTokenDefaults: applyTokenDefaults,
    bindBackgroundUploadControls: bindBackgroundUploadControls,
    renderColorSequenceManager: renderColorSequenceManager,
    renderColorSequenceForm: renderColorSequenceForm,
    renderTextContentModeOptions: renderTextContentModeOptions,
    renderFontWeightOptions: renderFontWeightOptions,
    renderFontFamilyOptions: renderFontFamilyOptions,
    getSelectedSequence: getSelectedSequence,
    getSequenceName: getSequenceName
  };
});
