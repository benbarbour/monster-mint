(function (global, factory) {
  var api = factory(global.MonsterMintUtils, global.MonsterMintSequences);
  global.MonsterMintTokens = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function (Utils, Sequences) {
  function createTokenTemplate(input) {
    var payload = input || {};
    var legacyBorderUnderContent = payload.borderUnderContent === true;
    var token = {
      id: payload.id || Utils.uid("token"),
      name: payload.name || "Untitled Token",
      diameterIn: normalizeDiameter(payload.diameterIn),
      borderUnderImages: payload.borderUnderImages === true || legacyBorderUnderContent,
      borderUnderText: payload.borderUnderText === true || legacyBorderUnderContent,
      front: normalizeFace(payload.front)
    };
    normalizeFaceZOrder(token.front, token);
    return token;
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
      contentMode: normalizeTextContentMode(
        payload.contentMode != null ? payload.contentMode : (legacyMode || "numeric"),
        legacyMode
      ),
      customText: payload.customText || "Token",
      sequenceStart: asInteger(payload.sequenceStart, legacyMode === "alphabetic" ? 1 : (payload.start || 1)),
      sequencePad: asNonNegativeInteger(payload.sequencePad, payload.padTo || 0),
      fontFamily: payload.fontFamily || "Georgia",
      fontWeight: payload.fontWeight || "700",
      colorMode: payload.colorMode === "sequence" ? "sequence" : "manual",
      color: payload.color || "#111111",
      colorSequenceRef: payload.colorSequenceRef || null,
      rotationDeg: asRotation(payload.rotationDeg, 0),
      zIndex: asComponentZ(payload.zIndex != null ? payload.zIndex : payload.z, 1),
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
      zIndex: asComponentZ(payload.zIndex != null ? payload.zIndex : payload.z, 1),
      source: payload.source || "",
      name: payload.name || "Uploaded image"
    };
  }

  function cloneTokenTemplate(token) {
    return createTokenTemplate({
      name: (token.name || "Untitled Token") + " Copy",
      diameterIn: token.diameterIn,
      front: cloneFace(token.front)
    });
  }

  function normalizeFace(input) {
    var payload = input || {};
    var legacyWidthPt = payload.border && Number(payload.border.widthPt);
    var background = normalizeFaceBackground(payload, "#f3e7c9");
    return {
      backgroundMode: background.backgroundMode,
      backgroundColorMode: background.backgroundColorMode,
      backgroundColor: background.backgroundColor,
      backgroundColorSequenceRef: background.backgroundColorSequenceRef,
      backgroundImageSource: background.backgroundImageSource,
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

  function normalizeToken(input) {
    return createTokenTemplate(input);
  }

  function normalizeFaceBackground(input, fallbackColor) {
    var payload = input || {};
    return {
      backgroundMode: payload.backgroundMode === "image" ? "image" : "color",
      backgroundColorMode: payload.backgroundColorMode === "sequence" ? "sequence" : "manual",
      backgroundColor: payload.backgroundColor || fallbackColor,
      backgroundColorSequenceRef: payload.backgroundColorSequenceRef || null,
      backgroundImageSource: typeof payload.backgroundImageSource === "string" ? payload.backgroundImageSource : ""
    };
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

  function resolveImageSource(project, value) {
    return Utils.resolveProjectImageSource(project, value);
  }

  function collectBoundedSequenceLengths(token) {
    var lengths = [];
    var faces = [token.front];

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

  function asBorderWidth(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? clamp(parsed, 0, 8) : fallback;
  }

  function asRatio(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? clamp(parsed, 0, 0.25) : fallback;
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

  function asComponentZ(value, fallback) {
    var parsed = asInteger(value, fallback);
    if (parsed === 0) {
      return fallback > 0 ? 1 : -1;
    }
    return parsed;
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

  function getFaceComponents(face) {
    return face.images.map(function (component) {
      return { type: "image", component: component };
    }).concat(face.texts.map(function (component) {
      return { type: "text", component: component };
    }));
  }

  function normalizeFaceZOrder(face, token) {
    if (!face) {
      return;
    }

    var legacyImagesAboveBorder = token && token.borderUnderImages === true;
    var legacyTextAboveBorder = token && token.borderUnderText === true;
    var negative = [];
    var positive = [];

    getFaceComponents(face).forEach(function (entry, index) {
      var z = Number(entry.component.zIndex);
      if (!Number.isFinite(z) || z === 0) {
        z = entry.type === "image"
          ? (legacyImagesAboveBorder ? index + 1 : -(index + 1))
          : (legacyTextAboveBorder ? index + 1001 : -(index + 1001));
      }

      if (z < 0) {
        negative.push({ type: entry.type, component: entry.component, sortKey: z });
      } else {
        positive.push({ type: entry.type, component: entry.component, sortKey: z });
      }
    });

    negative.sort(compareComponentEntries);
    positive.sort(compareComponentEntries);
    assignZOrder(negative, positive);
  }

  function compareComponentEntries(left, right) {
    if (left.sortKey !== right.sortKey) {
      return left.sortKey - right.sortKey;
    }
    if (left.type !== right.type) {
      return left.type === "image" ? -1 : 1;
    }
    return left.component.id.localeCompare(right.component.id);
  }

  function assignZOrder(negative, positive) {
    negative.forEach(function (entry, index) {
      entry.component.zIndex = index - negative.length;
    });
    positive.forEach(function (entry, index) {
      entry.component.zIndex = index + 1;
    });
  }

  function getSortedFaceComponents(face, direction) {
    var multiplier = direction === "desc" ? -1 : 1;
    return getFaceComponents(face).slice().sort(function (left, right) {
      var delta = (Number(left.component.zIndex || 0) - Number(right.component.zIndex || 0)) * multiplier;
      if (delta !== 0) {
        return delta;
      }
      if (left.type !== right.type) {
        return left.type === "image" ? -1 : 1;
      }
      return left.component.id.localeCompare(right.component.id);
    });
  }

  function getNextComponentZ(face) {
    var sorted = getSortedFaceComponents(face);
    var highest = sorted.length ? Number(sorted[sorted.length - 1].component.zIndex || 0) : 0;
    return Math.max(1, highest + 1);
  }

  function canMoveComponentZ(face, componentType, componentId, direction) {
    var slots = buildZSlots(face);
    var index = findSlotIndex(slots, componentType, componentId);
    if (index < 0) {
      return false;
    }
    return direction === "up" ? index < slots.length - 1 : index > 0;
  }

  function moveComponentZ(face, componentType, componentId, direction) {
    var slots = buildZSlots(face);
    var index = findSlotIndex(slots, componentType, componentId);
    if (index < 0) {
      return false;
    }

    var targetIndex = direction === "up" ? index + 1 : index - 1;
    if (targetIndex < 0 || targetIndex >= slots.length) {
      return false;
    }

    var moved = slots[index];
    slots[index] = slots[targetIndex];
    slots[targetIndex] = moved;
    reassignZFromSlots(slots);
    return true;
  }

  function buildZSlots(face) {
    var sorted = getSortedFaceComponents(face);
    var negative = sorted.filter(function (entry) {
      return entry.component.zIndex < 0;
    });
    var positive = sorted.filter(function (entry) {
      return entry.component.zIndex > 0;
    });
    return negative.concat([{ type: "border", component: null }], positive);
  }

  function findSlotIndex(slots, componentType, componentId) {
    return slots.findIndex(function (entry) {
      return entry.type === componentType && entry.component && entry.component.id === componentId;
    });
  }

  function reassignZFromSlots(slots) {
    var borderIndex = slots.findIndex(function (entry) {
      return entry.type === "border";
    });
    assignZOrder(slots.slice(0, borderIndex), slots.slice(borderIndex + 1));
  }

  function cloneFace(face) {
    return {
      backgroundMode: face.backgroundMode,
      backgroundColorMode: face.backgroundColorMode,
      backgroundColor: face.backgroundColor,
      backgroundColorSequenceRef: face.backgroundColorSequenceRef,
      backgroundImageSource: face.backgroundImageSource,
      images: face.images.map(function (component) {
        return createImageComponent({
          x: component.x,
          y: component.y,
          scale: component.scale,
          aspectRatio: component.aspectRatio,
          rotationDeg: component.rotationDeg,
          mirrorX: component.mirrorX,
          mirrorY: component.mirrorY,
          zIndex: component.zIndex,
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
          rotationDeg: component.rotationDeg,
          zIndex: component.zIndex,
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

  return {
    createTokenTemplate: createTokenTemplate,
    cloneTokenTemplate: cloneTokenTemplate,
    createTextComponent: createTextComponent,
    createImageComponent: createImageComponent,
    normalizeToken: normalizeToken,
    getSortedFaceComponents: getSortedFaceComponents,
    getNextComponentZ: getNextComponentZ,
    canMoveComponentZ: canMoveComponentZ,
    moveComponentZ: moveComponentZ,
    clampRect: clampRect,
    updateComponentRect: updateComponentRect,
    updateImageComponent: updateImageComponent,
    getImageDimensions: getImageDimensions,
    getTextValue: getTextValue,
    getColorValue: getColorValue,
    resolveImageSource: resolveImageSource,
    normalizeFaceBackground: normalizeFaceBackground,
    collectBoundedSequenceLengths: collectBoundedSequenceLengths
  };
});
