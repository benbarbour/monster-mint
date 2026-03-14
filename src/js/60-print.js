(function (global, factory) {
  var api = factory(global.MonsterMintSchema, global.MonsterMintSequences, global.MonsterMintTokens);
  global.MonsterMintPrint = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function (Schema, Sequences, Tokens) {
  function getSelectionMap(project) {
    var map = new Map();
    project.printSelections.forEach(function (selection) {
      map.set(selection.tokenId, selection);
    });
    return map;
  }

  function getSelectionRows(project) {
    var selectionMap = getSelectionMap(project);
    return project.tokens.map(function (token) {
      var saved = selectionMap.get(token.id) || {};
      return {
        tokenId: token.id,
        tokenName: token.name,
        diameterIn: token.diameterIn,
        copies: Number(saved.copies) || 0,
        sequenceStart: getSequenceStart(saved)
      };
    });
  }

  function normalizeSelections(project, inputSelections) {
    return inputSelections.map(function (row) {
      var copies = Math.max(0, Math.floor(Number(row.copies) || 0));
      return {
        tokenId: row.tokenId,
        copies: copies,
        sequenceStart: Math.max(0, Math.floor(Number(row.sequenceStart) || 0))
      };
    }).filter(function (row) {
      return row.copies > 0;
    });
  }

  function layoutProject(project) {
    var pagePreset = Schema.findPagePreset(project.settings.pagePresetId) || Schema.PAGE_PRESETS[0];
    var pageWidthIn = project.settings.pageOrientation === "landscape" ? pagePreset.heightIn : pagePreset.widthIn;
    var pageHeightIn = project.settings.pageOrientation === "landscape" ? pagePreset.widthIn : pagePreset.heightIn;
    var availableWidth = pageWidthIn - project.settings.pageMarginIn * 2;
    var availableHeight = pageHeightIn - project.settings.pageMarginIn * 2;
    var items = [];

    project.printSelections.forEach(function (selection) {
      var token = project.tokens.find(function (candidate) {
        return candidate.id === selection.tokenId;
      });
      if (!token || selection.copies <= 0) {
        return;
      }

      for (var copyIndex = 0; copyIndex < selection.copies; copyIndex += 1) {
        items.push({
          tokenId: token.id,
          token: token,
          sequenceIndex: getSequenceStart(selection) - 1 + copyIndex,
          faceCount: token.back.enabled ? 2 : 1
        });
      }
    });

    var pages = [];
    var currentPage = createPage(pageWidthIn, pageHeightIn);
    var currentX = project.settings.pageMarginIn;
    var currentY = project.settings.pageMarginIn;
    var rowHeight = 0;
    var gutterIn = 0;

    items.forEach(function (item) {
      var footprint = item.token.diameterIn + project.settings.bleedIn * 2;
      var rowWidth = footprint * item.faceCount + gutterIn * Math.max(0, item.faceCount - 1);
      var cellSize = footprint;

      if (currentX + rowWidth > project.settings.pageMarginIn + availableWidth) {
        currentX = project.settings.pageMarginIn;
        currentY += rowHeight + gutterIn;
        rowHeight = 0;
      }

      if (currentY + cellSize > project.settings.pageMarginIn + availableHeight) {
        pages.push(currentPage);
        currentPage = createPage(pageWidthIn, pageHeightIn);
        currentX = project.settings.pageMarginIn;
        currentY = project.settings.pageMarginIn;
        rowHeight = 0;
      }

      currentPage.items.push(createCellItem(item, "front", currentX, currentY, footprint, project.settings.bleedIn));
      if (item.faceCount === 2) {
        currentPage.items.push(createCellItem(item, "back", currentX + footprint + gutterIn, currentY, footprint, project.settings.bleedIn));
      }

      currentX += rowWidth + gutterIn;
      rowHeight = Math.max(rowHeight, cellSize);
    });

    if (currentPage.items.length || !pages.length) {
      pages.push(currentPage);
    }

    return {
      pageWidthIn: pageWidthIn,
      pageHeightIn: pageHeightIn,
      pages: pages
    };
  }

  function createPage(pageWidthIn, pageHeightIn) {
    return {
      pageWidthIn: pageWidthIn,
      pageHeightIn: pageHeightIn,
      items: []
    };
  }

  function createCellItem(item, faceName, cellXIn, cellYIn, footprintIn, bleedIn) {
    return {
      tokenId: item.tokenId,
      token: item.token,
      faceName: faceName,
      sequenceIndex: item.sequenceIndex,
      cellXIn: cellXIn,
      cellYIn: cellYIn,
      cellSizeIn: footprintIn,
      xIn: cellXIn + bleedIn,
      yIn: cellYIn + bleedIn,
      diameterIn: item.token.diameterIn,
      bleedIn: bleedIn
    };
  }

  function getSequenceStart(selection) {
    if (Number.isFinite(Number(selection.sequenceStart))) {
      return Math.max(0, Math.floor(Number(selection.sequenceStart)));
    }

    return Math.max(0, Math.floor((Number(selection.sequenceStartIndex) || 0) + 1));
  }

  return {
    getSelectionRows: getSelectionRows,
    normalizeSelections: normalizeSelections,
    layoutProject: layoutProject
  };
});
