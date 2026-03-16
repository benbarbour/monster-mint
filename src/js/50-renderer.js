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
    var tokenBaseFill = opts.tokenBaseFill || background;
    var selectedComponentType = opts.selectedComponentType;
    var selectedComponentId = opts.selectedComponentId;
    var tokenSlug = token.id.replace(/[^a-z0-9_-]/gi, "");
    var svgAttributes = opts.svgAttributes ? " " + opts.svgAttributes : "";
    var borderMarkup = renderBorder(face, colorSequences, sequenceIndex);
    var backgroundInsetMarkup = renderBackgroundInset(face, background, tokenBaseFill);
    var outerSquareFill = opts.outerSquareFill || "#f6efe2";
    var borderUnderImages = token.borderUnderImages === true;
    var borderUnderText = token.borderUnderText === true || borderUnderImages;

    return [
      '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" data-preview-svg' + svgAttributes + '>',
      "  <defs>",
      '    <clipPath id="token-clip-' + tokenSlug + '"><circle cx="50" cy="50" r="50"></circle></clipPath>',
      renderTextClipPaths(face.texts, tokenSlug),
      "  </defs>",
      '  <rect x="0" y="0" width="100" height="100" fill="' + escapeAttr(outerSquareFill) + '"></rect>',
      '  <circle cx="50" cy="50" r="50" fill="' + escapeAttr(tokenBaseFill) + '"></circle>',
      backgroundInsetMarkup,
      borderUnderImages ? borderMarkup : "",
      renderImageComponents(face.images, tokenSlug, opts.interactive, selectedComponentType, selectedComponentId),
      borderUnderImages ? "" : (borderUnderText ? borderMarkup : ""),
      renderTextComponents(face.texts, textSequences, colorSequences, sequenceIndex, tokenSlug, opts.interactive, selectedComponentType, selectedComponentId),
      borderUnderText ? "" : borderMarkup,
      opts.interactive
        ? renderInteractiveOverlays(face, selectedComponentType, selectedComponentId, tokenSlug)
        : "",
      "</svg>"
    ].join("");
  }

  function renderImageComponents(images, tokenSlug, interactive, selectedComponentType, selectedComponentId) {
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
      var isSelected = interactive && selectedComponentType === "image" && selectedComponentId === component.id;
      return '<image href="' + escapeAttr(component.source) + '" width="' + box.width + '" height="' + box.height + '" preserveAspectRatio="none" transform="' + transform + '" clip-path="url(#token-clip-' + tokenSlug + ')" data-component-id="' + component.id + '" data-component-type="image"' + (isSelected ? ' data-drag-mode="move"' : "") + '></image>';
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

  function renderBackgroundInset(face, background, tokenBaseFill) {
    if (tokenBaseFill === background || !face.border || face.border.widthRatio <= 0) {
      return "";
    }

    var borderWidth = face.border.widthRatio * 100;
    var radius = Math.max(0, 50 - borderWidth);
    return '<circle cx="50" cy="50" r="' + radius + '" fill="' + escapeAttr(background) + '"></circle>';
  }

  function renderTextComponents(components, textSequences, colorSequences, sequenceIndex, tokenSlug, previewMode, selectedComponentType, selectedComponentId) {
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
      var borderWidth = component.textBorder ? Number(component.textBorder.width || 0) : 0;
      var fontSize = fitFontSize(value, component.fontFamily, component.fontWeight, box.width, box.height, borderWidth);
      var textBounds = getTextMetrics(value, component.fontFamily, component.fontWeight, fontSize, borderWidth);
      var baselineY = box.y + box.height / 2 - (textBounds.y + textBounds.height / 2);
      var borderColor = component.textBorder
        ? Tokens.getColorValue(
          component.textBorder.colorMode,
          component.textBorder.color,
          component.textBorder.colorSequenceRef,
          colorSequences,
          sequenceIndex
        )
        : "#111111";
      var isSelected = previewMode && selectedComponentType === "text" && selectedComponentId === component.id;
      return [
        '<g clip-path="url(#token-clip-' + tokenSlug + ')" data-component-id="' + component.id + '" data-component-type="text"' + (isSelected ? ' data-drag-mode="move"' : "") + '>',
        '  <g clip-path="url(#text-clip-' + tokenSlug + "-" + component.id + ')">',
        '    <text x="' + (box.x + box.width / 2) + '" y="' + baselineY + '" fill="' + escapeAttr(color) + '" stroke="' + (borderWidth > 0 ? escapeAttr(borderColor) : "none") + '" stroke-width="' + borderWidth + '" paint-order="stroke fill" stroke-linejoin="round" font-family="' + escapeAttr(component.fontFamily) + '" font-weight="' + escapeAttr(component.fontWeight) + '" font-style="normal" font-size="' + fontSize + '" text-anchor="middle">' + escapeText(value) + "</text>",
        "  </g>",
        "</g>"
      ].join("");
    }).join("");
  }

  function getPreviewTextValue(component, textSequences) {
    return Tokens.getTextValue(component, textSequences, 0);
  }

  function renderTextClipPaths(components, tokenSlug) {
    return components.map(function (component) {
      var box = toSvgRect(component, "text");
      return '<clipPath id="text-clip-' + tokenSlug + "-" + component.id + '"><rect x="' + box.x + '" y="' + box.y + '" width="' + box.width + '" height="' + box.height + '"></rect></clipPath>';
    }).join("");
  }

  function renderInteractiveOverlays(face, selectedComponentType, selectedComponentId, tokenSlug) {
    var overlays = [];

    face.images.forEach(function (component) {
      if (selectedComponentType === "image" && selectedComponentId === component.id) {
        overlays.push(renderOverlay(component, "image", tokenSlug));
      }
    });

    face.texts.forEach(function (component) {
      if (selectedComponentType === "text" && selectedComponentId === component.id) {
        overlays.push(renderOverlay(component, "text", tokenSlug));
      }
    });

    return overlays.join("");
  }

  function renderOverlay(component, type, tokenSlug) {
    var box = toSvgRect(component, type);
    var handleX = box.x + box.width - 2;
    var handleY = box.y + box.height - 2;
    var rotateHandleX = box.x + box.width / 2;
    var rotateHandleY = box.y - 8;
    var centerX = box.x + box.width / 2;
    var centerY = box.y + box.height / 2;
    var transform = type === "image"
      ? ' transform="rotate(' + Number(component.rotationDeg || 0) + " " + centerX + " " + centerY + ')"'
      : "";
    return [
      '<g data-component-id="' + component.id + '" data-component-type="' + type + '"' + transform + '>',
      renderSelectionBox(box),
      '  <rect x="' + handleX + '" y="' + handleY + '" width="4" height="4" rx="1" fill="#ffffff" stroke="#111111" stroke-width="0.6" data-drag-mode="resize"></rect>',
      type === "image"
        ? '  <line x1="' + (box.x + box.width / 2) + '" y1="' + box.y + '" x2="' + rotateHandleX + '" y2="' + rotateHandleY + '" stroke="#ffffff" stroke-width="0.9"></line>' +
          '  <line x1="' + (box.x + box.width / 2) + '" y1="' + box.y + '" x2="' + rotateHandleX + '" y2="' + rotateHandleY + '" stroke="#111111" stroke-width="0.45" stroke-dasharray="2 2" stroke-dashoffset="2"></line>' +
          '  <circle cx="' + rotateHandleX + '" cy="' + rotateHandleY + '" r="3.5" fill="#ffffff" stroke="#111111" stroke-width="0.6" data-drag-mode="rotate"></circle>'
        : "",
      "</g>"
    ].join("");
  }

  function renderSelectionBox(box) {
    return [
      '<rect x="' + box.x + '" y="' + box.y + '" width="' + box.width + '" height="' + box.height + '" fill="none" stroke="#ffffff" stroke-width="0.45" stroke-dasharray="4 4"></rect>',
      '<rect x="' + box.x + '" y="' + box.y + '" width="' + box.width + '" height="' + box.height + '" fill="none" stroke="#111111" stroke-width="0.45" stroke-dasharray="4 4" stroke-dashoffset="4"></rect>'
    ].join("");
  }

  function fitFontSize(text, fontFamily, fontWeight, boxWidth, boxHeight, strokeWidth) {
    if (!text) {
      return Math.max(3, boxHeight * 0.65);
    }

    var padding = Math.max(0, Number(strokeWidth || 0));
    var availableWidth = Math.max(1, boxWidth - padding);
    var availableHeight = Math.max(1, boxHeight - padding);
    var probeSize = 100;
    var probeMetrics = getTextMetrics(text, fontFamily, fontWeight, probeSize, padding);
    if (probeMetrics.width > 0 && probeMetrics.height > 0) {
      var fitted = probeSize * Math.min(availableWidth / probeMetrics.width, availableHeight / probeMetrics.height);
      var refinedMetrics = getTextMetrics(text, fontFamily, fontWeight, fitted, padding);
      if (refinedMetrics.width > 0 && refinedMetrics.height > 0) {
        fitted = fitted * Math.min(availableWidth / refinedMetrics.width, availableHeight / refinedMetrics.height);
      }

      return Math.max(3, Number((fitted * 0.999).toFixed(2)));
    }

    if (!fitContext) {
      return Math.max(3, boxHeight * 0.65);
    }

    fitContext.textAlign = "center";
    fitContext.textBaseline = "middle";
    fitContext.font = fontWeight + " " + boxHeight + "px " + fontFamily;
    var fallbackMetrics = fitContext.measureText(text);
    var fallbackWidth = fallbackMetrics.width || boxHeight;
    return Math.max(3, Number((availableHeight * Math.min(1, availableWidth / fallbackWidth) * 0.999).toFixed(2)));
  }

  function getTextMetrics(text, fontFamily, fontWeight, fontSize, strokeWidth) {
    if (!fitContext || !text || !fontSize) {
      var fallbackStroke = Math.max(0, Number(strokeWidth || 0));
      return {
        width: 0,
        x: 0,
        y: -(fontSize * 0.68 + fallbackStroke / 2),
        ascent: fontSize * 0.68 + fallbackStroke / 2,
        descent: fontSize * 0.22 + fallbackStroke / 2,
        height: fontSize * 0.9 + fallbackStroke
      };
    }

    fitContext.font = fontWeight + " " + fontSize + "px " + fontFamily;
    fitContext.textAlign = "center";
    fitContext.textBaseline = "alphabetic";
    fitContext.lineJoin = "round";
    fitContext.lineWidth = Math.max(0, Number(strokeWidth || 0));
    var metrics = fitContext.measureText(text);
    var approxWidth = Math.max(1, Math.ceil((metrics.width || fontSize) + fontSize * 2));
    var ascent = Math.max(1, Math.ceil(metrics.actualBoundingBoxAscent || fontSize * 0.68));
    var descent = Math.max(1, Math.ceil(metrics.actualBoundingBoxDescent || fontSize * 0.22));
    var approxHeight = Math.max(1, ascent + descent + Math.ceil(fontSize * 2));
    var baselineX = Math.ceil(approxWidth / 2);
    var baselineY = Math.ceil(fontSize + ascent);

    fitCanvas.width = approxWidth;
    fitCanvas.height = approxHeight;
    fitContext.clearRect(0, 0, approxWidth, approxHeight);
    fitContext.font = fontWeight + " " + fontSize + "px " + fontFamily;
    fitContext.textAlign = "center";
    fitContext.textBaseline = "alphabetic";
    fitContext.lineJoin = "round";
    fitContext.lineWidth = Math.max(0, Number(strokeWidth || 0));
    fitContext.fillStyle = "#000000";
    if (fitContext.lineWidth > 0) {
      fitContext.strokeStyle = "#000000";
      fitContext.strokeText(text, baselineX, baselineY);
    }
    fitContext.fillText(text, baselineX, baselineY);

    var imageData = fitContext.getImageData(0, 0, approxWidth, approxHeight);
    var bounds = getAlphaBounds(imageData.data, approxWidth, approxHeight);
    if (!bounds) {
      return {
        width: metrics.width || 0,
        x: 0,
        y: -ascent,
        ascent: ascent,
        descent: descent,
        height: ascent + descent
      };
    }

    return {
      width: bounds.width,
      x: bounds.x - baselineX,
      y: bounds.y - baselineY,
      ascent: Math.max(0, baselineY - bounds.y),
      descent: Math.max(0, bounds.y + bounds.height - baselineY),
      height: bounds.height
    };
  }

  function getAlphaBounds(data, width, height) {
    var minX = width;
    var minY = height;
    var maxX = -1;
    var maxY = -1;
    var index = 3;

    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        if (data[index] > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
        index += 4;
      }
    }

    if (maxX < minX || maxY < minY) {
      return null;
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
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
