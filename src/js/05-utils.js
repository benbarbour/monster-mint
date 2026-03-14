(function (global, factory) {
  var api = factory();
  global.MonsterMintUtils = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  var uidCounter = 0;

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
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        resolve({
          width: image.naturalWidth || image.width || 1,
          height: image.naturalHeight || image.height || 1
        });
      };
      image.onerror = reject;
      image.src = source;
    });
  }

  async function readImageAssetFile(file) {
    var source = await readDataUrlFile(file);
    var dimensions = await loadImageDimensions(source);
    return {
      source: source,
      width: dimensions.width,
      height: dimensions.height
    };
  }

  return {
    uid: uid,
    parseLineList: parseLineList,
    downloadTextFile: downloadTextFile,
    readTextFile: readTextFile,
    readDataUrlFile: readDataUrlFile,
    loadImageDimensions: loadImageDimensions,
    readImageAssetFile: readImageAssetFile
  };
});
