(function (global, factory) {
  var api = factory(global.MonsterMintUtils);
  global.MonsterMintSequences = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function (Utils) {
  var HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

  function createTextSequence(input) {
    var payload = input || {};
    var type = payload.type === "alphabetic" || payload.type === "custom" ? payload.type : "numeric";

    return {
      id: payload.id || Utils.uid("seq_text"),
      name: (payload.name || "").trim() || "Untitled text sequence",
      builtIn: payload.builtIn === true,
      type: type,
      start: type === "numeric" ? asInteger(payload.start, 1) : 1,
      step: type === "numeric" ? asInteger(payload.step, 1) : 1,
      prefix: payload.prefix || "",
      suffix: payload.suffix || "",
      padTo: type === "numeric" ? Math.max(0, asInteger(payload.padTo, 0)) : 0,
      customValues: type === "custom" ? Utils.parseLineList(payload.customValues || payload.customValuesText) : []
    };
  }

  function createColorSequence(input) {
    var payload = input || {};
    var values = Utils.parseLineList(payload.values || payload.valuesText).filter(isHexColor);

    return {
      id: payload.id || Utils.uid("seq_color"),
      name: (payload.name || "").trim() || "Untitled color sequence",
      builtIn: payload.builtIn === true,
      values: values
    };
  }

  function summarizeTextSequence(sequence) {
    if (!sequence) {
      return "";
    }

    if (sequence.type === "numeric") {
      return "Numeric, starts at " + sequence.start + ", step " + sequence.step;
    }

    if (sequence.type === "alphabetic") {
      return "Alphabetic sequence";
    }

    return "Custom, " + sequence.customValues.length + " values";
  }

  function summarizeColorSequence(sequence) {
    if (!sequence) {
      return "";
    }

    return sequence.values.length + " colors";
  }

  function getFiniteLength(sequence, kind) {
    if (!sequence) {
      return Infinity;
    }

    if (kind === "text") {
      return sequence.type === "custom" ? sequence.customValues.length : Infinity;
    }

    if (kind === "color") {
      return sequence.values.length;
    }

    return Infinity;
  }

  function resolveTextValue(sequence, index) {
    if (!sequence) {
      return "";
    }

    if (sequence.type === "numeric") {
      var numericValue = sequence.start + sequence.step * index;
      var asText = String(numericValue).padStart(sequence.padTo || 0, "0");
      return (sequence.prefix || "") + asText + (sequence.suffix || "");
    }

    if (sequence.type === "alphabetic") {
      return (sequence.prefix || "") + alphabeticValue(index) + (sequence.suffix || "");
    }

    return sequence.customValues[index] || "";
  }

  function resolveColorValue(sequence, index) {
    if (!sequence || !Array.isArray(sequence.values)) {
      return "";
    }

    return sequence.values[index] || "";
  }

  function alphabeticValue(index) {
    var value = "";
    var current = index;

    do {
      value = String.fromCharCode(65 + (current % 26)) + value;
      current = Math.floor(current / 26) - 1;
    } while (current >= 0);

    return value;
  }

  function isHexColor(value) {
    return HEX_COLOR_PATTERN.test(String(value || "").trim());
  }

  function asInteger(value, fallback) {
    var parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return {
    createTextSequence: createTextSequence,
    createColorSequence: createColorSequence,
    summarizeTextSequence: summarizeTextSequence,
    summarizeColorSequence: summarizeColorSequence,
    getFiniteLength: getFiniteLength,
    isHexColor: isHexColor,
    resolveTextValue: resolveTextValue,
    resolveColorValue: resolveColorValue
  };
});
