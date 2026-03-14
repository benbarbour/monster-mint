(function (global, factory) {
  var api = factory(global.MonsterMintSchema, global.MonsterMintState);
  global.MonsterMintApp = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (Schema, State) {
  var TAB_CONFIG = [
    { id: "settings", label: "Settings" },
    { id: "designer", label: "Designer" },
    { id: "print", label: "Print" }
  ];

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;");
  }

  function render(appElement, store) {
    var state = store.getState();
    var activeTab = state.ui.activeTab;

    appElement.innerHTML = [
      '<main class="app-shell">',
      '  <header class="app-header">',
      '    <div>',
      '      <h1 class="app-title">Monster Mint</h1>',
      '      <p class="app-subtitle">Design printable tabletop token sheets in one self-contained browser app.</p>',
      "    </div>",
      '    <div class="project-meta">',
      '      <label>Project name<input class="project-name-input" name="project-name" value="' + escapeHtml(state.project.meta.name) + '"></label>',
      '      <span class="status-pill">' + escapeHtml(state.autosaveStatus) + "</span>",
      '      <button class="button" type="button" data-action="reset-project">Reset Project</button>',
      "    </div>",
      "  </header>",
      '  <nav class="tabs" aria-label="Main tabs">',
      TAB_CONFIG.map(function (tab) {
        return '<button class="tab-button' + (tab.id === activeTab ? " is-active" : "") + '" type="button" data-tab="' + tab.id + '">' + tab.label + "</button>";
      }).join(""),
      "  </nav>",
      renderPanel("settings", activeTab, renderSettingsPanel(state)),
      renderPanel("designer", activeTab, renderDesignerPanel(state)),
      renderPanel("print", activeTab, renderPrintPanel(state)),
      "</main>"
    ].join("");

    attachEvents(appElement, store);
  }

  function renderPanel(tabId, activeTab, content) {
    return '<section class="tab-panel' + (tabId === activeTab ? " is-active" : "") + '" data-panel="' + tabId + '">' + content + "</section>";
  }

  function renderSettingsPanel(state) {
    var preset = Schema.findPagePreset(state.project.settings.pagePresetId);
    return [
      '<div class="panel-grid">',
      '  <section class="panel-card">',
      "    <h2>Foundation</h2>",
      "    <p>This slice includes project persistence, the final tab structure, and the source/build pipeline.</p>",
      "    <ul class=\"placeholder-list\">",
      "      <li>Current page preset: " + escapeHtml(preset ? preset.label : "Unknown") + "</li>",
      "      <li>Token templates: " + state.project.tokens.length + "</li>",
      "      <li>Saved print selections: " + state.project.printSelections.length + "</li>",
      "    </ul>",
      "  </section>",
      '  <section class="panel-card">',
      "    <h2>Next up</h2>",
      "    <p>Sequence and import/export controls will land in the next increment.</p>",
      "  </section>",
      "</div>"
    ].join("");
  }

  function renderDesignerPanel(state) {
    return [
      '<div class="empty-state">',
      "  <h2>Designer foundation ready</h2>",
      "  <p>The token editor will appear here once the sequence and template layers are in place.</p>",
      "  <p>Autosave is already active. Updated: " + escapeHtml(new Date(state.project.meta.updatedAt).toLocaleString()) + "</p>",
      "</div>"
    ].join("");
  }

  function renderPrintPanel() {
    return [
      '<div class="empty-state">',
      "  <h2>Print pipeline pending</h2>",
      "  <p>Page layout, previews, and print rendering will be added after the designer is in place.</p>",
      "</div>"
    ].join("");
  }

  function attachEvents(appElement, store) {
    appElement.querySelectorAll("[data-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        store.setActiveTab(button.getAttribute("data-tab"));
      });
    });

    var nameInput = appElement.querySelector("[name='project-name']");
    if (nameInput) {
      nameInput.addEventListener("input", function () {
        store.updateProject(function (project) {
          project.meta.name = nameInput.value || "Untitled Project";
        });
      });
    }

    var resetButton = appElement.querySelector("[data-action='reset-project']");
    if (resetButton) {
      resetButton.addEventListener("click", function () {
        if (!global.confirm("Reset the current project? This clears saved tokens and sequences.")) {
          return;
        }

        store.replaceProject(Schema.createDefaultProject());
      });
    }
  }

  function mount() {
    var appElement = document.getElementById("app");
    var store = State.createStore({ storage: global.localStorage });
    store.subscribe(function () {
      render(appElement, store);
    });
    render(appElement, store);
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", mount);
  }

  return {
    mount: mount
  };
});

