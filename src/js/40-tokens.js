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
    return {
      id: payload.id || Utils.uid("text"),
      x: asCoordinate(payload.x, 0),
      y: asCoordinate(payload.y, 0),
      width: asSize(payload.width, 0.5),
      height: asSize(payload.height, 0.2),
      contentMode: payload.contentMode === "sequence" ? "sequence" : "custom",
      customText: payload.customText || "Token",
      textSequenceRef: payload.textSequenceRef || null,
      fontFamily: payload.fontFamily || "Georgia",
      fontWeight: payload.fontWeight || "700",
      colorMode: payload.colorMode === "sequence" ? "sequence" : "manual",
      color: payload.color || "#111111",
      colorSequenceRef: payload.colorSequenceRef || null,
      shadow: normalizeShadow(payload.shadow)
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
      rotationDeg: asSigned(payload.rotationDeg, 0),
      mirrorX: payload.mirrorX === true,
      mirrorY: payload.mirrorY === true,
      source: payload.source || "",
      name: payload.name || "Uploaded image"
    };
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

  function normalizeShadow(input) {
    var payload = input || {};
    return {
      enabled: payload.enabled === true,
      dx: asSigned(payload.dx, 1),
      dy: asSigned(payload.dy, 1),
      blur: asPositive(payload.blur, 1),
      color: payload.color || "rgba(0,0,0,0.5)"
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
    component.rotationDeg = asSigned(payload.rotationDeg, component.rotationDeg);
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
    if (component.contentMode !== "sequence") {
      return component.customText || "";
    }

    var sequence = textSequences.find(function (candidate) {
      return candidate.id === component.textSequenceRef;
    });

    return Sequences.resolveTextValue(sequence, index);
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
        if (component.contentMode === "sequence" && component.textSequenceRef) {
          lengths.push({ kind: "text", sequenceId: component.textSequenceRef });
        }

        if (component.colorMode === "sequence" && component.colorSequenceRef) {
          lengths.push({ kind: "color", sequenceId: component.colorSequenceRef });
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

  function asRatio(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? clamp(parsed, 0, 0.25) : fallback;
  }

  function asSigned(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) {
      return min;
    }

    return Math.min(max, Math.max(min, value));
  }

  return {
    createTokenTemplate: createTokenTemplate,
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
