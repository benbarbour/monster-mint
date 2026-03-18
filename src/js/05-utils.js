(function (global, factory) {
  var api = factory();
  global.MonsterMintUtils = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  var runtimeGlobal = typeof globalThis !== "undefined" ? globalThis : window;
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
    downloadBlobFile(filename, blob);
  }

  function downloadBlobFile(filename, blob) {
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

  function rasterizeSvgToWebp(svgMarkup, width, height, quality) {
    return new Promise(function (resolve, reject) {
      if (typeof Blob === "undefined" || typeof URL === "undefined" || typeof document === "undefined") {
        reject(new Error("SVG rasterization is not available in this environment."));
        return;
      }

      var svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
      var svgUrl = URL.createObjectURL(svgBlob);
      loadImage(svgUrl).then(function (image) {
        var canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        var context = canvas.getContext("2d");
        if (!context) {
          URL.revokeObjectURL(svgUrl);
          reject(new Error("Canvas 2D context is unavailable."));
          return;
        }
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob(function (blob) {
          URL.revokeObjectURL(svgUrl);
          if (!blob) {
            reject(new Error("Encoding token image failed."));
            return;
          }
          if (blob.type !== "image/webp") {
            reject(new Error("This browser could not encode transparent WebP images."));
            return;
          }
          blob.arrayBuffer().then(function (buffer) {
            resolve(new Uint8Array(buffer));
          }, reject);
        }, "image/webp", typeof quality === "number" ? quality : 0.95);
      }, function (error) {
        URL.revokeObjectURL(svgUrl);
        reject(error);
      });
    });
  }

  function getTokenExportSizePx(diameterIn, dpi) {
    var resolvedDpi = asPositiveInteger(dpi, 300);
    return Math.max(1, Math.round(asPositiveNumber(diameterIn, 1) * resolvedDpi));
  }

  function sanitizeFilenamePart(value, fallback) {
    var normalized = String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "");
    if (normalized) {
      return normalized;
    }
    return fallback != null ? String(fallback) : "token";
  }

  function createStoredZip(entries) {
    var encoder = runtimeGlobal.TextEncoder ? new runtimeGlobal.TextEncoder() : null;
    if (!encoder) {
      throw new Error("UTF-8 encoding is not available in this environment.");
    }

    var preparedEntries = (entries || []).map(function (entry) {
      var name = String(entry && entry.name ? entry.name : "file");
      var nameBytes = encoder.encode(name);
      var dataBytes = toUint8Array(entry && entry.data ? entry.data : new Uint8Array(0));
      return {
        name: name,
        nameBytes: nameBytes,
        dataBytes: dataBytes,
        crc32: computeCrc32(dataBytes)
      };
    });

    var now = new Date();
    var dosTime = toDosTime(now);
    var dosDate = toDosDate(now);
    var localOffset = 0;
    var centralDirectorySize = 0;

    preparedEntries.forEach(function (entry) {
      entry.localOffset = localOffset;
      localOffset += 30 + entry.nameBytes.length + entry.dataBytes.length;
      centralDirectorySize += 46 + entry.nameBytes.length;
    });

    var totalSize = localOffset + centralDirectorySize + 22;
    var archive = new Uint8Array(totalSize);
    var view = new DataView(archive.buffer);
    var offset = 0;

    preparedEntries.forEach(function (entry) {
      offset = writeLocalFileHeader(view, archive, offset, entry, dosTime, dosDate);
    });

    var centralDirectoryOffset = offset;
    preparedEntries.forEach(function (entry) {
      offset = writeCentralDirectoryHeader(view, archive, offset, entry, dosTime, dosDate);
    });

    writeEndOfCentralDirectory(view, offset, preparedEntries.length, centralDirectorySize, centralDirectoryOffset);
    return archive;
  }

  function toUint8Array(value) {
    if (value instanceof Uint8Array) {
      return value;
    }
    if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) {
      return new Uint8Array(value);
    }
    if (runtimeGlobal.Buffer && value instanceof runtimeGlobal.Buffer) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    if (Array.isArray(value)) {
      return Uint8Array.from(value);
    }
    if (typeof value === "string") {
      return runtimeGlobal.TextEncoder ? new runtimeGlobal.TextEncoder().encode(value) : Uint8Array.from([]);
    }
    return new Uint8Array(0);
  }

  function writeLocalFileHeader(view, archive, offset, entry, dosTime, dosDate) {
    writeUint32(view, offset, 0x04034b50); offset += 4;
    writeUint16(view, offset, 20); offset += 2;
    writeUint16(view, offset, 0x0800); offset += 2;
    writeUint16(view, offset, 0); offset += 2;
    writeUint16(view, offset, dosTime); offset += 2;
    writeUint16(view, offset, dosDate); offset += 2;
    writeUint32(view, offset, entry.crc32 >>> 0); offset += 4;
    writeUint32(view, offset, entry.dataBytes.length); offset += 4;
    writeUint32(view, offset, entry.dataBytes.length); offset += 4;
    writeUint16(view, offset, entry.nameBytes.length); offset += 2;
    writeUint16(view, offset, 0); offset += 2;
    archive.set(entry.nameBytes, offset); offset += entry.nameBytes.length;
    archive.set(entry.dataBytes, offset); offset += entry.dataBytes.length;
    return offset;
  }

  function writeCentralDirectoryHeader(view, archive, offset, entry, dosTime, dosDate) {
    writeUint32(view, offset, 0x02014b50); offset += 4;
    writeUint16(view, offset, 20); offset += 2;
    writeUint16(view, offset, 20); offset += 2;
    writeUint16(view, offset, 0x0800); offset += 2;
    writeUint16(view, offset, 0); offset += 2;
    writeUint16(view, offset, dosTime); offset += 2;
    writeUint16(view, offset, dosDate); offset += 2;
    writeUint32(view, offset, entry.crc32 >>> 0); offset += 4;
    writeUint32(view, offset, entry.dataBytes.length); offset += 4;
    writeUint32(view, offset, entry.dataBytes.length); offset += 4;
    writeUint16(view, offset, entry.nameBytes.length); offset += 2;
    writeUint16(view, offset, 0); offset += 2;
    writeUint16(view, offset, 0); offset += 2;
    writeUint16(view, offset, 0); offset += 2;
    writeUint16(view, offset, 0); offset += 2;
    writeUint32(view, offset, 0); offset += 4;
    writeUint32(view, offset, entry.localOffset); offset += 4;
    archive.set(entry.nameBytes, offset); offset += entry.nameBytes.length;
    return offset;
  }

  function writeEndOfCentralDirectory(view, offset, entryCount, centralDirectorySize, centralDirectoryOffset) {
    writeUint32(view, offset, 0x06054b50); offset += 4;
    writeUint16(view, offset, 0); offset += 2;
    writeUint16(view, offset, 0); offset += 2;
    writeUint16(view, offset, entryCount); offset += 2;
    writeUint16(view, offset, entryCount); offset += 2;
    writeUint32(view, offset, centralDirectorySize); offset += 4;
    writeUint32(view, offset, centralDirectoryOffset); offset += 4;
    writeUint16(view, offset, 0);
  }

  function writeUint16(view, offset, value) {
    view.setUint16(offset, value, true);
  }

  function writeUint32(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
  }

  function toDosTime(date) {
    return ((date.getHours() & 0x1f) << 11) |
      ((date.getMinutes() & 0x3f) << 5) |
      Math.floor((date.getSeconds() & 0x3f) / 2);
  }

  function toDosDate(date) {
    var year = Math.max(1980, date.getFullYear());
    return (((year - 1980) & 0x7f) << 9) |
      (((date.getMonth() + 1) & 0x0f) << 5) |
      (date.getDate() & 0x1f);
  }

  var crc32Table = null;

  function computeCrc32(bytes) {
    if (!crc32Table) {
      crc32Table = buildCrc32Table();
    }
    var crc = 0xffffffff;
    for (var index = 0; index < bytes.length; index += 1) {
      crc = (crc >>> 8) ^ crc32Table[(crc ^ bytes[index]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function buildCrc32Table() {
    var table = new Uint32Array(256);
    for (var index = 0; index < 256; index += 1) {
      var value = index;
      for (var bit = 0; bit < 8; bit += 1) {
        value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      }
      table[index] = value >>> 0;
    }
    return table;
  }

  async function readImageAssetFile(file, options) {
    var source = await readDataUrlFile(file);
    var dimensions = await loadImageDimensions(source);
    var optimized = await normalizeEmbeddedImageAssetSource(source, {
      dimensions: dimensions,
      trimAlphaThreshold: options && options.trimAlphaThreshold
    });
    return {
      source: optimized.source,
      width: optimized.width,
      height: optimized.height
    };
  }

  async function normalizeEmbeddedImageAssetSource(source, options) {
    if (!isImageDataUrl(source)) {
      return {
        source: source,
        width: null,
        height: null,
        bytes: estimateDataUrlBytes(source)
      };
    }

    var settings = options && typeof options === "object" ? options : {};
    var dimensions = settings.dimensions || await loadImageDimensions(source);
    var trimmed = await trimTransparentImageAssetSource(source, {
      dimensions: dimensions,
      trimAlphaThreshold: settings.trimAlphaThreshold,
      loadImageDimensions: settings.loadImageDimensions,
      loadImage: settings.loadImage,
      createCanvas: settings.createCanvas,
      encodeCanvas: settings.encodeCanvas,
      findOpaqueBounds: settings.findOpaqueBounds
    });
    return optimizeImageAssetSource(trimmed.source, {
      dimensions: {
        width: trimmed.width,
        height: trimmed.height
      },
      trimAlphaThreshold: settings.trimAlphaThreshold,
      maxBytes: settings.maxBytes,
      maxLongestEdge: settings.maxLongestEdge,
      minLongestEdge: settings.minLongestEdge,
      scaleStep: settings.scaleStep,
      qualitySteps: settings.qualitySteps,
      loadImageDimensions: settings.loadImageDimensions,
      loadImage: settings.loadImage,
      detectTransparency: settings.detectTransparency,
      createCanvas: settings.createCanvas,
      encodeCanvas: settings.encodeCanvas
    });
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
    } catch {
      return originalAsset;
    }
  }

  async function trimTransparentImageAssetSource(source, options) {
    var settings = normalizeImageTrimOptions(options);
    var originalDimensions = settings.dimensions || await settings.loadImageDimensions(source);
    var originalAsset = {
      source: source,
      width: originalDimensions.width,
      height: originalDimensions.height,
      bytes: estimateDataUrlBytes(source)
    };
    var mimeType = getDataUrlMimeType(source);

    if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
      return originalAsset;
    }

    try {
      var image = await settings.loadImage(source);
      var canvas = settings.createCanvas(originalDimensions.width, originalDimensions.height);
      var context = canvas && typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
      if (
        !context ||
        typeof context.clearRect !== "function" ||
        typeof context.drawImage !== "function" ||
        typeof context.getImageData !== "function"
      ) {
        return originalAsset;
      }

      context.clearRect(0, 0, originalDimensions.width, originalDimensions.height);
      context.drawImage(image, 0, 0, originalDimensions.width, originalDimensions.height);
      var imageData = context.getImageData(0, 0, originalDimensions.width, originalDimensions.height);
      var bounds = settings.findOpaqueBounds(
        imageData.data,
        originalDimensions.width,
        originalDimensions.height,
        settings.trimAlphaThreshold
      );
      if (!bounds) {
        return originalAsset;
      }

      if (
        bounds.x === 0 &&
        bounds.y === 0 &&
        bounds.width === originalDimensions.width &&
        bounds.height === originalDimensions.height
      ) {
        return originalAsset;
      }

      var trimmedCanvas = settings.createCanvas(bounds.width, bounds.height);
      var trimmedContext = trimmedCanvas && typeof trimmedCanvas.getContext === "function" ? trimmedCanvas.getContext("2d") : null;
      if (
        !trimmedContext ||
        typeof trimmedContext.clearRect !== "function" ||
        typeof trimmedContext.drawImage !== "function"
      ) {
        return originalAsset;
      }

      trimmedContext.clearRect(0, 0, bounds.width, bounds.height);
      trimmedContext.drawImage(
        image,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        0,
        0,
        bounds.width,
        bounds.height
      );

      var trimmedSource = settings.encodeCanvas(trimmedCanvas, "image/webp", 0.92);
      if (!isDataUrl(trimmedSource)) {
        trimmedSource = settings.encodeCanvas(trimmedCanvas, "image/png");
      }
      if (!isDataUrl(trimmedSource)) {
        return originalAsset;
      }

      return {
        source: trimmedSource,
        width: bounds.width,
        height: bounds.height,
        bytes: estimateDataUrlBytes(trimmedSource)
      };
    } catch {
      return originalAsset;
    }
  }

  async function normalizeProjectImageAssets(project, options) {
    if (!project || typeof project !== "object") {
      return project;
    }

    var settings = options && typeof options === "object" ? options : {};
    var normalizeAsset = typeof settings.normalizeImageAssetSource === "function"
      ? settings.normalizeImageAssetSource
      : normalizeEmbeddedImageAssetSource;
    var nextProject = JSON.parse(JSON.stringify(project));

    if (nextProject.settings && nextProject.settings.tokenDefaults) {
      var defaultImageSource = nextProject.settings.tokenDefaults.backgroundImageSource;
      if (isImageDataUrl(defaultImageSource)) {
        var normalizedDefaultBackground = await normalizeAsset(defaultImageSource, settings);
        nextProject.settings.tokenDefaults.backgroundImageSource = normalizedDefaultBackground.source;
      }
    }

    if (!Array.isArray(nextProject.tokens)) {
      return nextProject;
    }

    for (var tokenIndex = 0; tokenIndex < nextProject.tokens.length; tokenIndex += 1) {
      var token = nextProject.tokens[tokenIndex];
      if (!token || !token.front) {
        continue;
      }
      var face = token.front;

      if (isImageDataUrl(face.backgroundImageSource)) {
        var normalizedBackground = await normalizeAsset(face.backgroundImageSource, settings);
        face.backgroundImageSource = normalizedBackground.source;
      }

      if (!Array.isArray(face.images)) {
        continue;
      }

      for (var imageIndex = 0; imageIndex < face.images.length; imageIndex += 1) {
        var image = face.images[imageIndex];
        if (!image || !isImageDataUrl(image.source)) {
          continue;
        }

        var normalizedImage = await normalizeAsset(image.source, settings);
        image.source = normalizedImage.source;
        if (
          Number.isFinite(normalizedImage.width) &&
          normalizedImage.width > 0 &&
          Number.isFinite(normalizedImage.height) &&
          normalizedImage.height > 0
        ) {
          image.aspectRatio = normalizedImage.width / normalizedImage.height;
        }
      }
    }

    return nextProject;
  }

  function materializeProjectImageAssets(project) {
    if (!project || typeof project !== "object") {
      return project;
    }

    var nextProject = JSON.parse(JSON.stringify(project));
    var existingAssets = nextProject.assets && Array.isArray(nextProject.assets.images)
      ? nextProject.assets.images
      : [];
    var sourceByAssetId = new Map();
    var assetIdBySource = new Map();
    existingAssets.forEach(function (asset) {
      if (!asset || typeof asset.id !== "string" || !asset.id || typeof asset.source !== "string" || !asset.source) {
        return;
      }
      if (!sourceByAssetId.has(asset.id)) {
        sourceByAssetId.set(asset.id, asset.source);
      }
      if (!assetIdBySource.has(asset.source)) {
        assetIdBySource.set(asset.source, asset.id);
      }
    });
    var nextAssetIndex = getNextImageAssetIndex(existingAssets);

    var referencedAssetIds = [];
    var referencedLookup = new Set();

    rewriteProjectImageSources(nextProject, function (value) {
      if (typeof value !== "string" || !value) {
        return "";
      }

      var assetId = sourceByAssetId.has(value) ? value : assetIdBySource.get(value);
      if (!assetId) {
        assetId = "image_" + nextAssetIndex;
        nextAssetIndex += 1;
        sourceByAssetId.set(assetId, value);
        assetIdBySource.set(value, assetId);
      }

      if (!referencedLookup.has(assetId)) {
        referencedLookup.add(assetId);
        referencedAssetIds.push(assetId);
      }

      return assetId;
    });

    nextProject.assets = nextProject.assets && typeof nextProject.assets === "object" ? nextProject.assets : {};
    nextProject.assets.images = referencedAssetIds.map(function (assetId) {
      return {
        id: assetId,
        source: sourceByAssetId.get(assetId)
      };
    });

    return nextProject;
  }

  function getNextImageAssetIndex(existingAssets) {
    var highestIndex = 0;
    (existingAssets || []).forEach(function (asset) {
      if (!asset || typeof asset.id !== "string") {
        return;
      }
      var match = /^image_(\d+)$/.exec(asset.id);
      if (!match) {
        return;
      }
      var parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > highestIndex) {
        highestIndex = parsed;
      }
    });
    return highestIndex + 1;
  }

  function resolveProjectImageSource(project, value) {
    if (typeof value !== "string" || !value) {
      return "";
    }

    var imageAssets = project && project.assets && Array.isArray(project.assets.images)
      ? project.assets.images
      : [];
    var matched = imageAssets.find(function (asset) {
      return asset && asset.id === value;
    });
    return matched && typeof matched.source === "string" ? matched.source : value;
  }

  function compactProjectImageAssets(project) {
    if (!project || typeof project !== "object") {
      return project;
    }

    var nextProject = materializeProjectImageAssets(project);
    var imageAssets = nextProject.assets && Array.isArray(nextProject.assets.images)
      ? nextProject.assets.images
      : [];
    if (!imageAssets.length) {
      return nextProject;
    }

    var assetIds = new Set(imageAssets.map(function (asset) {
      return asset.id;
    }));
    rewriteProjectImageSources(nextProject, function (value) {
      return typeof value === "string" && assetIds.has(value) ? { assetRef: value } : value;
    });
    return nextProject;
  }

  function hydrateProjectImageAssets(project) {
    if (!project || typeof project !== "object") {
      return project;
    }

    var nextProject = JSON.parse(JSON.stringify(project));
    var imageAssets = nextProject.assets && Array.isArray(nextProject.assets.images)
      ? nextProject.assets.images
      : [];
    if (!imageAssets.length) {
      return nextProject;
    }

    var sourceByAssetId = new Map();
    imageAssets.forEach(function (asset) {
      if (asset && typeof asset.id === "string" && typeof asset.source === "string") {
        sourceByAssetId.set(asset.id, asset.source);
      }
    });

    rewriteProjectImageSources(nextProject, function (value) {
      if (!value || typeof value !== "object" || typeof value.assetRef !== "string") {
        return value;
      }
      return sourceByAssetId.get(value.assetRef) || "";
    });

    if (nextProject.assets && typeof nextProject.assets === "object") {
      delete nextProject.assets.images;
      if (!Object.keys(nextProject.assets).length) {
        delete nextProject.assets;
      }
    }

    return nextProject;
  }

  function rewriteProjectImageSources(project, rewriteValue) {
    visitProjectImageSources(project, function (value, setValue) {
      setValue(rewriteValue(value));
    });
  }

  function visitProjectImageSources(project, visitor) {
    if (!project || typeof project !== "object") {
      return;
    }

    if (project.settings && project.settings.tokenDefaults) {
      visitImageField(project.settings.tokenDefaults, "backgroundImageSource", visitor);
    }

    if (!Array.isArray(project.tokens)) {
      return;
    }

    project.tokens.forEach(function (token) {
      if (!token || !token.front) {
        return;
      }

      visitImageField(token.front, "backgroundImageSource", visitor);
      if (!Array.isArray(token.front.images)) {
        return;
      }

      token.front.images.forEach(function (image) {
        visitImageField(image, "source", visitor);
      });
    });
  }

  function visitImageField(owner, key, visitor) {
    if (!owner || !(key in owner)) {
      return;
    }
    visitor(owner[key], function (nextValue) {
      owner[key] = nextValue;
    });
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

  function normalizeImageTrimOptions(options) {
    var settings = options && typeof options === "object" ? options : {};
    return {
      dimensions: settings.dimensions || null,
      trimAlphaThreshold: asAlphaThreshold(settings.trimAlphaThreshold, 1),
      loadImageDimensions: typeof settings.loadImageDimensions === "function" ? settings.loadImageDimensions : loadImageDimensions,
      loadImage: typeof settings.loadImage === "function" ? settings.loadImage : loadImage,
      createCanvas: typeof settings.createCanvas === "function" ? settings.createCanvas : createCanvas,
      encodeCanvas: typeof settings.encodeCanvas === "function" ? settings.encodeCanvas : encodeCanvas,
      findOpaqueBounds: typeof settings.findOpaqueBounds === "function" ? settings.findOpaqueBounds : findOpaqueBounds
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

  function findOpaqueBounds(pixels, width, height, alphaThreshold) {
    if (!pixels || !pixels.length || width <= 0 || height <= 0) {
      return null;
    }

    var minAlpha = asAlphaThreshold(alphaThreshold, 1);

    var minX = width;
    var minY = height;
    var maxX = -1;
    var maxY = -1;

    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        var alpha = pixels[(y * width + x) * 4 + 3];
        if (alpha >= minAlpha) {
          if (x < minX) {
            minX = x;
          }
          if (y < minY) {
            minY = y;
          }
          if (x > maxX) {
            maxX = x;
          }
          if (y > maxY) {
            maxY = y;
          }
        }
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
    } catch {
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

  function isImageDataUrl(source) {
    return isDataUrl(source) && getDataUrlMimeType(source).indexOf("image/") === 0;
  }

  function asPositiveInteger(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
  }

  function asAlphaThreshold(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(255, Math.max(1, Math.round(parsed))) : fallback;
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
    downloadBlobFile: downloadBlobFile,
    readTextFile: readTextFile,
    readDataUrlFile: readDataUrlFile,
    loadImage: loadImage,
    loadImageDimensions: loadImageDimensions,
    rasterizeSvgToWebp: rasterizeSvgToWebp,
    getTokenExportSizePx: getTokenExportSizePx,
    sanitizeFilenamePart: sanitizeFilenamePart,
    createStoredZip: createStoredZip,
    findOpaqueBounds: findOpaqueBounds,
    estimateDataUrlBytes: estimateDataUrlBytes,
    compactProjectImageAssets: compactProjectImageAssets,
    hydrateProjectImageAssets: hydrateProjectImageAssets,
    normalizeEmbeddedImageAssetSource: normalizeEmbeddedImageAssetSource,
    materializeProjectImageAssets: materializeProjectImageAssets,
    resolveProjectImageSource: resolveProjectImageSource,
    normalizeProjectImageAssets: normalizeProjectImageAssets,
    trimTransparentImageAssetSource: trimTransparentImageAssetSource,
    optimizeImageAssetSource: optimizeImageAssetSource,
    readImageAssetFile: readImageAssetFile
  };
});
