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

    return [
      '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" data-preview-svg' + svgAttributes + '>',
      '  <defs>',
      '    <clipPath id="token-clip-' + tokenSlug + '"><circle cx="50" cy="50" r="50"></circle></clipPath>',
      renderTextClipPaths(face.texts, tokenSlug),
      '  </defs>',
      '  <rect x="0" y="0" width="100" height="100" fill="#f6efe2"></rect>',
      '  <circle cx="50" cy="50" r="50" fill="' + escapeAttr(background) + '"></circle>',
      '  <g clip-path="url(#token-clip-' + tokenSlug + ')">',
      renderImageComponents(face.images),
      "  </g>",
      faceName === "front" && face.border.enabled ? renderBorder(face, colorSequences, sequenceIndex) : "",
      renderTextComponents(face.texts, textSequences, colorSequences, sequenceIndex, tokenSlug),
      opts.interactive
        ? renderInteractiveOverlays(face, selectedComponentType, selectedComponentId)
        : "",
      "</svg>"
    ].join("");
  }

  function renderImageComponents(images) {
    return images.map(function (component) {
      var x = component.x * 100;
      var y = component.y * 100;
      var width = component.width * 100;
      var height = component.height * 100;
      var preserveAspectRatio = component.fit === "contain"
        ? "xMidYMid meet"
        : component.fit === "stretch"
          ? "none"
          : "xMidYMid slice";
      return '<image href="' + escapeAttr(component.source) + '" x="' + x + '" y="' + y + '" width="' + width + '" height="' + height + '" preserveAspectRatio="' + preserveAspectRatio + '"></image>';
    }).join("");
  }

  function renderBorder(face, colorSequences, sequenceIndex) {
    var color = Tokens.getColorValue(
      face.border.colorMode,
      face.border.color,
      face.border.colorSequenceRef,
      colorSequences,
      sequenceIndex
    );
    var width = Math.max(0.4, face.border.widthPt / 2);
    var radius = 50 - width / 2;
    return '<circle cx="50" cy="50" r="' + radius + '" fill="none" stroke="' + escapeAttr(color) + '" stroke-width="' + width + '"></circle>';
  }

  function renderTextComponents(components, textSequences, colorSequences, sequenceIndex, tokenSlug) {
    return components.map(function (component) {
      var value = Tokens.getTextValue(component, textSequences, sequenceIndex);
      var color = Tokens.getColorValue(
        component.colorMode,
        component.color,
        component.colorSequenceRef,
        colorSequences,
        sequenceIndex
      );
      var box = toSvgRect(component);
      var fontSize = fitFontSize(value, component.fontFamily, component.fontWeight, box.width, box.height);
      var shadow = component.shadow.enabled
        ? ' style="filter: drop-shadow(' + component.shadow.dx + 'px ' + component.shadow.dy + 'px ' + component.shadow.blur + 'px ' + escapeAttr(component.shadow.color) + ')"'
        : "";
      return [
        '<g clip-path="url(#text-clip-' + tokenSlug + "-" + component.id + ')"' + shadow + '>',
        '  <text x="' + (box.x + box.width / 2) + '" y="' + (box.y + box.height / 2) + '" fill="' + escapeAttr(color) + '" font-family="' + escapeAttr(component.fontFamily) + '" font-weight="' + escapeAttr(component.fontWeight) + '" font-size="' + fontSize + '" text-anchor="middle" dominant-baseline="middle">' + escapeText(value) + "</text>",
        "</g>"
      ].join("");
    }).join("");
  }

  function renderTextClipPaths(components, tokenSlug) {
    return components.map(function (component) {
      var box = toSvgRect(component);
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
    var box = toSvgRect(component);
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

  function toSvgRect(component) {
    return {
      x: component.x * 100,
      y: component.y * 100,
      width: component.width * 100,
      height: component.height * 100
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
