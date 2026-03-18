(function (global, factory) {
  var api = factory(global.MonsterMintTokens);
  global.MonsterMintRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (Tokens) {
  var fitCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  var fitContext = fitCanvas ? fitCanvas.getContext("2d") : null;
  var COMPONENT_CLIP_RADIUS = 49.75;

  function renderTokenSvg(token, project, options) {
    var opts = options || {};
    var face = token.front;
    var sequenceIndex = opts.sequenceIndex || 0;
    var colorSequences = project.sequences.color;
    var textSequences = project.sequences.text;
    var backgroundColor = Tokens.getColorValue(
      face.backgroundColorMode,
      face.backgroundColor,
      face.backgroundColorSequenceRef,
      colorSequences,
      sequenceIndex
    );
    var borderColor = resolveBorderColor(face, colorSequences, sequenceIndex);
    var backgroundImageSource = Tokens.resolveImageSource(project, face.backgroundImageSource);
    var selectedComponentType = opts.selectedComponentType;
    var selectedComponentId = opts.selectedComponentId;
    var instanceSuffix = opts.instanceId ? "-" + String(opts.instanceId).replace(/[^a-z0-9_-]/gi, "") : "";
    var tokenSlug = token.id.replace(/[^a-z0-9_-]/gi, "") + instanceSuffix;
    var tokenClipId = "token-clip-" + tokenSlug;
    var underBorderClipId = "under-border-clip-" + tokenSlug;
    var svgAttributes = opts.svgAttributes ? " " + opts.svgAttributes : "";
    var borderWidth = face.border && face.border.widthRatio > 0 ? face.border.widthRatio * 100 : 0;
    var underBorderClipRadius = borderWidth > 0
      ? Math.max(0, 50 - borderWidth)
      : COMPONENT_CLIP_RADIUS;
    var tokenBaseFill = opts.tokenBaseFill || (borderWidth > 0 ? borderColor : backgroundColor);
    var borderMarkup = renderBorder(face, borderColor);
    var backgroundInsetMarkup = renderBackgroundInset(face, backgroundColor, tokenBaseFill, underBorderClipRadius);
    var backgroundImageMarkup = renderBackgroundImage(backgroundImageSource, underBorderClipId);
    var outerSquareFill = opts.outerSquareFill || "#f6efe2";
    var tokenBaseCircleMarkup = tokenBaseFill === outerSquareFill
      ? ""
      : '<circle cx="50" cy="50" r="50" fill="' + escapeAttr(tokenBaseFill) + '"></circle>';
    var orderedComponents = Tokens.getSortedFaceComponents(face);
    var lowerComponents = orderedComponents.filter(function (entry) {
      return entry.component.zIndex < 0;
    });
    var upperComponents = orderedComponents.filter(function (entry) {
      return entry.component.zIndex > 0;
    });

    return [
      '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" data-preview-svg="true"' + svgAttributes + '>',
      "  <defs>",
      '    <clipPath id="' + tokenClipId + '"><circle cx="50" cy="50" r="' + COMPONENT_CLIP_RADIUS + '"></circle></clipPath>',
      '    <clipPath id="' + underBorderClipId + '"><circle cx="50" cy="50" r="' + underBorderClipRadius + '"></circle></clipPath>',
      renderTextClipPaths(face.texts, tokenSlug),
      "  </defs>",
      '  <rect x="0" y="0" width="100" height="100" fill="' + escapeAttr(outerSquareFill) + '"></rect>',
      tokenBaseCircleMarkup,
      backgroundInsetMarkup,
      backgroundImageMarkup,
      renderOrderedComponents(lowerComponents, project, textSequences, colorSequences, sequenceIndex, tokenSlug, underBorderClipId, opts.interactive, selectedComponentType, selectedComponentId),
      borderMarkup,
      renderOrderedComponents(upperComponents, project, textSequences, colorSequences, sequenceIndex, tokenSlug, tokenClipId, opts.interactive, selectedComponentType, selectedComponentId),
      opts.interactive
        ? renderInteractiveOverlays(face, selectedComponentType, selectedComponentId)
        : "",
      "</svg>"
    ].join("");
  }

  function renderOrderedComponents(entries, project, textSequences, colorSequences, sequenceIndex, tokenSlug, clipId, interactive, selectedComponentType, selectedComponentId) {
    return entries.map(function (entry) {
      return entry.type === "image"
        ? renderImageComponent(entry.component, project, clipId, interactive, selectedComponentType, selectedComponentId)
        : renderTextComponent(entry.component, textSequences, colorSequences, sequenceIndex, tokenSlug, clipId, interactive, selectedComponentType, selectedComponentId);
    }).join("");
  }

  function renderImageComponent(component, project, clipId, interactive, selectedComponentType, selectedComponentId) {
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
      var source = Tokens.resolveImageSource(project, component.source);
      return [
        '<g clip-path="url(#' + clipId + ')" data-component-id="' + component.id + '" data-component-type="image"' + (isSelected ? ' data-drag-mode="move" cursor="grab"' : "") + '>',
        '  <image href="' + escapeAttr(source) + '" width="' + box.width + '" height="' + box.height + '" preserveAspectRatio="none" transform="' + transform + '"></image>',
        "</g>"
      ].join("");
  }

  function resolveBorderColor(face, colorSequences, sequenceIndex) {
    if (!face.border) {
      return "#000000";
    }

    return Tokens.getColorValue(
      face.border.colorMode,
      face.border.color,
      face.border.colorSequenceRef,
      colorSequences,
      sequenceIndex
    );
  }

  function renderBorder(face, color) {
    if (!face.border || face.border.widthRatio <= 0) {
      return "";
    }

    var width = face.border.widthRatio * 100;
    var radius = 50 - width / 2;
    return '<circle cx="50" cy="50" r="' + radius + '" fill="none" stroke="' + escapeAttr(color) + '" stroke-width="' + width + '"></circle>';
  }

  function renderBackgroundImage(backgroundImageSource, clipId) {
    if (!backgroundImageSource) {
      return "";
    }

    return [
      '<g clip-path="url(#' + clipId + ')">',
      '  <image href="' + escapeAttr(backgroundImageSource) + '" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" data-background-image="true"></image>',
      "</g>"
    ].join("");
  }

  function renderBackgroundInset(face, background, tokenBaseFill, radius) {
    if (tokenBaseFill === background || !face.border || face.border.widthRatio <= 0) {
      return "";
    }

    return '<circle cx="50" cy="50" r="' + radius + '" fill="' + escapeAttr(background) + '"></circle>';
  }

  function renderTextComponent(component, textSequences, colorSequences, sequenceIndex, tokenSlug, clipId, previewMode, selectedComponentType, selectedComponentId) {
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
      var centerX = box.x + box.width / 2;
      var centerY = box.y + box.height / 2;
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
        '<g clip-path="url(#' + clipId + ')" data-component-id="' + component.id + '" data-component-type="text"' + (isSelected ? ' data-drag-mode="move" cursor="default"' : "") + '>',
        '  <g clip-path="url(#text-clip-' + tokenSlug + "-" + component.id + ')">',
        '    <text x="' + centerX + '" y="' + baselineY + '" fill="' + escapeAttr(color) + '" stroke="' + (borderWidth > 0 ? escapeAttr(borderColor) : "none") + '" stroke-width="' + borderWidth + '" paint-order="stroke fill" stroke-linejoin="round" font-family="' + escapeAttr(component.fontFamily) + '" font-weight="' + escapeAttr(component.fontWeight) + '" font-style="normal" font-size="' + fontSize + '" text-anchor="middle"' + (Number(component.rotationDeg || 0) ? ' transform="rotate(' + Number(component.rotationDeg || 0) + " " + centerX + " " + centerY + ')"' : "") + '>' + escapeText(value) + "</text>",
        "  </g>",
        "</g>"
      ].join("");
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

  function renderInteractiveOverlays(face, selectedComponentType, selectedComponentId) {
    var overlays = [];

    face.images.forEach(function (component) {
      if (selectedComponentType === "image" && selectedComponentId === component.id) {
        overlays.push(renderOverlay(component, "image"));
      }
    });

    face.texts.forEach(function (component) {
      if (selectedComponentType === "text" && selectedComponentId === component.id) {
        overlays.push(renderOverlay(component, "text"));
      }
    });

    return overlays.join("");
  }

  function renderOverlay(component, type) {
    var box = toSvgRect(component, type);
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
      type === "image" ? renderImageResizeHandles(box, component) : renderTextResizeHandles(box),
      (type === "image" || type === "text")
        ? '  <line x1="' + (box.x + box.width / 2) + '" y1="' + box.y + '" x2="' + rotateHandleX + '" y2="' + rotateHandleY + '" stroke="#ffffff" stroke-width="0.9"></line>' +
          '  <line x1="' + (box.x + box.width / 2) + '" y1="' + box.y + '" x2="' + rotateHandleX + '" y2="' + rotateHandleY + '" stroke="#111111" stroke-width="0.45" stroke-dasharray="2 2" stroke-dashoffset="2"></line>' +
          '  <circle cx="' + rotateHandleX + '" cy="' + rotateHandleY + '" r="3.5" fill="#ffffff" stroke="#111111" stroke-width="0.6" data-drag-mode="rotate" cursor="crosshair"></circle>'
        : "",
      "</g>"
    ].join("");
  }

  function renderTextResizeHandles(box) {
    var handleOverhang = 4;
    var edgeThickness = 6;
    var topX = box.x - handleOverhang;
    var topY = box.y - edgeThickness / 2;
    var leftX = box.x - edgeThickness / 2;
    var leftY = box.y - handleOverhang;
    var visibleWidth = Math.max(6, box.width + handleOverhang * 2);
    var visibleHeight = Math.max(6, box.height + handleOverhang * 2);
    return [
      renderTextEdgeHandle(topX, topY, visibleWidth, edgeThickness, "resize-top", "ns-resize", false),
      renderTextEdgeHandle(topX, box.y + box.height - edgeThickness / 2, visibleWidth, edgeThickness, "resize-bottom", "ns-resize", false),
      renderTextEdgeHandle(leftX, leftY, edgeThickness, visibleHeight, "resize-left", "ew-resize", true),
      renderTextEdgeHandle(box.x + box.width - edgeThickness / 2, leftY, edgeThickness, visibleHeight, "resize-right", "ew-resize", true),
      '<rect x="' + (box.x + box.width - 2) + '" y="' + (box.y + box.height - 2) + '" width="4" height="4" rx="1" fill="#ffffff" stroke="#111111" stroke-width="0.6" data-drag-mode="resize" cursor="nwse-resize"></rect>'
    ].join("");
  }

  function renderTextEdgeHandle(x, y, width, height, mode, cursor, vertical) {
    var midX = x + width / 2;
    var midY = y + height / 2;
    return [
      '<rect x="' + x + '" y="' + y + '" width="' + width + '" height="' + height + '" fill="rgba(255,255,255,0.001)" pointer-events="all" data-drag-mode="' + mode + '" cursor="' + cursor + '"></rect>',
      vertical
        ? '<line x1="' + midX + '" y1="' + y + '" x2="' + midX + '" y2="' + (y + height) + '" stroke="#ffffff" stroke-width="1.1" stroke-linecap="round" pointer-events="none"></line>'
        : '<line x1="' + x + '" y1="' + midY + '" x2="' + (x + width) + '" y2="' + midY + '" stroke="#ffffff" stroke-width="1.1" stroke-linecap="round" pointer-events="none"></line>',
      vertical
        ? '<line x1="' + midX + '" y1="' + y + '" x2="' + midX + '" y2="' + (y + height) + '" stroke="#111111" stroke-width="0.55" stroke-linecap="round" stroke-dasharray="2 2" stroke-dashoffset="2" pointer-events="none"></line>'
        : '<line x1="' + x + '" y1="' + midY + '" x2="' + (x + width) + '" y2="' + midY + '" stroke="#111111" stroke-width="0.55" stroke-linecap="round" stroke-dasharray="2 2" stroke-dashoffset="2" pointer-events="none"></line>'
    ].join("");
  }

  function renderImageResizeHandles(box, component) {
    var handleOverhang = 6;
    var edgeThickness = 8;
    var topX = box.x - handleOverhang;
    var topY = box.y - edgeThickness / 2;
    var bottomY = box.y + box.height - edgeThickness / 2;
    var leftX = box.x - edgeThickness / 2;
    var leftY = box.y - handleOverhang;
    var visibleWidth = Math.max(8, box.width + handleOverhang * 2);
    var visibleHeight = Math.max(8, box.height + handleOverhang * 2);
    var horizontalCursor = getResizeCursor(component.rotationDeg || 0);
    var verticalCursor = getResizeCursor(Number(component.rotationDeg || 0) + 90);
    return [
      renderImageResizeHandle(topX, topY, visibleWidth, edgeThickness, "resize-top", horizontalCursor, false),
      renderImageResizeHandle(topX, bottomY, visibleWidth, edgeThickness, "resize-bottom", horizontalCursor, false),
      renderImageResizeHandle(leftX, leftY, visibleHeight, edgeThickness, "resize-left", verticalCursor, true),
      renderImageResizeHandle(box.x + box.width - edgeThickness / 2, leftY, visibleHeight, edgeThickness, "resize-right", verticalCursor, true)
    ].join("");
  }

  function renderImageResizeHandle(x, y, length, thickness, mode, cursor, vertical) {
    var x1 = vertical ? x + thickness / 2 : x;
    var y1 = vertical ? y : y + thickness / 2;
    var x2 = vertical ? x + thickness / 2 : x + length;
    var y2 = vertical ? y + length : y + thickness / 2;
    return [
      '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="rgba(255,255,255,0.001)" stroke-width="' + thickness + '" stroke-linecap="round" pointer-events="stroke" data-drag-mode="' + mode + '" cursor="' + cursor + '"></line>',
      '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#ffffff" stroke-width="1.1" stroke-linecap="round" pointer-events="none"></line>',
      '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#111111" stroke-width="0.55" stroke-linecap="round" stroke-dasharray="2 2" stroke-dashoffset="2" pointer-events="none"></line>'
    ].join("");
  }

  function getResizeCursor(rotationDeg) {
    var normalized = ((Number(rotationDeg || 0) % 180) + 180) % 180;
    if (normalized < 22.5 || normalized >= 157.5) {
      return "ns-resize";
    }
    if (normalized < 67.5) {
      return "nesw-resize";
    }
    if (normalized < 112.5) {
      return "ew-resize";
    }
    return "nwse-resize";
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
