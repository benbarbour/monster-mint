(function (global, factory) {
  var api = factory(global.MonsterMintTokens, global.MonsterMintSequences);
  global.MonsterMintRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (Tokens, Sequences) {
  var fitCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  var fitContext = fitCanvas ? fitCanvas.getContext("2d") : null;

  function renderTokenSvg(token, project, options) {
    var opts = options || {};
    var faceName = opts.face || "front";
    var face = token[faceName];
    var sequenceIndex = opts.sequenceIndex || 0;
    var colorSequences = project.sequences.color;
    var textSequences = project.sequences.text;
    var background = Tokens.getColorValue(
      face.backgroundColorMode,
      face.backgroundColor,
      face.backgroundColorSequenceRef,
      colorSequences,
      sequenceIndex
    );
    var selectedComponentType = opts.selectedComponentType;
    var selectedComponentId = opts.selectedComponentId;
    var tokenSlug = token.id.replace(/[^a-z0-9_-]/gi, "");
    var svgAttributes = opts.svgAttributes ? " " + opts.svgAttributes : "";
    var borderMarkup = renderBorder(face, colorSequences, sequenceIndex);

    return [
      '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" data-preview-svg' + svgAttributes + '>',
      "  <defs>",
      '    <clipPath id="token-clip-' + tokenSlug + '"><circle cx="50" cy="50" r="50"></circle></clipPath>',
      renderTextClipPaths(face.texts, tokenSlug),
      "  </defs>",
      '  <rect x="0" y="0" width="100" height="100" fill="#f6efe2"></rect>',
      '  <circle cx="50" cy="50" r="50" fill="' + escapeAttr(background) + '"></circle>',
      token.borderUnderContent ? borderMarkup : "",
      '  <g clip-path="url(#token-clip-' + tokenSlug + ')">',
      renderImageComponents(face.images),
      renderTextComponents(face.texts, textSequences, colorSequences, sequenceIndex, tokenSlug, opts.interactive),
      "  </g>",
      token.borderUnderContent ? "" : borderMarkup,
      opts.interactive
        ? renderInteractiveOverlays(face, selectedComponentType, selectedComponentId)
        : "",
      "</svg>"
    ].join("");
  }

  function renderImageComponents(images) {
    return images.map(function (component) {
      var box = toSvgRect(component, "image");
      var centerX = box.x + box.width / 2;
      var centerY = box.y + box.height / 2;
      var scaleX = component.mirrorX ? -1 : 1;
      var scaleY = component.mirrorY ? -1 : 1;
      var transform = [
        "translate(" + centerX + " " + centerY + ")",
        "rotate(" + Number(component.rotationDeg || 0) + ")",
        "scale(" + scaleX + " " + scaleY + ")",
        "translate(" + (-box.width / 2) + " " + (-box.height / 2) + ")"
      ].join(" ");
      return '<image href="' + escapeAttr(component.source) + '" width="' + box.width + '" height="' + box.height + '" preserveAspectRatio="none" transform="' + transform + '"></image>';
    }).join("");
  }

  function renderBorder(face, colorSequences, sequenceIndex) {
    if (!face.border || face.border.widthRatio <= 0) {
      return "";
    }

    var color = Tokens.getColorValue(
      face.border.colorMode,
      face.border.color,
      face.border.colorSequenceRef,
      colorSequences,
      sequenceIndex
    );
    var width = face.border.widthRatio * 100;
    var radius = 50 - width / 2;
    return '<circle cx="50" cy="50" r="' + radius + '" fill="none" stroke="' + escapeAttr(color) + '" stroke-width="' + width + '"></circle>';
  }

  function renderTextComponents(components, textSequences, colorSequences, sequenceIndex, tokenSlug, previewMode) {
    return components.map(function (component) {
      var value = previewMode
        ? getPreviewTextValue(component, textSequences)
        : Tokens.getTextValue(component, textSequences, sequenceIndex);
      var color = Tokens.getColorValue(
        component.colorMode,
        component.color,
        component.colorSequenceRef,
        colorSequences,
        sequenceIndex
      );
      var box = toSvgRect(component, "text");
      var fontSize = fitFontSize(value, component.fontFamily, component.fontWeight, box.width, box.height);
      var borderWidth = component.textBorder ? Number(component.textBorder.width || 0) : 0;
      var borderColor = component.textBorder
        ? Tokens.getColorValue(
          component.textBorder.colorMode,
          component.textBorder.color,
          component.textBorder.colorSequenceRef,
          colorSequences,
          sequenceIndex
        )
        : "#111111";
      return [
        '<g clip-path="url(#text-clip-' + tokenSlug + "-" + component.id + ')">',
        '  <text x="' + (box.x + box.width / 2) + '" y="' + (box.y + box.height / 2) + '" fill="' + escapeAttr(color) + '" stroke="' + (borderWidth > 0 ? escapeAttr(borderColor) : "none") + '" stroke-width="' + borderWidth + '" paint-order="stroke fill" stroke-linejoin="round" font-family="' + escapeAttr(component.fontFamily) + '" font-weight="' + escapeAttr(component.fontWeight) + '" font-size="' + fontSize + '" text-anchor="middle" dominant-baseline="middle">' + escapeText(value) + "</text>",
        "</g>"
      ].join("");
    }).join("");
  }

  function getPreviewTextValue(component, textSequences) {
    if (component.contentMode === "custom") {
      return component.customText || "Text";
    }

    if (component.contentMode === "numeric") {
      return "#".repeat(Math.max(1, component.sequencePad || 0));
    }

    if (component.contentMode === "alphabetic") {
      return "A";
    }

    return "";
  }

  function renderTextClipPaths(components, tokenSlug) {
    return components.map(function (component) {
      var box = toSvgRect(component, "text");
      return '<clipPath id="text-clip-' + tokenSlug + "-" + component.id + '"><rect x="' + box.x + '" y="' + box.y + '" width="' + box.width + '" height="' + box.height + '"></rect></clipPath>';
    }).join("");
  }

  function renderInteractiveOverlays(face, selectedComponentType, selectedComponentId) {
    var overlays = [];

    face.images.forEach(function (component) {
      overlays.push(renderOverlay(component, "image", selectedComponentType, selectedComponentId));
    });

    face.texts.forEach(function (component) {
      overlays.push(renderOverlay(component, "text", selectedComponentType, selectedComponentId));
    });

    return overlays.join("");
  }

  function renderOverlay(component, type, selectedComponentType, selectedComponentId) {
    var box = toSvgRect(component, type);
    var isSelected = selectedComponentType === type && selectedComponentId === component.id;
    var stroke = isSelected ? "#9d3f1d" : "rgba(43, 36, 25, 0.45)";
    var handleX = box.x + box.width - 2;
    var handleY = box.y + box.height - 2;
    return [
      '<g data-component-id="' + component.id + '" data-component-type="' + type + '">',
      '  <rect x="' + box.x + '" y="' + box.y + '" width="' + box.width + '" height="' + box.height + '" fill="transparent" stroke="' + stroke + '" stroke-dasharray="2 2" data-drag-mode="move"></rect>',
      '  <rect x="' + handleX + '" y="' + handleY + '" width="4" height="4" rx="1" fill="' + stroke + '" data-drag-mode="resize"></rect>',
      "</g>"
    ].join("");
  }

  function fitFontSize(text, fontFamily, fontWeight, boxWidth, boxHeight) {
    if (!fitContext || !text) {
      return Math.max(3, boxHeight * 0.65);
    }

    var min = 1;
    var max = Math.max(3, boxHeight * 2);
    var best = min;
    fitContext.textAlign = "center";
    fitContext.textBaseline = "middle";

    while (max - min > 0.2) {
      var mid = (min + max) / 2;
      fitContext.font = fontWeight + " " + mid + "px " + fontFamily;
      var metrics = fitContext.measureText(text);
      var width = metrics.width;
      var height = (metrics.actualBoundingBoxAscent || mid * 0.7) + (metrics.actualBoundingBoxDescent || mid * 0.3);

      if (width <= boxWidth * 0.94 && height <= boxHeight * 0.9) {
        best = mid;
        min = mid;
      } else {
        max = mid;
      }
    }

    return Math.max(3, Number(best.toFixed(2)));
  }

  function toSvgRect(component, type) {
    var dimensions = type === "image"
      ? Tokens.getImageDimensions(component)
      : { width: component.width, height: component.height };
    var width = dimensions.width * 100;
    var height = dimensions.height * 100;
    var centerX = 50 + component.x * 100;
    var centerY = 50 + component.y * 100;
    return {
      x: centerX - width / 2,
      y: centerY - height / 2,
      width: width,
      height: height
    };
  }

  function escapeAttr(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function escapeText(value) {
    return escapeAttr(value);
  }

  return {
    renderTokenSvg: renderTokenSvg,
    fitFontSize: fitFontSize
  };
});
