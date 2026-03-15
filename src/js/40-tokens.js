(function (global, factory) {
  var api = factory(global.MonsterMintUtils, global.MonsterMintSequences);
  global.MonsterMintTokens = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function (Utils, Sequences) {
  function createTokenTemplate(input) {
    var payload = input || {};
    return {
      id: payload.id || Utils.uid("token"),
      name: payload.name || "Untitled Token",
      diameterIn: normalizeDiameter(payload.diameterIn),
      borderUnderContent: payload.borderUnderContent === true,
      front: normalizeFace(payload.front),
      back: normalizeBackFace(payload.back)
    };
  }

  function createTextComponent(input) {
    var payload = input || {};
    var legacyMode = payload.contentMode === "sequence" ? resolveLegacyTextMode(payload.textSequenceRef) : null;
    return {
      id: payload.id || Utils.uid("text"),
      name: payload.name || "Text",
      x: asCoordinate(payload.x, 0),
      y: asCoordinate(payload.y, 0),
      width: asSize(payload.width, 0.5),
      height: asSize(payload.height, 0.2),
      contentMode: normalizeTextContentMode(payload.contentMode, legacyMode),
      customText: payload.customText || "Token",
      sequenceStart: asInteger(payload.sequenceStart, legacyMode === "alphabetic" ? 1 : (payload.start || 1)),
      sequencePad: asNonNegativeInteger(payload.sequencePad, payload.padTo || 0),
      fontFamily: payload.fontFamily || "Georgia",
      fontWeight: payload.fontWeight || "700",
      colorMode: payload.colorMode === "sequence" ? "sequence" : "manual",
      color: payload.color || "#111111",
      colorSequenceRef: payload.colorSequenceRef || null,
      textBorder: normalizeTextBorder(payload.textBorder || payload.shadow)
    };
  }

  function createImageComponent(input) {
    var payload = input || {};
    return {
      id: payload.id || Utils.uid("image"),
      x: asCoordinate(payload.x, 0),
      y: asCoordinate(payload.y, 0),
      scale: asScale(payload.scale, 0.5),
      aspectRatio: asAspectRatio(payload.aspectRatio, 1),
      rotationDeg: asRotation(payload.rotationDeg, 0),
      mirrorX: payload.mirrorX === true,
      mirrorY: payload.mirrorY === true,
      source: payload.source || "",
      name: payload.name || "Uploaded image"
    };
  }

  function cloneTokenTemplate(token) {
    return createTokenTemplate({
      name: (token.name || "Untitled Token") + " Copy",
      diameterIn: token.diameterIn,
      borderUnderContent: token.borderUnderContent === true,
      front: cloneFace(token.front),
      back: cloneBackFace(token.back)
    });
  }

  function normalizeFace(input) {
    var payload = input || {};
    var legacyWidthPt = payload.border && Number(payload.border.widthPt);
    return {
      backgroundColorMode: payload.backgroundColorMode === "sequence" ? "sequence" : "manual",
      backgroundColor: payload.backgroundColor || "#f3e7c9",
      backgroundColorSequenceRef: payload.backgroundColorSequenceRef || null,
      images: Array.isArray(payload.images) ? payload.images.map(createImageComponent) : [],
      texts: Array.isArray(payload.texts) ? payload.texts.map(createTextComponent) : [],
      border: {
        enabled: !payload.border || payload.border.enabled !== false,
        widthRatio: asRatio(
          payload.border && payload.border.widthRatio,
          payload.border && payload.border.enabled === false ? 0 : (Number.isFinite(legacyWidthPt) ? legacyWidthPt / 72 : 0.03)
        ),
        colorMode: payload.border && payload.border.colorMode === "sequence" ? "sequence" : "manual",
        color: payload.border && payload.border.color ? payload.border.color : "#000000",
        colorSequenceRef: payload.border && payload.border.colorSequenceRef ? payload.border.colorSequenceRef : null
      }
    };
  }

  function normalizeBackFace(input) {
    var payload = input || {};
    var legacyWidthPt = payload.border && Number(payload.border.widthPt);
    return {
      enabled: payload.enabled === true,
      backgroundColorMode: payload.backgroundColorMode === "sequence" ? "sequence" : "manual",
      backgroundColor: payload.backgroundColor || "#ffffff",
      backgroundColorSequenceRef: payload.backgroundColorSequenceRef || null,
      images: Array.isArray(payload.images) ? payload.images.map(createImageComponent) : [],
      texts: Array.isArray(payload.texts) ? payload.texts.map(createTextComponent) : [],
      border: {
        enabled: !payload.border || payload.border.enabled !== false,
        widthRatio: asRatio(
          payload.border && payload.border.widthRatio,
          payload.border && payload.border.enabled === false ? 0 : (Number.isFinite(legacyWidthPt) ? legacyWidthPt / 72 : 0)
        ),
        colorMode: payload.border && payload.border.colorMode === "sequence" ? "sequence" : "manual",
        color: payload.border && payload.border.color ? payload.border.color : "#000000",
        colorSequenceRef: payload.border && payload.border.colorSequenceRef ? payload.border.colorSequenceRef : null
      }
    };
  }

  function normalizeToken(input) {
    return createTokenTemplate(input);
  }

  function normalizeDiameter(value) {
    var parsed = Number(value);
    return [0.5, 1, 2, 3, 4, 5].includes(parsed) ? parsed : 1;
  }

  function normalizeTextBorder(input) {
    var payload = input || {};
    return {
      width: asBorderWidth(
        payload.width,
        payload.enabled === true ? 1 : 0
      ),
      colorMode: payload.colorMode === "sequence" ? "sequence" : "manual",
      color: isHexColor(payload.color) ? payload.color : "#111111",
      colorSequenceRef: payload.colorSequenceRef || null
    };
  }

  function clampRect(rect) {
    var width = clamp(rect.width, 0.05, 4);
    var height = clamp(rect.height, 0.05, 4);
    var x = asCoordinate(rect.x, 0);
    var y = asCoordinate(rect.y, 0);

    return {
      x: x,
      y: y,
      width: width,
      height: height
    };
  }

  function updateComponentRect(component, rect) {
    var nextRect = clampRect(rect);
    component.x = nextRect.x;
    component.y = nextRect.y;
    component.width = nextRect.width;
    component.height = nextRect.height;
    return component;
  }

  function updateImageComponent(component, payload) {
    component.x = asCoordinate(payload.x, component.x);
    component.y = asCoordinate(payload.y, component.y);
    component.scale = asScale(payload.scale, component.scale);
    component.rotationDeg = asRotation(payload.rotationDeg, component.rotationDeg);
    component.mirrorX = payload.mirrorX === true;
    component.mirrorY = payload.mirrorY === true;
    return component;
  }

  function getImageDimensions(component) {
    var largest = component.scale;
    if (component.aspectRatio >= 1) {
      return {
        width: largest,
        height: largest / component.aspectRatio
      };
    }

    return {
      width: largest * component.aspectRatio,
      height: largest
    };
  }

  function getTextValue(component, textSequences, index) {
    if (component.contentMode === "custom") {
      return component.customText || "";
    }

    var sequenceId = component.contentMode === "alphabetic" ? "builtin_text_alphabet" : "builtin_text_numeric";
    var sequence = textSequences.find(function (candidate) {
      return candidate.id === sequenceId;
    }) || { type: component.contentMode === "alphabetic" ? "alphabetic" : "numeric" };

    return Sequences.resolveTextValue(sequence, index, {
      start: component.sequenceStart,
      padTo: component.contentMode === "numeric" ? component.sequencePad : 0
    });
  }

  function getColorValue(mode, manualColor, sequenceRef, colorSequences, index) {
    if (mode !== "sequence") {
      return manualColor;
    }

    var sequence = colorSequences.find(function (candidate) {
      return candidate.id === sequenceRef;
    });

    return Sequences.resolveColorValue(sequence, index) || manualColor;
  }

  function collectBoundedSequenceLengths(token) {
    var lengths = [];
    var faces = [token.front, token.back];

    faces.forEach(function (face) {
      if (!face) {
        return;
      }

      face.texts.forEach(function (component) {
        if (component.colorMode === "sequence" && component.colorSequenceRef) {
          lengths.push({ kind: "color", sequenceId: component.colorSequenceRef });
        }

        if (component.textBorder && component.textBorder.colorMode === "sequence" && component.textBorder.colorSequenceRef) {
          lengths.push({ kind: "color", sequenceId: component.textBorder.colorSequenceRef });
        }
      });

      if (face.backgroundColorMode === "sequence" && face.backgroundColorSequenceRef) {
        lengths.push({ kind: "color", sequenceId: face.backgroundColorSequenceRef });
      }

      if (face.border && face.border.colorMode === "sequence" && face.border.colorSequenceRef) {
        lengths.push({ kind: "color", sequenceId: face.border.colorSequenceRef });
      }
    });

    return lengths;
  }

  function asCoordinate(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function asSize(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? clamp(parsed, 0.05, 4) : fallback;
  }

  function asScale(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? clamp(parsed, 0.05, 2) : fallback;
  }

  function asAspectRatio(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function asPositive(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function asBorderWidth(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? clamp(parsed, 0, 8) : fallback;
  }

  function asRatio(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? clamp(parsed, 0, 0.25) : fallback;
  }

  function asSigned(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function asRotation(value, fallback) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    var normalized = parsed % 360;
    if (normalized < 0) {
      normalized += 360;
    }
    if (normalized === 0 && parsed > 0) {
      return 360;
    }
    return Number(normalized.toFixed(2));
  }

  function asInteger(value, fallback) {
    var parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function asNonNegativeInteger(value, fallback) {
    var parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
  }

  function normalizeTextContentMode(value, legacyMode) {
    if (value === "numeric" || value === "alphabetic" || value === "custom") {
      return value;
    }

    return legacyMode || "custom";
  }

  function resolveLegacyTextMode(sequenceRef) {
    if (sequenceRef === "builtin_text_alphabet") {
      return "alphabetic";
    }

    if (sequenceRef === "builtin_text_numeric") {
      return "numeric";
    }

    return null;
  }

  function isHexColor(value) {
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || "").trim());
  }

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) {
      return min;
    }

    return Math.min(max, Math.max(min, value));
  }

  function cloneFace(face) {
    return {
      backgroundColorMode: face.backgroundColorMode,
      backgroundColor: face.backgroundColor,
      backgroundColorSequenceRef: face.backgroundColorSequenceRef,
      images: face.images.map(function (component) {
        return createImageComponent({
          x: component.x,
          y: component.y,
          scale: component.scale,
          aspectRatio: component.aspectRatio,
          rotationDeg: component.rotationDeg,
          mirrorX: component.mirrorX,
          mirrorY: component.mirrorY,
          source: component.source,
          name: component.name
        });
      }),
      texts: face.texts.map(function (component) {
        return createTextComponent({
          name: component.name,
          x: component.x,
          y: component.y,
          width: component.width,
          height: component.height,
          contentMode: component.contentMode,
          customText: component.customText,
          sequenceStart: component.sequenceStart,
          sequencePad: component.sequencePad,
          fontFamily: component.fontFamily,
          fontWeight: component.fontWeight,
          colorMode: component.colorMode,
          color: component.color,
          colorSequenceRef: component.colorSequenceRef,
          textBorder: {
            width: component.textBorder.width,
            colorMode: component.textBorder.colorMode,
            color: component.textBorder.color,
            colorSequenceRef: component.textBorder.colorSequenceRef
          }
        });
      }),
      border: {
        enabled: !face.border || face.border.enabled !== false,
        widthRatio: face.border ? face.border.widthRatio : 0,
        colorMode: face.border ? face.border.colorMode : "manual",
        color: face.border ? face.border.color : "#000000",
        colorSequenceRef: face.border ? face.border.colorSequenceRef : null
      }
    };
  }

  function cloneBackFace(face) {
    var nextFace = cloneFace(face);
    nextFace.enabled = face.enabled === true;
    return nextFace;
  }

  function copyFaceContent(token, sourceFaceName, targetFaceName) {
    if (!token || !token[sourceFaceName] || !token[targetFaceName] || sourceFaceName === targetFaceName) {
      return token;
    }

    if (targetFaceName === "back") {
      token.back = cloneBackFace({
        enabled: true,
        backgroundColorMode: token[sourceFaceName].backgroundColorMode,
        backgroundColor: token[sourceFaceName].backgroundColor,
        backgroundColorSequenceRef: token[sourceFaceName].backgroundColorSequenceRef,
        images: token[sourceFaceName].images,
        texts: token[sourceFaceName].texts,
        border: token[sourceFaceName].border
      });
      token.back.enabled = true;
      return token;
    }

    token.front = cloneFace(token[sourceFaceName]);
    return token;
  }

  return {
    createTokenTemplate: createTokenTemplate,
    cloneTokenTemplate: cloneTokenTemplate,
    copyFaceContent: copyFaceContent,
    createTextComponent: createTextComponent,
    createImageComponent: createImageComponent,
    normalizeToken: normalizeToken,
    clampRect: clampRect,
    updateComponentRect: updateComponentRect,
    updateImageComponent: updateImageComponent,
    getImageDimensions: getImageDimensions,
    getTextValue: getTextValue,
    getColorValue: getColorValue,
    collectBoundedSequenceLengths: collectBoundedSequenceLengths
  };
});
