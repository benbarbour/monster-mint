(function (global, factory) {
  var api = factory();
  global.MonsterMintUtils = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  var uidCounter = 0;
  var IMAGE_MAX_BYTES = 1024 * 1024;
  var IMAGE_MAX_LONGEST_EDGE = 2048;
  var IMAGE_MIN_LONGEST_EDGE = 512;
  var IMAGE_SCALE_STEP = 0.85;
  var IMAGE_QUALITY_STEPS = [0.9, 0.82, 0.74, 0.66];

  function uid(prefix) {
    uidCounter += 1;
    return prefix + "_" + Date.now().toString(36) + "_" + uidCounter.toString(36);
  }

  function parseLineList(raw) {
    return String(raw || "")
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);
  }

  function downloadTextFile(filename, contents) {
    var blob = new Blob([contents], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function readTextFile(file) {
    return file.text();
  }

  function readDataUrlFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadImageDimensions(source) {
    return loadImage(source).then(function (image) {
      return {
        width: image.naturalWidth || image.width || 1,
        height: image.naturalHeight || image.height || 1
      };
    });
  }

  function loadImage(source) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        resolve(image);
      };
      image.onerror = reject;
      image.src = source;
    });
  }

  async function readImageAssetFile(file) {
    var source = await readDataUrlFile(file);
    var dimensions = await loadImageDimensions(source);
    var optimized = await optimizeImageAssetSource(source, {
      dimensions: dimensions
    });
    return {
      source: optimized.source,
      width: optimized.width,
      height: optimized.height
    };
  }

  async function optimizeImageAssetSource(source, options) {
    var settings = normalizeImageOptimizationOptions(options);
    var originalDimensions = settings.dimensions || await settings.loadImageDimensions(source);
    var originalAsset = {
      source: source,
      width: originalDimensions.width,
      height: originalDimensions.height,
      bytes: estimateDataUrlBytes(source)
    };

    if (originalAsset.bytes <= settings.maxBytes) {
      return originalAsset;
    }

    try {
      var image = await settings.loadImage(source);
      var hasAlpha = await settings.detectTransparency(image, originalDimensions.width, originalDimensions.height);
      var encodeTargets = hasAlpha ? ["image/webp", "image/png"] : ["image/jpeg"];
      var currentLongestEdge = Math.min(Math.max(originalDimensions.width, originalDimensions.height), settings.maxLongestEdge);
      var bestCandidate = null;

      while (currentLongestEdge > 0) {
        var targetSize = scaleDimensionsToLongestEdge(
          originalDimensions.width,
          originalDimensions.height,
          currentLongestEdge
        );
        var canvas = settings.createCanvas(targetSize.width, targetSize.height);
        var context = canvas && typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
        if (!context || typeof context.drawImage !== "function") {
          break;
        }

        context.clearRect(0, 0, targetSize.width, targetSize.height);
        context.drawImage(image, 0, 0, targetSize.width, targetSize.height);

        for (var targetIndex = 0; targetIndex < encodeTargets.length; targetIndex += 1) {
          var mimeType = encodeTargets[targetIndex];
          var qualities = mimeType === "image/png" ? [null] : settings.qualitySteps;

          for (var qualityIndex = 0; qualityIndex < qualities.length; qualityIndex += 1) {
            var quality = qualities[qualityIndex];
            var encodedSource = settings.encodeCanvas(canvas, mimeType, quality);
            if (!isDataUrl(encodedSource)) {
              continue;
            }

            var candidate = {
              source: encodedSource,
              width: targetSize.width,
              height: targetSize.height,
              bytes: estimateDataUrlBytes(encodedSource)
            };

            if (!bestCandidate || candidate.bytes < bestCandidate.bytes) {
              bestCandidate = candidate;
            }

            if (candidate.bytes <= settings.maxBytes) {
              return candidate;
            }
          }
        }

        if (currentLongestEdge <= settings.minLongestEdge) {
          break;
        }
        currentLongestEdge = Math.max(settings.minLongestEdge, Math.round(currentLongestEdge * settings.scaleStep));
      }

      return bestCandidate || originalAsset;
    } catch (error) {
      return originalAsset;
    }
  }

  function normalizeImageOptimizationOptions(options) {
    var settings = options && typeof options === "object" ? options : {};
    return {
      dimensions: settings.dimensions || null,
      maxBytes: asPositiveInteger(settings.maxBytes, IMAGE_MAX_BYTES),
      maxLongestEdge: asPositiveInteger(settings.maxLongestEdge, IMAGE_MAX_LONGEST_EDGE),
      minLongestEdge: asPositiveInteger(settings.minLongestEdge, IMAGE_MIN_LONGEST_EDGE),
      scaleStep: asPositiveNumber(settings.scaleStep, IMAGE_SCALE_STEP),
      qualitySteps: Array.isArray(settings.qualitySteps) && settings.qualitySteps.length
        ? settings.qualitySteps.map(function (value) { return Number(value); }).filter(function (value) { return Number.isFinite(value) && value > 0 && value <= 1; })
        : IMAGE_QUALITY_STEPS.slice(),
      loadImageDimensions: typeof settings.loadImageDimensions === "function" ? settings.loadImageDimensions : loadImageDimensions,
      loadImage: typeof settings.loadImage === "function" ? settings.loadImage : loadImage,
      detectTransparency: typeof settings.detectTransparency === "function" ? settings.detectTransparency : detectTransparency,
      createCanvas: typeof settings.createCanvas === "function" ? settings.createCanvas : createCanvas,
      encodeCanvas: typeof settings.encodeCanvas === "function" ? settings.encodeCanvas : encodeCanvas
    };
  }

  function detectTransparency(image, width, height) {
    var mimeType = getDataUrlMimeType(image && image.src);
    if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
      return false;
    }

    var sampleSize = scaleDimensionsToLongestEdge(width, height, 256);
    var canvas = createCanvas(sampleSize.width, sampleSize.height);
    var context = canvas && typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
    if (!context || typeof context.getImageData !== "function") {
      return mimeType === "image/png" || mimeType === "image/webp" || mimeType === "image/gif";
    }

    context.clearRect(0, 0, sampleSize.width, sampleSize.height);
    context.drawImage(image, 0, 0, sampleSize.width, sampleSize.height);
    var pixels = context.getImageData(0, 0, sampleSize.width, sampleSize.height).data;
    for (var index = 3; index < pixels.length; index += 4) {
      if (pixels[index] < 255) {
        return true;
      }
    }
    return false;
  }

  function createCanvas(width, height) {
    if (typeof document === "undefined" || typeof document.createElement !== "function") {
      return null;
    }

    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    return canvas;
  }

  function encodeCanvas(canvas, mimeType, quality) {
    if (!canvas || typeof canvas.toDataURL !== "function") {
      return "";
    }

    if (mimeType === "image/png") {
      return canvas.toDataURL(mimeType);
    }

    return canvas.toDataURL(mimeType, quality);
  }

  function scaleDimensionsToLongestEdge(width, height, longestEdge) {
    var originalWidth = Math.max(1, Number(width) || 1);
    var originalHeight = Math.max(1, Number(height) || 1);
    var targetLongest = Math.max(1, Number(longestEdge) || 1);
    var currentLongest = Math.max(originalWidth, originalHeight);

    if (currentLongest <= targetLongest) {
      return {
        width: Math.round(originalWidth),
        height: Math.round(originalHeight)
      };
    }

    var ratio = targetLongest / currentLongest;
    return {
      width: Math.max(1, Math.round(originalWidth * ratio)),
      height: Math.max(1, Math.round(originalHeight * ratio))
    };
  }

  function estimateDataUrlBytes(source) {
    if (!isDataUrl(source)) {
      return String(source || "").length;
    }

    var parts = String(source).split(",", 2);
    var header = parts[0] || "";
    var payload = parts[1] || "";
    if (header.indexOf(";base64") >= 0) {
      var padding = payload.endsWith("==") ? 2 : (payload.endsWith("=") ? 1 : 0);
      return Math.max(0, Math.floor(payload.length * 3 / 4) - padding);
    }

    try {
      return encodeURIComponent(decodeURIComponent(payload)).replace(/%../g, "x").length;
    } catch (error) {
      return payload.length;
    }
  }

  function getDataUrlMimeType(source) {
    if (!isDataUrl(source)) {
      return "";
    }

    var match = String(source).match(/^data:([^;,]+)/i);
    return match ? match[1].toLowerCase() : "";
  }

  function isDataUrl(source) {
    return typeof source === "string" && source.indexOf("data:") === 0;
  }

  function asPositiveInteger(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
  }

  function asPositiveNumber(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  return {
    IMAGE_MAX_BYTES: IMAGE_MAX_BYTES,
    IMAGE_MAX_LONGEST_EDGE: IMAGE_MAX_LONGEST_EDGE,
    IMAGE_MIN_LONGEST_EDGE: IMAGE_MIN_LONGEST_EDGE,
    IMAGE_SCALE_STEP: IMAGE_SCALE_STEP,
    IMAGE_QUALITY_STEPS: IMAGE_QUALITY_STEPS.slice(),
    uid: uid,
    parseLineList: parseLineList,
    downloadTextFile: downloadTextFile,
    readTextFile: readTextFile,
    readDataUrlFile: readDataUrlFile,
    loadImage: loadImage,
    loadImageDimensions: loadImageDimensions,
    estimateDataUrlBytes: estimateDataUrlBytes,
    optimizeImageAssetSource: optimizeImageAssetSource,
    readImageAssetFile: readImageAssetFile
  };
});
