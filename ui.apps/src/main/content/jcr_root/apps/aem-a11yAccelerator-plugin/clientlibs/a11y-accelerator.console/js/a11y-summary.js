(function ($, $document) {
  "use strict";

  document.addEventListener("DOMContentLoaded", initSummaryDashboard);

  async function initSummaryDashboard() {
    const container = document.getElementById("summary-container");
    if (!container) return;

    const parentPath = localStorage.getItem("a11y-scan-path") || "/var/a11y-scans/content";

    // fetch scan results from servlet (expects JSON array or { pages: [...] })
    let data = null;
    try {
      const url = "/bin/a11y/scanresult?path=" + encodeURIComponent(parentPath);
      const res = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
        headers: { "Accept": "application/json" },
        cache: "no-store"
      });
      if (!res.ok) throw new Error("Server responded " + res.status);
      data = await res.json();
    } catch (err) {
      console.warn("Failed to fetch scan results from server:", err);
      container.innerHTML = '<p>No scan results found. Run a multi-page scan first.</p>';
      return;
    }

    // normalize shapes like { pages: [...] } or [...]
    let pages = null;
    if (Array.isArray(data)) pages = data;
    else if (data && Array.isArray(data.pages)) pages = data.pages;
    else {
      // try to convert map -> array (safe fallback)
      pages = Object.keys(data || {}).map(k => data[k]).filter(Boolean);
    }

    if (!pages || !pages.length) {
      container.innerHTML = '<p>No scan results found. Run a multi-page scan first.</p>';
      return;
    }

    renderPageSummary(pages, container);
  }

  function renderPageSummary(storedResults, container) {
    container.innerHTML = "";

    storedResults.forEach((group) => {
      const title = group.pageTitle || (group.path ? group.path.split("/").pop() : "(unknown)");
      const fullURL = group.fullURL || "(URL unavailable)";
      const issueCounts = countByImpact(group.results || []);
      const total = (group.results || []).length;

      const card = document.createElement("div");
      card.className = "summary-card";
      card.innerHTML = `
      <div class="summary-card-header">
        <h3>${escapeHtml(title)}</h3>
        <span>${total} issues</span>
      </div>
      <div class="summary-card-body">
        <p><strong>Full URL:</strong> <a href="${escapeAttr(fullURL)}" target="_blank">${escapeHtml(fullURL)}</a></p>
        <div class="summary-bar">${renderImpactBar(issueCounts)}</div>
      </div>
      <div class="summary-actions">
        <button is="coral-button" variant="default" class="btn-card fix-suggestion" data-path="${escapeAttr(group.path || "")}">
          Fix Suggestions
        </button>
        <button is="coral-button" variant="primary" class="btn-card ai-remediate" data-path="${escapeAttr(group.path || "")}">
          AI Remediate
        </button>
        <button is="coral-button" variant="quiet" class="btn-card view-report" data-path="${escapeAttr(group.path || "")}">
          Page Report
        </button>
      </div>
    `;
      // attach click handler via delegation later or here:
      card.querySelector(".view-report").addEventListener("click", (ev) => {
        const p = ev.currentTarget.dataset.path;
        openPageReport(p, storedResults); // pass the full dataset for speed
      });

      container.appendChild(card);
    });
  }

  // --- Styles injection (unchanged from yours) ---
  function injectPageReportStyles() {
    if (document.getElementById("a11y-page-report-style")) return;
    const css = document.createElement("style");
    css.id = "a11y-page-report-style";
    css.textContent = `
      /* copy your modal CSS here (omitted for brevity) */
      .a11y-page-report .coral3-Dialog-content { padding: 0 !important; overflow: hidden !important; }
      .a11y-page-report .page-report-shell { display:flex;height:82vh;width:90vw;max-width:1400px;min-width:900px; }
      .a11y-page-report .report-left { width:320px;border-right:1px solid #eee;padding:18px;overflow-y:auto;background:#fafafa; }
      .a11y-page-report .report-right { flex:1;padding:22px;overflow-y:auto;position:relative;background:#fff; }
      .a11y-page-report .live-iframe { width:100%;height:70vh;border:none;background:#fff; }
    `;
    document.head.appendChild(css);
  }

  /**
   * Open the page report modal
   * - path: page.path (string)
   * - allPages: optional array of pages already fetched (so we don't re-fetch)
   */
  async function openPageReport(path, allPages) {
    injectPageReportStyles();

    // try to find page in passed-in array
    let page = null;
    if (Array.isArray(allPages)) {
      page = allPages.find((p) => (p.path || "").replace(/\.html$/, "") === (path || "").replace(/\.html$/, ""));
    }

    // if not found, fetch a single page JSON from servlet (optional)
    if (!page) {
      try {
        const parentPath = localStorage.getItem("a11y-scan-path") || "/var/a11y-scans/content";
        const url = "/bin/a11y/scanresult?path=" + encodeURIComponent(parentPath);
        const res = await fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } });
        const data = await res.json();
        const pages = Array.isArray(data) ? data : (Array.isArray(data.pages) ? data.pages : []);
        page = pages.find((p) => (p.path || "") === path || (p.path || "").replace(/\.html$/, "") === path.replace(/\.html$/, ""));
      } catch (err) {
        console.warn("Failed to fetch page data:", err);
      }
    }

    if (!page) {
      alert("Page data not found for " + path + ". Try re-scanning the path.");
      return;
    }

    // build left list
    const leftListHtml = (page.results || []).map((r, idx) => {
      const shortDesc = escapeHtml((r.help || r.description || "").substring(0, 140));
      return `
        <div class="issue-item" data-idx="${idx}">
          <div class="title">${escapeHtml(r.id || "—")}</div>
          <div class="desc" style="color:var(--coral-foreground-secondary)">${shortDesc}</div>
          <div style="margin-top:8px;display:flex;gap:12px;justify-content:center;">
            <button class="btn-view-html" data-idx="${idx}" is="coral-button" variant="quiet">View HTML</button>
            <button class="btn-view-live" data-idx="${idx}" is="coral-button" variant="quiet">Live</button>
          </div>
        </div>`;
    }).join("") || '<div style="padding:12px;color:#777;">No issues found for this page.</div>';

    // right content placeholders (we will set srcdoc after dialog exists)
    const rightHtml = `
      <div class="view-tabs">
        <div class="tab html-tab"><strong>HTML View</strong></div>
        <div class="tab live-tab"><strong>Live View</strong></div>
      </div>
      <div class="view-html">
        <pre class="code-block" id="a11y-report-code">${escapeHtml((page.results && page.results[0] && page.results[0].nodes && (page.results[0].nodes[0].liveHTML || page.results[0].nodes[0].html)) || "<p>No snippet</p>")}</pre>
      </div>
      <div class="view-live" style="display:none;">
        <iframe class="live-iframe" id="a11y-live-iframe"></iframe>
      </div>
    `;

    const dialog = new Coral.Dialog().set({
      header: { innerHTML: `Page Report: ${escapeHtml(path)}` },
      content: { innerHTML: `<div class="page-report-shell"><div class="report-left">
            <button is="coral-button" variant="quiet" class="ai-remediate-btn">AI Remediate</button>
            ${leftListHtml}
          </div><div class="report-right">${rightHtml}</div></div>` },
      footer: { innerHTML: '<div class="report-actions"><button is="coral-button" variant="quiet" coral-close>Close</button></div>' },
      closable: true
    });

    document.body.appendChild(dialog);
    Coral.commons.ready(dialog, () => dialog.show());

    // after dialog shown, set iframe srcdoc safely (raw html)
    const iframe = dialog.content.querySelector("#a11y-live-iframe");
    const htmlSource = (window.A11Y_SCAN_HTML_CACHE && window.A11Y_SCAN_HTML_CACHE[page.path]) || page.htmlText || "";
    try {
      if (iframe) iframe.srcdoc = htmlSource;
    } catch (e) {
      console.warn("Could not set iframe.srcdoc directly, writing to document instead", e);
      try {
        if (iframe && iframe.contentDocument) {
          iframe.contentDocument.open();
          iframe.contentDocument.write(htmlSource);
          iframe.contentDocument.close();
        }
      } catch (err) { console.warn("iframe fallback failed", err); }
    }

    // click handlers on left list (delegation)
    dialog.content.querySelector(".report-left").addEventListener("click", (ev) => {
      const vHtml = ev.target.closest(".btn-view-html");
      const vLive = ev.target.closest(".btn-view-live");
      if (vHtml) {
        const idx = Number(vHtml.dataset.idx);
        renderIssueHtml(page, idx, dialog);
      } else if (vLive) {
        const idx = Number(vLive.dataset.idx);
        renderIssueLive(page, idx, dialog);
      }
    });

    // tabs behavior
    const right = dialog.content.querySelector(".report-right");
    right.querySelector(".html-tab").addEventListener("click", () => {
      right.querySelector(".view-live").style.display = "none";
      right.querySelector(".view-html").style.display = "";
    });
    right.querySelector(".live-tab").addEventListener("click", () => {
      right.querySelector(".view-html").style.display = "none";
      right.querySelector(".view-live").style.display = "";
    });

    dialog.on("coral-overlay:close", () => { try { dialog.remove(); } catch (e) {} });
  }

  function renderIssueHtml(page, idx, dialog) {
    const item = (page.results || [])[idx];
    if (!item) return;
    const node = (item.nodes && item.nodes[0]) || {};
    const code = node.liveHTML || node.html || "(no snippet)";
    const pre = dialog.content.querySelector("#a11y-report-code");
    if (pre) pre.textContent = code;
    dialog.content.querySelector(".view-html").style.display = "";
    dialog.content.querySelector(".view-live").style.display = "none";
  }

  function renderIssueLive(page, idx, dialog) {
    const item = (page.results || [])[idx];
    if (!item) return;
    const htmlSource = (window.A11Y_SCAN_HTML_CACHE && window.A11Y_SCAN_HTML_CACHE[page.path]) || page.htmlText || "";
    const iframe = dialog.content.querySelector("#a11y-live-iframe");
    if (iframe) {
      try {
        iframe.srcdoc = htmlSource;
      } catch (e) {
        try {
          iframe.contentDocument.open();
          iframe.contentDocument.write(htmlSource);
          iframe.contentDocument.close();
        } catch (err) {
          console.warn("A11Y: live render failed", err);
        }
      }
    }
    dialog.content.querySelector(".view-html").style.display = "none";
    dialog.content.querySelector(".view-live").style.display = "";
  }

  // helpers
  function escapeHtml(s) {
    if (!s) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escapeAttr(s){ return escapeHtml(s).replace(/'/g, "&#39;"); }

  function countByImpact(issues) {
    const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    (issues || []).forEach(i => {
      const impact = (i && i.impact) || "minor";
      counts[impact] = (counts[impact] || 0) + 1;
    });
    return counts;
  }

  function renderImpactBar(counts) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) return '<div class="bar-empty">No issues</div>';
    return Object.entries(counts)
      .map(([level, count]) => {
        const width = (count / total) * 100;
        return `<div class="bar-segment impact-${level}" style="width:${width}%;" title="${level}: ${count}"></div>`;
      }).join('');
  }

})(Granite.$, $(document));
