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
      front: normalizeFace(payload.front),
      back: normalizeBackFace(payload.back)
    };
  }

  function createTextComponent(input) {
    var payload = input || {};
    return {
      id: payload.id || Utils.uid("text"),
      x: asUnit(payload.x, 0.18),
      y: asUnit(payload.y, 0.4),
      width: asSize(payload.width, 0.64),
      height: asSize(payload.height, 0.18),
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
      x: asUnit(payload.x, 0.15),
      y: asUnit(payload.y, 0.15),
      width: asSize(payload.width, 0.7),
      height: asSize(payload.height, 0.7),
      fit: payload.fit === "contain" || payload.fit === "stretch" ? payload.fit : "cover",
      source: payload.source || "",
      name: payload.name || "Uploaded image"
    };
  }

  function normalizeFace(input) {
    var payload = input || {};
    return {
      backgroundColorMode: payload.backgroundColorMode === "sequence" ? "sequence" : "manual",
      backgroundColor: payload.backgroundColor || "#f3e7c9",
      backgroundColorSequenceRef: payload.backgroundColorSequenceRef || null,
      images: Array.isArray(payload.images) ? payload.images.map(createImageComponent) : [],
      texts: Array.isArray(payload.texts) ? payload.texts.map(createTextComponent) : [],
      border: {
        enabled: payload.border?.enabled !== false,
        widthPt: asPositive(payload.border?.widthPt, 2),
        colorMode: payload.border?.colorMode === "sequence" ? "sequence" : "manual",
        color: payload.border?.color || "#000000",
        colorSequenceRef: payload.border?.colorSequenceRef || null
      }
    };
  }

  function normalizeBackFace(input) {
    var payload = input || {};
    return {
      enabled: payload.enabled === true,
      backgroundColorMode: payload.backgroundColorMode === "sequence" ? "sequence" : "manual",
      backgroundColor: payload.backgroundColor || "#ffffff",
      backgroundColorSequenceRef: payload.backgroundColorSequenceRef || null,
      images: Array.isArray(payload.images) ? payload.images.map(createImageComponent) : [],
      texts: Array.isArray(payload.texts) ? payload.texts.map(createTextComponent) : []
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
    var width = clamp(rect.width, 0.05, 1);
    var height = clamp(rect.height, 0.05, 1);
    var x = clamp(rect.x, 0, 1 - width);
    var y = clamp(rect.y, 0, 1 - height);

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

  function asUnit(value, fallback) {
    return clamp(Number(value), 0, 1) || fallback;
  }

  function asSize(value, fallback) {
    return clamp(Number(value), 0.05, 1) || fallback;
  }

  function asPositive(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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
    getTextValue: getTextValue,
    getColorValue: getColorValue,
    collectBoundedSequenceLengths: collectBoundedSequenceLengths
  };
});

