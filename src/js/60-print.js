(function (global, factory) {
  var api = factory(global.MonsterMintSchema);
  global.MonsterMintPrint = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function (Schema) {
  function naturalLabelCompare(left, right) {
    return String(left || "").localeCompare(String(right || ""), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

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
    var cutlineGapIn = millimetersToInches(project.settings.cutlineGapMm || 0);
    var gridUnitIn = getPrintGridUnitIn();
    var items = [];

    getSortedPrintSelections(project).forEach(function (entry) {
      for (var copyIndex = 0; copyIndex < entry.selection.copies; copyIndex += 1) {
        items.push({
          tokenId: entry.token.id,
          token: entry.token,
          sequenceIndex: getSequenceStart(entry.selection) - 1 + copyIndex,
          remainingCopies: entry.selection.copies - copyIndex
        });
      }
    });

    var pages = [];
    var currentPage = createPage(pageWidthIn, pageHeightIn);
    var marginIn = project.settings.pageMarginIn;
    var maxX = marginIn + availableWidth;
    var maxY = marginIn + availableHeight;

    items.forEach(function (item) {
      var footprint = getTokenFootprintIn(item.token.diameterIn, cutlineGapIn, gridUnitIn);
      var placement = findPlacement(
        currentPage.items,
        footprint,
        marginIn,
        maxX,
        maxY,
        item.remainingCopies
      );

      if (!placement) {
        pages.push(currentPage);
        currentPage = createPage(pageWidthIn, pageHeightIn);
        placement = findPlacement(
          currentPage.items,
          footprint,
          marginIn,
          maxX,
          maxY,
          item.remainingCopies
        );
      }

      if (!placement) {
        return;
      }

      currentPage.items.push(createCellItem(item, placement.x, placement.y, footprint));
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

  function createCellItem(item, cellXIn, cellYIn, footprintIn) {
    var insetIn = (footprintIn - item.token.diameterIn) / 2;
    return {
      tokenId: item.tokenId,
      token: item.token,
      sequenceIndex: item.sequenceIndex,
      cellXIn: cellXIn,
      cellYIn: cellYIn,
      cellSizeIn: footprintIn,
      xIn: cellXIn + insetIn,
      yIn: cellYIn + insetIn,
      diameterIn: item.token.diameterIn
    };
  }

  function getSequenceStart(selection) {
    if (Number.isFinite(Number(selection.sequenceStart))) {
      return Math.max(0, Math.floor(Number(selection.sequenceStart)));
    }

    return Math.max(0, Math.floor((Number(selection.sequenceStartIndex) || 0) + 1));
  }

  function findPlacement(existingItems, cellSizeIn, marginIn, maxX, maxY, remainingCopies) {
    var epsilon = 0.000001;
    var xCandidates = [marginIn];
    var yCandidates = [marginIn];
    var candidates = [];
    var packingAroundLargerItems = existingItems.some(function (item) {
      return item.cellSizeIn > cellSizeIn + epsilon;
    });

    existingItems.forEach(function (item) {
      xCandidates.push(item.cellXIn + item.cellSizeIn);
      yCandidates.push(item.cellYIn + item.cellSizeIn);
    });

    xCandidates = uniqueSortedNumbers(xCandidates);
    yCandidates = uniqueSortedNumbers(yCandidates);

    for (var yIndex = 0; yIndex < yCandidates.length; yIndex += 1) {
      var y = yCandidates[yIndex];
      if (y + cellSizeIn > maxY + epsilon) {
        continue;
      }

      for (var xIndex = 0; xIndex < xCandidates.length; xIndex += 1) {
        var x = xCandidates[xIndex];
        if (x + cellSizeIn > maxX + epsilon) {
          continue;
        }

        if (!overlapsExisting(existingItems, x, y, cellSizeIn, epsilon)) {
          candidates.push({
            x: x,
            y: y,
            fitCount: getHorizontalFitCount(existingItems, x, y, cellSizeIn, maxX, epsilon),
            regionCapacity: getRegionCapacity(existingItems, x, y, cellSizeIn, maxX, maxY, epsilon)
          });
        }
      }
    }

    if (!candidates.length) {
      return null;
    }

    candidates.sort(function (left, right) {
      if (packingAroundLargerItems) {
        var leftCoverage = Math.min(left.regionCapacity, remainingCopies || 1);
        var rightCoverage = Math.min(right.regionCapacity, remainingCopies || 1);
        if (leftCoverage !== rightCoverage) {
          return rightCoverage - leftCoverage;
        }
        if (left.fitCount !== right.fitCount) {
          return right.fitCount - left.fitCount;
        }
      }
      if (left.y !== right.y) {
        return left.y - right.y;
      }
      if (left.x !== right.x) {
        return left.x - right.x;
      }
      return 0;
    });

    return { x: candidates[0].x, y: candidates[0].y };
  }

  function uniqueSortedNumbers(values) {
    return values.slice().sort(function (left, right) {
      return left - right;
    }).filter(function (value, index, all) {
      return index === 0 || Math.abs(value - all[index - 1]) > 0.000001;
    });
  }

  function overlapsExisting(existingItems, x, y, cellSizeIn, epsilon) {
    return existingItems.some(function (item) {
      return rectanglesOverlap(
        x,
        y,
        cellSizeIn,
        cellSizeIn,
        item.cellXIn,
        item.cellYIn,
        item.cellSizeIn,
        item.cellSizeIn,
        epsilon
      );
    });
  }

  function getHorizontalFitCount(existingItems, x, y, cellSizeIn, maxX, epsilon) {
    var nextObstacleX = maxX;

    existingItems.forEach(function (item) {
      var verticalOverlap = y < item.cellYIn + item.cellSizeIn - epsilon &&
        y + cellSizeIn > item.cellYIn + epsilon;
      if (!verticalOverlap) {
        return;
      }
      if (item.cellXIn >= x + cellSizeIn - epsilon && item.cellXIn < nextObstacleX) {
        nextObstacleX = item.cellXIn;
      }
    });

    return Math.max(1, Math.floor(((nextObstacleX - x) + epsilon) / cellSizeIn));
  }

  function getRegionCapacity(existingItems, x, y, cellSizeIn, maxX, maxY, epsilon) {
    var maxColumns = getHorizontalFitCount(existingItems, x, y, cellSizeIn, maxX, epsilon);
    var bestCapacity = 1;

    for (var columns = 1; columns <= maxColumns; columns += 1) {
      var rows = 0;
      var rowY = y;

      while (rowY + cellSizeIn <= maxY + epsilon) {
        if (!canFitRow(existingItems, x, rowY, cellSizeIn, columns, epsilon)) {
          break;
        }
        rows += 1;
        rowY += cellSizeIn;
      }

      bestCapacity = Math.max(bestCapacity, rows * columns);
    }

    return bestCapacity;
  }

  function canFitRow(existingItems, startX, y, cellSizeIn, columns, epsilon) {
    for (var index = 0; index < columns; index += 1) {
      if (overlapsExisting(existingItems, startX + cellSizeIn * index, y, cellSizeIn, epsilon)) {
        return false;
      }
    }
    return true;
  }

  function getPrintGridUnitIn() {
    return Math.min.apply(null, Schema.TOKEN_SIZES);
  }

  function getTokenFootprintIn(diameterIn, cutlineGapIn, gridUnitIn) {
    var units = Math.max(1, Math.round(Number(diameterIn) / gridUnitIn));
    return Number(diameterIn) + cutlineGapIn * units;
  }

  function millimetersToInches(valueMm) {
    return Number(valueMm) / 25.4;
  }

  function rectanglesOverlap(ax, ay, aw, ah, bx, by, bw, bh, epsilon) {
    return ax < bx + bw - epsilon &&
      ax + aw > bx + epsilon &&
      ay < by + bh - epsilon &&
      ay + ah > by + epsilon;
  }

  function getSortedPrintSelections(project) {
    return project.printSelections.map(function (selection) {
      return {
        selection: selection,
        token: project.tokens.find(function (candidate) {
          return candidate.id === selection.tokenId;
        }) || null
      };
    }).filter(function (entry) {
      return entry.token && entry.selection.copies > 0;
    }).sort(function (left, right) {
      var labelDelta = naturalLabelCompare(left.token.name, right.token.name);
      if (labelDelta !== 0) {
        return labelDelta;
      }
      if (left.token.diameterIn !== right.token.diameterIn) {
        return Number(left.token.diameterIn) - Number(right.token.diameterIn);
      }
      return left.token.id.localeCompare(right.token.id);
    });
  }

  return {
    getSelectionRows: getSelectionRows,
    normalizeSelections: normalizeSelections,
    layoutProject: layoutProject
  };
});
