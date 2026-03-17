(function (global, factory) {
  var api = factory(
    global.MonsterMintSchema,
    global.MonsterMintTokens,
    global.MonsterMintRenderer,
    global.MonsterMintPrint,
    global.MonsterMintUi
  );
  global.MonsterMintAppPrintPanel = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (Schema, Tokens, Renderer, Print, Ui) {
  var runtimeGlobal = typeof globalThis !== "undefined" ? globalThis : window;
  var escapeHtml = Ui.escapeHtml;
  var activePrintFrame = null;

  function naturalLabelCompare(left, right) {
    return String(left || "").localeCompare(String(right || ""), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  function renderPanel(state) {
    var rows = getSortedSelectionRows(state.project);
    var layout = Print.layoutProject(state.project);
    var activePreviewPage = Math.min(state.ui.selectedPrintPreviewPage || 0, Math.max(0, layout.pages.length - 1));
    var printPanels = state.ui.printPanels || {};
    var previewItemCount = layout.pages.reduce(function (total, page) {
      return total + page.items.length;
    }, 0);
    return [
      '<div class="print-layout">',
      renderPrintSection({
        key: "settings",
        title: "Print Settings",
        isOpen: printPanels.settings !== false,
        content: renderPageSettingsForm(state.project.settings)
      }),
      renderPrintSection({
        key: "selections",
        title: "Print Selections",
        metaText: formatSelectionSummary(rows.length),
        isOpen: printPanels.selections !== false,
        content: renderPrintSelectionForm(rows)
      }),
      renderPrintSection({
        key: "preview",
        title: "Preview",
        metaText: formatPreviewSummary(previewItemCount, layout.pages.length),
        isOpen: printPanels.preview !== false,
        actions: '<button class="button button-primary" type="button" data-action="print-layout">Print</button>',
        content: layout.pages.length && layout.pages[0].items.length
          ? renderPreviewTabs(layout, state.project, activePreviewPage)
          : '<div class="empty-state">Choose at least one token copy to generate pages.</div>'
      }),
      "</div>"
    ].join("");
  }

  function renderPrintSection(config) {
    return [
      '<section class="panel-card print-panel' + (config.isOpen ? " is-open" : " is-collapsed") + '">',
      '  <div class="panel-header print-panel-header">',
      '    <button class="panel-toggle" type="button" data-action="toggle-print-panel" data-panel-key="' + config.key + '" aria-expanded="' + (config.isOpen ? "true" : "false") + '">',
      '      <span class="panel-toggle-label">',
      "        <h2>" + escapeHtml(config.title) + "</h2>",
      (config.metaText ? '        <span class="panel-toggle-meta">' + escapeHtml(config.metaText) + "</span>" : ""),
      "      </span>",
      '      <span class="panel-toggle-icon" aria-hidden="true">' + (config.isOpen ? "▾" : "▸") + "</span>",
      "    </button>",
      config.actions || "",
      "  </div>",
      config.isOpen ? config.content : "",
      "</section>"
    ].join("");
  }

  function bindForms(appElement, store, helpers) {
    var pageSettingsForm = appElement.querySelector("[data-form='page-settings']");
    if (pageSettingsForm) {
      pageSettingsForm.addEventListener("change", function () {
        var formData = new FormData(pageSettingsForm);
        store.updateProject(function (project) {
          project.settings.pagePresetId = String(formData.get("pagePresetId"));
          project.settings.pageOrientation = String(formData.get("pageOrientation"));
          project.settings.pageMarginIn = helpers.toNonNegativeNumberOrDefault(formData.get("pageMarginIn"), project.settings.pageMarginIn);
        });
      });
    }

    var printForm = appElement.querySelector("[data-form='print-selections']");
    if (printForm) {
      var commitPrintSelections = function () {
        var rows = helpers.collectPrintSelectionRows(printForm, store.getState().project);
        store.updateProject(function (project) {
          project.printSelections = Print.normalizeSelections(project, rows);
        });
      };
      var normalizeCommittedField = function (field) {
        if (!field || !field.name) {
          return;
        }
        var rows = Print.getSelectionRows(store.getState().project);
        var matched = rows.find(function (row) {
          return field.name === "copies-" + row.tokenId || field.name === "start-" + row.tokenId;
        });
        if (!matched) {
          return;
        }
        field.value = field.name.indexOf("copies-") === 0
          ? String(matched.copies)
          : String(matched.sequenceStart);
      };
      var flushPrintSelections = function (event) {
        commitPrintSelections();
        normalizeCommittedField(event && event.target);
      };

      printForm.addEventListener("change", flushPrintSelections);
      printForm.addEventListener("focusout", function (event) {
        if (event.target && event.target.name) {
          flushPrintSelections(event);
        }
      });
    }
  }

  function printCurrentLayout(store) {
    var state = store.getState();
    var layout = Print.layoutProject(state.project);
    if (layout.pages.length && layout.pages[0].items.length) {
      openPrintWindow(layout, state.project);
    }
  }

  function renderPageSettingsForm(settings) {
    return [
      '<form class="form-grid" data-form="page-settings">',
      '  <div class="field-row two-up">',
      '    <label class="field">Page size<select name="pagePresetId">' + Schema.PAGE_PRESETS.slice().sort(function (left, right) {
        return naturalLabelCompare(left.label, right.label);
      }).map(function (candidate) {
        return '<option value="' + candidate.id + '"' + (candidate.id === settings.pagePresetId ? " selected" : "") + ">" + candidate.label + "</option>";
      }).join("") + '</select></label>',
      '    <label class="field">Orientation<select name="pageOrientation">' +
        [
          { value: "landscape", label: "Landscape" },
          { value: "portrait", label: "Portrait" }
        ].sort(function (left, right) {
          return naturalLabelCompare(left.label, right.label);
        }).map(function (option) {
          return '<option value="' + option.value + '"' + (settings.pageOrientation === option.value ? " selected" : "") + ">" + option.label + "</option>";
        }).join("") +
        "</select></label>",
      "  </div>",
      '  <div class="field-row two-up">',
      '    <label class="field">Margin (in)<input type="number" min="0.05" step="0.05" name="pageMarginIn" value="' + settings.pageMarginIn + '"></label>',
      "  </div>",
      '  <p class="field-help">Changes save automatically.</p>',
      "</form>"
    ].join("");
  }

  function renderPrintSelectionForm(rows) {
    if (!rows.length) {
      return '<div class="empty-state">Create token templates in the designer before preparing print pages.</div>';
    }

    return [
      '<form class="form-grid" data-form="print-selections" novalidate>',
      '  <table class="print-table">',
      "    <thead><tr><th>Token</th><th>Copies</th><th>Start</th></tr></thead>",
      "    <tbody>",
      rows.map(function (row) {
        return [
          "      <tr>",
          "        <td>" + escapeHtml(row.tokenName) + " (" + row.diameterIn + '&quot;)</td>',
          '        <td><input type="number" min="0" step="1" name="copies-' + row.tokenId + '" value="' + row.copies + '"></td>',
          '        <td><input type="number" min="0" step="1" name="start-' + row.tokenId + '" value="' + row.sequenceStart + '"></td>',
          "      </tr>"
        ].join("");
      }).join(""),
      "    </tbody>",
      "  </table>",
      '  <p class="field-help">Changes update the preview when you finish editing a field. Color sequences repeat when copies exceed their length.</p>',
      "</form>"
    ].join("");
  }

  function getSortedSelectionRows(project) {
    return Print.getSelectionRows(project).slice().sort(function (left, right) {
      return naturalLabelCompare(
        left.tokenName + " (" + left.diameterIn + '")',
        right.tokenName + " (" + right.diameterIn + '")'
      );
    });
  }

  function formatPreviewSummary(tokenCount, pageCount) {
    return tokenCount + " token" + (tokenCount === 1 ? "" : "s") + " · " + pageCount + " page" + (pageCount === 1 ? "" : "s");
  }

  function formatSelectionSummary(designCount) {
    return designCount + " design" + (designCount === 1 ? "" : "s");
  }

  function renderPreviewTabs(layout, project, activeIndex) {
    return [
      '<div class="preview-tab-list" role="tablist" aria-label="Preview pages">',
      layout.pages.map(function (page, index) {
        return '<button class="preview-tab' + (index === activeIndex ? " is-active" : "") + '" type="button" role="tab" aria-selected="' + (index === activeIndex ? "true" : "false") + '" data-action="select-preview-page" data-page-index="' + index + '">Page ' + (index + 1) + "</button>";
      }).join(""),
      "</div>",
      renderPreviewSection(layout.pages[activeIndex], project, activeIndex)
    ].join("");
  }

  function renderPreviewSection(page, project, index) {
    return [
      '<div class="preview-page-grid">',
      renderPreviewCard(page, project, index),
      "</div>"
    ].join("");
  }

  function renderPreviewCard(page, project, index) {
    return [
      '<article class="preview-page-card">',
      '  <p class="preview-page-label">Page ' + (index + 1) + "</p>",
      '  <div class="preview-page-svg">',
      renderPageSvg(page, project, true),
      "  </div>",
      "</article>"
    ].join("");
  }

  function renderPageSvg(page, project, isPreview) {
    var pageWidth = page.pageWidthIn * 100;
    var pageHeight = page.pageHeightIn * 100;
    return [
      '<svg viewBox="0 0 ' + pageWidth + " " + pageHeight + '" xmlns="http://www.w3.org/2000/svg"' + (isPreview ? "" : ' width="100%" height="100%"') + '>',
      '  <rect x="0" y="0" width="' + pageWidth + '" height="' + pageHeight + '" fill="#ffffff"></rect>',
      page.items.map(function (item) {
        return renderPageCellFill(item, project);
      }).join(""),
      page.items.map(function (item) {
        return renderPageItem(item, project);
      }).join(""),
      renderCutLines(page),
      "</svg>"
    ].join("");
  }

  function renderPageCellFill(item, project) {
    var face = item.token.front;
    var fill = getPageCellFill(face, project.sequences.color, item.sequenceIndex);
    return '<rect x="' + (item.cellXIn * 100) + '" y="' + (item.cellYIn * 100) + '" width="' + (item.cellSizeIn * 100) + '" height="' + (item.cellSizeIn * 100) + '" fill="' + escapeHtml(fill) + '"></rect>';
  }

  function renderPageItem(item, project) {
    var x = item.xIn * 100;
    var y = item.yIn * 100;
    var size = item.diameterIn * 100;
    var cellFill = getPageCellFill(item.token.front, project.sequences.color, item.sequenceIndex);
    return Renderer.renderTokenSvg(item.token, project, {
      sequenceIndex: item.sequenceIndex,
      instanceId: "page-front-" + item.sequenceIndex + "-" + Math.round(x) + "-" + Math.round(y),
      interactive: false,
      outerSquareFill: cellFill,
      tokenBaseFill: cellFill,
      svgAttributes: 'x="' + x + '" y="' + y + '" width="' + size + '" height="' + size + '"'
    });
  }

  function renderCutLines(page) {
    if (!page.items.length) {
      return "";
    }
    return collectBoundarySegments(page, "vertical").map(function (segment) {
      return '<line x1="' + segment.fixed + '" y1="' + segment.start + '" x2="' + segment.fixed + '" y2="' + segment.end + '" stroke="#7f7f7f" stroke-width="0.75" stroke-dasharray="2 2"></line>';
    }).concat(collectBoundarySegments(page, "horizontal").map(function (segment) {
      return '<line x1="' + segment.start + '" y1="' + segment.fixed + '" x2="' + segment.end + '" y2="' + segment.fixed + '" stroke="#7f7f7f" stroke-width="0.75" stroke-dasharray="2 2"></line>';
    })).join("");
  }

  function collectBoundarySegments(page, orientation) {
    var segmentsByLine = new Map();

    page.items.forEach(function (item) {
      var left = item.cellXIn * 100;
      var right = (item.cellXIn + item.cellSizeIn) * 100;
      var top = item.cellYIn * 100;
      var bottom = (item.cellYIn + item.cellSizeIn) * 100;

      if (orientation === "vertical") {
        addSegment(segmentsByLine, left, top, bottom);
        addSegment(segmentsByLine, right, top, bottom);
      } else {
        addSegment(segmentsByLine, top, left, right);
        addSegment(segmentsByLine, bottom, left, right);
      }
    });

    return Array.from(segmentsByLine.entries()).sort(function (left, right) {
      return left[0] - right[0];
    }).flatMap(function (entry) {
      var fixed = entry[0];
      var intervals = entry[1];
      var breakpoints = intervals.reduce(function (points, interval) {
        points.push(interval.start, interval.end);
        return points;
      }, []).sort(function (left, right) {
        return left - right;
      }).filter(function (value, index, all) {
        return index === 0 || Math.abs(value - all[index - 1]) > 0.000001;
      });

      var segments = [];
      for (var index = 0; index < breakpoints.length - 1; index += 1) {
        var start = breakpoints[index];
        var end = breakpoints[index + 1];
        if (end - start <= 0.000001) {
          continue;
        }
        var covered = intervals.some(function (interval) {
          return interval.start <= start + 0.000001 && interval.end >= end - 0.000001;
        });
        if (covered) {
          segments.push({
            fixed: fixed,
            start: start,
            end: end
          });
        }
      }
      return segments;
    });
  }

  function addSegment(segmentsByLine, fixed, start, end) {
    var roundedFixed = roundCoordinate(fixed);
    var segments = segmentsByLine.get(roundedFixed) || [];
    segments.push({
      start: Math.min(start, end),
      end: Math.max(start, end)
    });
    segmentsByLine.set(roundedFixed, segments);
  }

  function roundCoordinate(value) {
    return Number(value.toFixed(4));
  }

  function getPageCellFill(face, colorSequences, sequenceIndex) {
    if (face.border && face.border.widthRatio > 0) {
      return Tokens.getColorValue(
        face.border.colorMode,
        face.border.color,
        face.border.colorSequenceRef,
        colorSequences,
        sequenceIndex
      );
    }

    return Tokens.getColorValue(
      face.backgroundColorMode,
      face.backgroundColor,
      face.backgroundColorSequenceRef,
      colorSequences,
      sequenceIndex
    );
  }

  function openPrintWindow(layout, project) {
    if (!runtimeGlobal.document || !runtimeGlobal.document.body) {
      return;
    }

    cleanupPrintFrame();
    var pages = layout.pages.map(function (page) {
      return renderPrintablePage(page, project);
    });
    var iframe = runtimeGlobal.document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.className = "print-frame";
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    runtimeGlobal.document.body.appendChild(iframe);
    activePrintFrame = iframe;

    var printWindow = iframe.contentWindow;
    if (!printWindow) {
      cleanupPrintFrame();
      return;
    }

    printWindow.document.open();
    printWindow.document.write([
      "<!doctype html><html><head><title>Monster Mint Print</title><style>",
      "html,body{margin:0;padding:0;background:#fff;font-family:Georgia,serif;}",
      ".print-page{page-break-after:always;break-after:page;display:block;}",
      ".print-page:last-child{page-break-after:auto;break-after:auto;}",
      "</style></head><body>",
      pages.join(""),
      "</body></html>"
    ].join(""));
    printWindow.document.close();
    runtimeGlobal.setTimeout(function () {
      try {
        printWindow.focus();
        printWindow.print();
      } finally {
        runtimeGlobal.setTimeout(cleanupPrintFrame, 1000);
      }
    }, 50);
  }

  function cleanupPrintFrame() {
    if (!activePrintFrame) {
      return;
    }
    if (activePrintFrame.parentNode) {
      activePrintFrame.parentNode.removeChild(activePrintFrame);
    }
    activePrintFrame = null;
  }

  function renderPrintablePage(page, project) {
    return [
      '<div class="print-page" style="width:' + page.pageWidthIn + "in;height:" + page.pageHeightIn + 'in;">',
      renderPageSvg(page, project, false),
      "</div>"
    ].join("");
  }

  return {
    renderPanel: renderPanel,
    bindForms: bindForms,
    printCurrentLayout: printCurrentLayout
  };
});
