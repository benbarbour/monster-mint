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

  function getTokenMaxCopies(token, project) {
    var refs = Tokens.collectBoundedSequenceLengths(token);
    var lengths = refs.map(function (ref) {
      if (ref.kind === "text") {
        var textSequence = project.sequences.text.find(function (candidate) {
          return candidate.id === ref.sequenceId;
        });
        if (!textSequence) {
          return 0;
        }
        return Sequences.getFiniteLength(textSequence, "text");
      }

      var colorSequence = project.sequences.color.find(function (candidate) {
        return candidate.id === ref.sequenceId;
      });
      if (!colorSequence) {
        return 0;
      }
      return Sequences.getFiniteLength(colorSequence, "color");
    }).filter(function (length) {
      return Number.isFinite(length);
    });

    if (!lengths.length) {
      return Infinity;
    }

    return Math.max(0, Math.min.apply(Math, lengths));
  }

  function getSelectionRows(project) {
    var selectionMap = getSelectionMap(project);
    return project.tokens.map(function (token) {
      var saved = selectionMap.get(token.id) || {};
      var maxCopies = getTokenMaxCopies(token, project);
      return {
        tokenId: token.id,
        tokenName: token.name,
        diameterIn: token.diameterIn,
        copies: Number(saved.copies) || 0,
        sequenceStartIndex: Number(saved.sequenceStartIndex) || 0,
        maxCopies: maxCopies
      };
    });
  }

  function normalizeSelections(project, inputSelections) {
    return inputSelections.map(function (row) {
      var token = project.tokens.find(function (candidate) {
        return candidate.id === row.tokenId;
      });
      var maxCopies = token ? getTokenMaxCopies(token, project) : 0;
      var copies = Math.max(0, Math.floor(Number(row.copies) || 0));
      if (Number.isFinite(maxCopies)) {
        copies = Math.min(copies, maxCopies);
      }
      return {
        tokenId: row.tokenId,
        copies: copies,
        sequenceStartIndex: Math.max(0, Math.floor(Number(row.sequenceStartIndex) || 0))
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
          sequenceIndex: selection.sequenceStartIndex + copyIndex
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
      var cellSize = footprint + gutterIn;

      if (currentX + cellSize > project.settings.pageMarginIn + availableWidth) {
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

      currentPage.items.push({
        tokenId: item.tokenId,
        token: item.token,
        sequenceIndex: item.sequenceIndex,
        xIn: currentX + project.settings.bleedIn,
        yIn: currentY + project.settings.bleedIn,
        diameterIn: item.token.diameterIn,
        bleedIn: project.settings.bleedIn
      });

      currentX += cellSize;
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

  return {
    getSelectionRows: getSelectionRows,
    getTokenMaxCopies: getTokenMaxCopies,
    normalizeSelections: normalizeSelections,
    layoutProject: layoutProject
  };
});
