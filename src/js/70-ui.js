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

  function normalizeColorInput(value) {
    if (typeof value === "string" && value.startsWith("#")) {
      return value;
    }

    return "#000000";
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
    normalizeColorInput: normalizeColorInput,
    toNumberOrDefault: toNumberOrDefault,
    toIntegerOrDefault: toIntegerOrDefault,
    toNonNegativeNumberOrDefault: toNonNegativeNumberOrDefault,
    toAlphaThresholdOrDefault: toAlphaThresholdOrDefault,
    toNonNegativeInteger: toNonNegativeInteger
  };
});
