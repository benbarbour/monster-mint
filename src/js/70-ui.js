(function (global, factory) {
  var api = factory();
  global.MonsterMintUi = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;");
  }

  function renderConditionalField(visibleWhen, isVisible, innerHtml) {
    return '<label class="field" data-visible-when="' + visibleWhen + '"' + (isVisible ? "" : ' hidden style="display:none"') + ">" + innerHtml + "</label>";
  }

  function renderConditionalBlock(visibleWhen, isVisible, innerHtml) {
    return '<div data-visible-when="' + visibleWhen + '"' + (isVisible ? "" : ' hidden style="display:none"') + ">" + innerHtml + "</div>";
  }

  function syncConditionalFields(form, values, preservedFieldNames) {
    var preserved = {};
    (preservedFieldNames || []).forEach(function (name) {
      preserved[name] = true;
    });

    form.querySelectorAll("[data-visible-when]").forEach(function (element) {
      var parts = element.getAttribute("data-visible-when").split(":");
      var fieldName = parts[0];
      var expectedValues = parts[1].split("|");
      var isVisible = expectedValues.indexOf(values[fieldName]) !== -1;
      element.hidden = !isVisible;
      element.style.display = isVisible ? "" : "none";
      element.querySelectorAll("input, select, textarea, button").forEach(function (control) {
        if (preserved[control.name]) {
          return;
        }
        control.disabled = !isVisible;
      });
    });
  }

  function parseColorSourceValue(value) {
    var source = value ? String(value) : "manual";
    return source === "manual"
      ? { mode: "manual", sequenceRef: null }
      : { mode: "sequence", sequenceRef: source };
  }

  function clampTransparency(value) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(parsed)));
  }

  function toHexChannel(value) {
    var clamped = Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
    return clamped.toString(16).padStart(2, "0");
  }

  function expandHexColor(value) {
    var input = String(value || "").trim();
    if (!/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(input)) {
      return "";
    }

    var digits = input.slice(1).toLowerCase();
    if (digits.length === 3 || digits.length === 4) {
      digits = digits.split("").map(function (digit) {
        return digit + digit;
      }).join("");
    }

    return "#" + digits;
  }

  function decomposeColorValue(value) {
    var input = String(value || "").trim();
    if (!input) {
      return { hex: "#000000", transparency: 0 };
    }

    if (input.toLowerCase() === "transparent") {
      return { hex: "#000000", transparency: 100 };
    }

    var hex = expandHexColor(input);
    if (hex) {
      if (hex.length === 9) {
        var alphaHex = hex.slice(7, 9);
        var alpha = Number.parseInt(alphaHex, 16);
        return {
          hex: hex.slice(0, 7),
          transparency: clampTransparency(((255 - alpha) / 255) * 100)
        };
      }
      return {
        hex: hex.slice(0, 7),
        transparency: 0
      };
    }

    var rgbMatch = input.match(/^rgba?\((.+)\)$/i);
    if (rgbMatch) {
      var parts = rgbMatch[1].split(",").map(function (part) {
        return part.trim();
      });
      if (parts.length === 3 || parts.length === 4) {
        var alphaValue = 1;
        if (parts.length === 4) {
          if (parts[3].endsWith("%")) {
            alphaValue = Number(parts[3].slice(0, -1)) / 100;
          } else {
            alphaValue = Number(parts[3]);
          }
        }
        if (
          parts.slice(0, 3).every(function (part) { return Number.isFinite(Number(part)); }) &&
          Number.isFinite(alphaValue)
        ) {
          return {
            hex: "#" + [parts[0], parts[1], parts[2]].map(toHexChannel).join(""),
            transparency: clampTransparency((1 - Math.max(0, Math.min(1, alphaValue))) * 100)
          };
        }
      }
    }

    return { hex: "#000000", transparency: 0 };
  }

  function normalizeColorInput(value) {
    return decomposeColorValue(value).hex;
  }

  function getColorTransparencyInput(value) {
    return decomposeColorValue(value).transparency;
  }

  function composeColorValue(baseColor, transparency) {
    var normalizedHex = normalizeColorInput(baseColor);
    var normalizedTransparency = clampTransparency(transparency);
    var alpha = Math.round((100 - normalizedTransparency) * 255 / 100);
    return alpha >= 255
      ? normalizedHex
      : normalizedHex + alpha.toString(16).padStart(2, "0");
  }

  function resolveManualColorValue(baseColor, transparency, fallback) {
    var fallbackParts = decomposeColorValue(fallback);
    var hex = typeof baseColor === "string" && baseColor.trim()
      ? normalizeColorInput(baseColor)
      : fallbackParts.hex;
    var resolvedTransparency = transparency == null || String(transparency).trim() === ""
      ? fallbackParts.transparency
      : clampTransparency(transparency);
    return composeColorValue(hex, resolvedTransparency);
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

  function toAlphaThresholdOrDefault(value, fallback) {
    var parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(255, Math.max(1, parsed)) : fallback;
  }

  function toNonNegativeInteger(value, fallback) {
    var parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
  }

  return {
    escapeHtml: escapeHtml,
    renderConditionalField: renderConditionalField,
    renderConditionalBlock: renderConditionalBlock,
    syncConditionalFields: syncConditionalFields,
    parseColorSourceValue: parseColorSourceValue,
    decomposeColorValue: decomposeColorValue,
    normalizeColorInput: normalizeColorInput,
    getColorTransparencyInput: getColorTransparencyInput,
    composeColorValue: composeColorValue,
    resolveManualColorValue: resolveManualColorValue,
    toNumberOrDefault: toNumberOrDefault,
    toIntegerOrDefault: toIntegerOrDefault,
    toNonNegativeNumberOrDefault: toNonNegativeNumberOrDefault,
    toAlphaThresholdOrDefault: toAlphaThresholdOrDefault,
    toNonNegativeInteger: toNonNegativeInteger
  };
});
