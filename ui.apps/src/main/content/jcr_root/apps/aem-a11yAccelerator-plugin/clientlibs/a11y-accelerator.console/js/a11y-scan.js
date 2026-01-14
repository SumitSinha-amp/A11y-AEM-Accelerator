(function ($, $document) {
  "use strict";

  // Global variable accessible to all functions
  let scanMode = "single";
  const pageUrl = "";
  //const fullPageURL = getPageURL(page.path);
  document.addEventListener("DOMContentLoaded", initA11yScanner);
  function getPageURL(path) {
    // Always base on the environment where this script runs
    const baseOrigin = window.location.origin; // automatically handles localhost, author, stage, prod
    const cleanPath = path.startsWith("/") ? path : `/${path}`;

    return `${baseOrigin}${cleanPath}.html`;
  }
  function initA11yScanner() {
    const scanBtn = document.getElementById("scan-button");
    const resultsContainer = document.getElementById("scan-page");
    const statusAlert = document.getElementById("status-alerts");
    const scanForm = document.querySelector("#scan-form");
    const pathField = scanForm?.querySelector("foundation-autocomplete");
    const taglist = pathField?.querySelector("coral-taglist");

    if (!scanBtn || !pathField) return;
    const scanModeToggle = document.getElementById("scan-mode");
    scanMode = "single";

    if (scanModeToggle) {
      scanModeToggle.addEventListener("change", (e) => {
        scanMode = e.target.value;
        const label = scanMode === "multiple" ? "Scan All Pages" : "Scan";
        document
          .getElementById("scan-button")
          .querySelector("coral-button-label").textContent = label;

        //Reconfigure pathfield picker dynamically
        // const pathField = document.querySelector("foundation-autocomplete");
        // if (pathField) {
        //   configurePathField(pathField, scanMode);
        // }
        const pathField = document.querySelector("foundation-autocomplete");
        if (pathField) {
          configurePathField(pathField, scanMode);
 
          // === NEW: clear any selected tags when user switches scan mode ===
          // Clear the visual taglist so previous selection doesn't persist across modes
          try {
            const taglistEl = pathField.querySelector("coral-taglist");
            if (taglistEl && taglistEl.items) {
              taglistEl.items.clear();
            }
            const inputEl = pathField.querySelector('input[is="coral-textfield"]');
    if (inputEl) {
      inputEl.value = ""; // reset text
      inputEl.removeAttribute("value"); // clear persisted attribute
    }
            // Also clear any saved path stored earlier
            try { localStorage.removeItem("a11y-scan-path"); } catch (e) {}
          } catch (err) {
            // non-fatal, continue
            console.warn("Failed to clear pathfield tags on mode change", err);
          }
        }
      });
    }
    //configurePathField(pathField);
    scanBtn.addEventListener("click", (e) =>
      handleScanClick(
        e,
        taglist,
        pathField,
        resultsContainer,
        statusAlert,
        scanBtn
      )
    );
  }

  function configurePathField(pathField, scanMode = "single") {
    const PICKER_BASE_URL =
      "/mnt/overlay/granite/ui/content/coral/foundation/form/pathfield/picker.html";
    const ROOT_PATH = "/content";
    const FILTER_TYPE = "hierarchy";
    const SELECTION_COUNT = scanMode === "single" ? "single" : "multiple";

    const selectionType = scanMode === "single" ? "cq:Page" : "hierarchy";
    const finalPickerSrc =
      `${PICKER_BASE_URL}?_charset_=utf-8` +
      `&root=${ROOT_PATH}` +
      `&filter=${FILTER_TYPE}` +
      `&selectionCount=${SELECTION_COUNT}` +
      `&selection=${encodeURIComponent(ROOT_PATH)}` +
      `&type=${encodeURIComponent(selectionType)}`;

    pathField.id = "scan-pathfield";
    pathField.setAttribute("pickersrc", finalPickerSrc);
    // Set pathfield to single selection mode if in single page mode
    if (scanMode === "single") {
      pathField.setAttribute("multiple", "false");
    } else {
      pathField.setAttribute("multiple", "true");
    }

    // Optional: clear any existing selected tags when switching mode
    const tagList = pathField.querySelector("coral-taglist");
    if (tagList) {
      tagList.items.clear();
    }
    // Force re-render Coral TagList immediately after selection
    if (!pathField.dataset.bound) {
      pathField.addEventListener("foundation-autocomplete:selected", (e) => {
        const taglist = pathField.querySelector("coral-taglist");
        if (taglist && e.detail && e.detail.item) {
          const value = e.detail.item.value || e.detail.item.textContent.trim();
          if (![...taglist.items.getAll()].some((t) => t.value === value)) {
            const tag = document.createElement("coral-tag");
            tag.setAttribute("value", value);
            tag.innerText = value;
            taglist.appendChild(tag);
            localStorage.setItem("a11y-scan-path",tag.value); 
          }
        }
      });
      pathField.dataset.bound = true; // prevent rebinding
    }
  }

  async function handleScanClick(
    e,
    taglist,
    pathField,
    resultsContainer,
    statusAlert,
    scanBtn
  ) {
    e.preventDefault();
    // const selectedTag = taglist?.querySelector('coral-tag');
    const selectedTags = taglist?.querySelectorAll("coral-tag") || [];
    const selectedValues = Array.from(selectedTags).map((tag) =>
      tag.getAttribute("value")
    );

    // Validate selection
    if (scanMode === "single" && selectedValues.length > 1) {
      pathField.classList.add("is-invalid");
      createErrorDialog(
        "Validation Error",
        "Please select only one page in Single Page mode."
      );
      setTimeout(() => pathField.classList.remove("is-invalid"), 2000);
      return;
    }

    if (selectedValues.length === 0) {
      createErrorDialog(
        "Validation Error",
        "Please select a page or path before scanning."
      );
      return;
    }

    // Determine single or multiple paths
    const pathValue = selectedValues[0]; // first one for single mode
    const allPaths = selectedValues; // all for multi-page mode

    if (!pathValue) {
      createErrorDialog(
        "Validation Error",
        "Please select a path before scanning."
      );
      pathField.setCustomValidity("Please select a path.");
      pathField.checkValidity();
      return;
    }

    const pageUrl = `${pathValue}.html`;
    console.log(`Fetching rendered HTML for: ${pageUrl}`);
    //  return pageUrl;
    try {
      animateScanButton(scanBtn, true); // start animation
      showLoadingUI(statusAlert, resultsContainer);
      //const htmlText = await fetchPageHTML(pageUrl);
      //await runAxeCore(htmlText, resultsContainer, statusAlert);
      if (scanMode === "single") {
        const htmlText = await fetchPageHTML(pageUrl);
        await runAxeCore(htmlText, resultsContainer, statusAlert, pathValue);
      } else {
        await runMultiPageScan(pathValue, resultsContainer, statusAlert);
      }
    } catch (err) {
      console.error("Error fetching rendered HTML:", err);
      statusAlert.setAttribute("variant", "error");
      statusAlert.querySelector("p").textContent =
        "Error loading or scanning the page.";
      hideLoadingUI(statusAlert);
    } finally {
      animateScanButton(scanBtn, false); // stop animation (even if error)
    }
  }

  async function fetchPageHTML(url) {
    const response = await fetch(url, {
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok)
      throw new Error(`Failed to load page: ${response.status}`);
    return await response.text();
  }

  function createErrorDialog(header, message) {
    const dialog = new Coral.Dialog().set({
      variant: "error",
      header: { innerHTML: header },
      content: { innerHTML: message },
      footer: {
        innerHTML:
          '<button is="coral-button" variant="primary" coral-close>OK</button>',
      },
      closable: true,
    });
    document.body.appendChild(dialog);
    dialog.show();
    dialog.on("coral-overlay:close", () => dialog.remove());
  }

  function showLoadingUI(statusAlert, resultsContainer) {
    // Spinner setup
    statusAlert.removeAttribute("hidden");
    statusAlert.setAttribute("variant", "info");
    statusAlert.querySelector("p").innerHTML = `
      <span>Scanning... Please wait</span>
      <span class="spinner"></span>
    `;

    // Skeleton loader
    resultsContainer.innerHTML = generateSkeletonHTML(6);
  }

  function hideLoadingUI(statusAlert) {
    const spinner = statusAlert.querySelector(".spinner");
    if (spinner) spinner.remove();
  }
  function animateScanButton(button, isScanning) {
    if (!button) return;

    if (isScanning) {
      button.setAttribute("disabled", "true");
      button.classList.add("scanning");
      button.innerHTML = `
      <span class="scan-spinner"></span>
      <span class="scan-text">Scanning...</span>
    `;
    } else {
      button.removeAttribute("disabled");
      button.classList.remove("scanning");
      button.innerHTML = `
      <coral-icon icon="search" size="S"></coral-icon>
      <coral-button-label>Scan</coral-button-label>
    `;
    }
  }
  function getScanIframe() {
    let iframe = document.querySelector("#a11y-scan-frame");
    if (iframe && iframe.contentDocument) return iframe;

    // fallback — find any visible iframe with .html in src
    iframe = Array.from(document.querySelectorAll("iframe")).find(
      (f) => f.src.includes(".html") && f.contentDocument
    );

    if (iframe) iframe.id = "a11y-scan-frame"; // tag it for future lookups
    return iframe || null;
  }

  function generateSkeletonHTML(rows = 5) {
    let skeleton = `
      <div class="skeleton-table">
        <div class="skeleton-header"></div>
        <div class="skeleton-body">
    `;
    for (let i = 0; i < rows; i++) {
      skeleton += `<div class="skeleton-row"><div class="skeleton-cell"></div><div class="skeleton-cell"></div><div class="skeleton-cell"></div></div>`;
    }
    skeleton += `</div></div>`;
    return skeleton;
  }

  async function runAxeCore(htmlText, resultsContainer, statusAlert, pageUrl) {
    // Create iframe for live page scanning
    const iframe = document.createElement("iframe");
    iframe.id = "a11y-scan-frame";
    const pagePath = getPageURL(pageUrl);
    /*
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    iframe.contentDocument.open();
    iframe.contentDocument.write(htmlText);
    iframe.contentDocument.close();

    await new Promise(r => setTimeout(r, 1000));*/
    resultsContainer.innerHTML = "";
    statusAlert.querySelector("p").textContent = `Loading page: ${pageUrl}...`;
    iframe.src = pagePath;
    iframe.style.display = "none";
    // iframe.style.display = 'block';
    // iframe.style.position = 'absolute';
    //iframe.style.left = '-9999px';
    document.body.appendChild(iframe);

    // Wait until the page fully loads
    await new Promise((resolve, reject) => {
      iframe.onload = () => resolve();
      iframe.onerror = () =>
        reject(new Error(`Failed to load page: ${pageUrl}`));
    });

    if (!iframe.contentWindow.axe || !iframe.contentWindow.axe.run) {
      const script = iframe.contentDocument.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js";
      iframe.contentDocument.head.appendChild(script);
      await new Promise((r) => (script.onload = r));
    }

    const axeOptions = {
      runOnly: {
        type: "tag",
        values: [
          "wcag2a",
          "wcag2aa",
          "wcag2aaa",
          "wcag21a",
          "wcag21aa",
          "wcag21aaa",
          "wcag22a",
          "wcag22aa",
          "wcag22aaa",
          "wcag253",
          "EN-301-549",
          "wcag131",
          "EN-9.1.3.1",
          "best-practice",
          "cat.aria",
          "cat.name-role-value",
          "ACT",
          "cat.color",
          "cat.text-alternatives",
          "cat.forms",
          "cat.keyboard",
          "cat.sensory-and-visual-cues",
          "cat.language",
          "cat.parsing",
          "cat.structure",
          "cat.tables",
          "cat.time-and-media",
          "cat.semantics",
          "experimental",
          "review-item",
        ],
      },
      rules: {
        // Force-enable some high-value checks
        "document-title": { enabled: true },
        "empty-heading": { enabled: true },
        "image-alt": { enabled: true },
        "video-caption": { enabled: true },
        "color-contrast-enhanced": { enabled: true },
        region: { enabled: true },
        "landmark-one-main": { enabled: true },
        "landmark-no-duplicate-contentinfo": { enabled: true },
        "landmark-unique": { enabled: true },
        "aria-allowed-role": { enabled: true },
        "aria-required-parent": { enabled: true },
        "target-size": { enabled: true },
        //'target-size-minimum': { enabled: true },
      },
      resultTypes: ["violations", "incomplete"],
      reporter: "v2",
    };

    try {
      await new Promise((resolve) => {
        const checkDOM = setInterval(() => {
          const doc = iframe.contentDocument;
          if (!doc) return;
          const hasLandmarks = doc.querySelector(
            'main, [role="main"], header, footer, nav, aside, [role="region"]'
          );
          if (hasLandmarks) {
            clearInterval(checkDOM);
            resolve();
          }
        }, 500);
      });
      console.log("axe version", iframe.contentWindow.axe.version);

      const results = await iframe.contentWindow.axe.run(
        iframe.contentDocument,
        axeOptions
      );
      try {
        const snapshot = iframe.contentDocument.documentElement.outerHTML;
        window.A11Y_SCAN_HTML_CACHE = window.A11Y_SCAN_HTML_CACHE || {};
        // store using normalized path key (same convention you use elsewhere)
        const key = (pageUrl || "").replace(/\.html$/, "");
        window.A11Y_SCAN_HTML_CACHE[key] = snapshot;

        // Also prepare a cleaned/normalized HTML text for viewer and results
        const cleanedSnapshot = cleanTokHtml(snapshot || "");

        // make cleaned snapshot available on results (so renderResultsTable uses it)
        // later call to renderResultsTable should receive cleanedSnapshot (see below)
        // store cleaned copy in cache too (helpful for multi-page flows)
        window.A11Y_SCAN_HTML_CACHE[key + "::cleaned"] = cleanedSnapshot;
      } catch (e) {
        console.warn("Failed to snapshot iframe DOM", e);
      }

      // 🔹 Enrich each node with exact live HTML from the iframe DOM
      results.violations?.forEach((rule) => {
        rule.nodes.forEach((node) => {
          try {
            // use axe-core’s built-in helper to get the actual element reference
            const element = iframe.contentDocument.querySelector(
              node.target[0]
            );
            if (element && element.outerHTML) {
              node.liveHTML = element.outerHTML; // store exact serialized element
            }
          } catch (err) {
            console.warn("Failed to extract liveHTML for", node.target, err);
          }
        });
      });
      results.incomplete?.forEach((rule) => {
        rule.nodes.forEach((node) => {
          try {
            const element = iframe.contentDocument.querySelector(
              node.target[0]
            );
            if (element && element.outerHTML) node.liveHTML = element.outerHTML;
          } catch {}
        });
      });
      hideLoadingUI(statusAlert);
      /* const allFindings = [
          ...(results.violations || []),
          ...(results.incomplete || []),
          ...(results.passes || [])
        ];*/
      const violationsWithType = (results.violations || []).map((v) => ({
        ...v,
        type: "violation",
      }));
      const incompleteWithType = (results.incomplete || []).map((v) => ({
        ...v,
        type: "potential",
      }));

      const allFindings = [...violationsWithType, ...incompleteWithType];
      statusAlert.setAttribute("variant", "success");
      //statusAlert.querySelector('p').textContent = `Scan complete. Found ${results.violations.length} issues.`;

      statusAlert.querySelector(
        "p"
      ).textContent = `Scan complete. Found ${allFindings.length} total issues (including potential).`;
      resultsContainer.innerHTML = "";
      if (allFindings.length > 0) {
        // renderResultsTable(allFindings, htmlText, resultsContainer);
        const cleanedCacheKey =
          (pageUrl || "").replace(/\.html$/, "") + "::cleaned";
        const cleanedForRender =
          (window.A11Y_SCAN_HTML_CACHE &&
            window.A11Y_SCAN_HTML_CACHE[cleanedCacheKey]) ||
          cleanTokHtml(htmlText || "");
        renderResultsTable(allFindings, cleanedForRender, resultsContainer);
        //const normalizedResults = normalizeAxeResults(results, iframe.contentDocument);
      } else {
        resultsContainer.innerHTML = "<p>No accessibility issues found</p>";
      }
      /*if (allFindings.length > 0) {
  // attach htmlText to every violation so "View HTML" works
  const enrichedResults = allFindings.map(v => ({ ...v, htmlText }));
  renderResultsTable(enrichedResults, htmlText, resultsContainer);
} else {
  resultsContainer.innerHTML = '<p>No accessibility issues found</p>';
}
*/
    } catch (err) {
      console.error("Axe scan error:", err);
      statusAlert.setAttribute("variant", "error");
      statusAlert.querySelector("p").textContent = "Error running scan.";
      hideLoadingUI(statusAlert);
    }
  }

  //MultiPage Scan
  async function runMultiPageScan(rootPath, resultsContainer, statusAlert) {
    localStorage.setItem("a11y-scan-path",rootPath);
    statusAlert.querySelector(
      "p"
    ).textContent = `Fetching child pages under ${rootPath}...`;
    const pages = await fetchChildPages(rootPath);
    statusAlert.querySelector("p").textContent = `Preparing multi-page scan...`;

    const estimatedSeconds = pages.length * 6; // assume ~6s per page
    const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

    statusAlert.insertAdjacentHTML(
      "beforeend",
      `<p class="eta-info">Estimated time: ~${estimatedMinutes} minute(s)</p>`
    );

    if (!pages.length) {
      statusAlert.setAttribute("variant", "warning");
      statusAlert.querySelector("p").textContent =
        "No child pages found for this path.";
      return;
    }

    const aggregatedResults = [];
    /*for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    //statusAlert.querySelector('p').textContent = `Scanning page ${i + 1} of ${pages.length}: ${page.path}`;
    statusAlert.querySelector('p').innerHTML = `
      Scanning page ${i + 1} of ${pages.length}: ${pages[i].path}
      <span class="eta-progress">(ETA: ~${estimatedSeconds - i * 6}s left)</span>
    `;
    try {
      const htmlText = await fetchPageHTML(`${page.path}.html`);
      const pageResults = await runAxeOnHTML(htmlText, page.path);
      aggregatedResults.push({ path: page.path, results: pageResults, htmlText });
    } catch (err) {
      console.warn(`Skipping ${page.path}: ${err.message}`);
    }
  }*/
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      statusAlert.querySelector("p").innerHTML = `
      Scanning page ${i + 1} of ${pages.length}: ${pages[i].path}
      <span class="eta-progress">(ETA: ~${
        estimatedSeconds - i * 6
      }s left)</span>
    `;
      try {
        const htmlText = await fetchPageHTML(`${page.path}.html`);
        const pageResults = await runAxeOnHTML(htmlText, page.path);

        // 🔹 Store the DOM snapshot for live view reuse
        aggregatedResults.push({
          path: page.path,
          pageTitle: document.title || "(untitled)",
          fullURL: `${window.location.origin}${page.path}.html`,
          pageAuthorPath: page.path,
          results: pageResults,
          htmlText,
        });
      } catch (err) {
        console.warn(`Skipping ${page.path}: ${err.message}`);
      }
    }
    // Combine results and display
    renderGroupedResults(aggregatedResults, resultsContainer);
    try {
      console.log("🔹 Saving aggregated results...", aggregatedResults);
      if (!aggregatedResults.length) {
        console.warn("No pages successfully scanned, skipping save.");
        statusAlert.setAttribute("variant", "warning");
        statusAlert.querySelector("p").textContent = "No results to store.";
        return;
      }
      // Normalize all results before saving
      const normalizedResults = aggregatedResults.map((page) => ({
        path: page.path.replace(/\.html$/, ""), // store without extension
        pageTitle: document.title || "(untitled)",
        fullURL: `${window.location.origin}${page.path}.html`,
        pageAuthorPath: `/editor.html${page.path}.html`,
        results: page.results || [],
        htmlText: page.htmlText || "",
      }));
      const serialized = JSON.stringify(aggregatedResults);
      const payload = {
        pages:
          aggregatedResults.map(page => {
            const issues = page.results.filter(r => r.type === "issue").length;
            const warnings = page.results.filter(r => r.type === "warning").length;
            return { pagePath: page.path, scanResult: page.results };
          })
      };
         // POST to server
      $.ajax({
        type: "POST",
        url: "/bin/a11y/scanresult",
        data: JSON.stringify(payload),
        contentType: "application/json",
        success: function (res) {
          console.log("Response:", res);
        },
        error: function (xhr, status, error) {
          console.error("AJAX Error:", xhr.status, xhr.responseText);
        }
      });
      
     /* const compressed = LZString.compressToUTF16(serialized);

      if (!compressed) {
        console.error(
          "Compression failed — storing uncompressed version instead."
        );
        localStorage.setItem("a11y-multipage-results", serialized);
      } else {
        localStorage.setItem("a11y-multipage-results", compressed);
      }

      console.log("Stored in localStorage:", {
        size: serialized.length,
        key: "a11y-multipage-results",
      });

      // Optional: verify storage
      const verify = localStorage.getItem("a11y-multipage-results");
      if (verify) console.log(" localStorage write verified successfully.");
*/
      // Rebuild live cache for Live View feature
      //window.A11Y_SCAN_HTML_CACHE = aggregatedResults.reduce((acc, p) => {
      // acc[p.path] = p.htmlText;
      //return acc;
      // }, {});
      // store page HTML snapshots in in-memory cache only (not localStorage) to avoid quota issues
        
      window.A11Y_SCAN_HTML_CACHE = window.A11Y_SCAN_HTML_CACHE || {};
      aggregatedResults.forEach((p) => {
        if (p.path && p.htmlText)
          window.A11Y_SCAN_HTML_CACHE[p.path] = p.htmlText;
      });

      // await saveResultsToIndexedDB(aggregatedResults);
      // Still keep htmlText in memory for live view (not persisted)

      statusAlert.setAttribute("variant", "success");
      statusAlert.querySelector(
        "p"
      ).textContent = `Completed scanning ${pages.length} pages.`;
      renderSummaryTable(normalizedResults);
    } catch (err) {
      console.error(" Failed to save to localStorage:", err);
      createErrorDialog(
        "Storage Error",
        "Failed to store scan results. Check browser console for details."
      );
    }
    //renderSummaryView(payload);
  }
  async function fetchScanResults(parentPath) {
  const url = '/bin/a11y/scanresult?pagePath=' + encodeURIComponent(parentPath || '');
  const res = await fetch(url, { method: 'GET', credentials: 'same-origin', headers: { 'Accept': 'application/json' }});
  if (!res.ok) {
    const txt = await res.text().catch(()=> '');
    throw new Error('Fetch failed ' + res.status + ' ' + txt);
  }
  return await res.json();
}
async function initSummaryDashboard() {
  const container = document.getElementById('summary-container');
  if (!container) return;

  const parentPath = localStorage.getItem('a11y-scan-path') || '';
  try {
    // fetch results from server (returns array or { pages: [...] })
    const raw = await fetchScanResults(parentPath);
    let pages = [];

    if (Array.isArray(raw)) pages = raw;
    else if (raw && Array.isArray(raw.pages)) pages = raw.pages;
    else if (raw && raw.pages && typeof raw.pages === 'object') pages = Object.values(raw.pages);

    // keep an in-memory cache for quick lookups by openPageReport
    window.A11Y_SCAN_AGGREGATED_RESULTS = pages;

    if (!pages || pages.length === 0) {
      container.innerHTML = '<p>No scan results found. Run a multi-page scan first.</p>';
      return;
    }

    // Render into summary container
    renderSummaryTable(pages);
  } catch (err) {
    console.error('Failed to load scan results:', err);
    container.innerHTML = `<coral-alert variant="error"><coral-alert-content>Failed to load scan summary: ${err.message}</coral-alert-content></coral-alert>`;
  }
}
  /*async function renderSummaryView(payload) {
    const container = document.getElementById("summary-container");
    if (!container) return;

    // Try to load cached results from localStorage
    //const stored = LZString.decompressFromUTF16(
     // localStorage.getItem("a11y-multipage-results")
    //);
    const stored = payload;
    //const stored = await loadResultsFromIndexedDB();
    if (!stored) {
      container.innerHTML = "<p>No previous multi-page scan found.</p>";
      return;
    }

    const results = JSON.parse(stored);
    renderSummaryTable(results);
  }*/

  function categorizeIssue(ruleId, tags) {
    const tagString = (tags || []).join(" ").toLowerCase();
    if (
      /color|contrast|text-spacing|visual|font|focus-visible|target-size/.test(
        ruleId + tagString
      )
    )
      return "Design";
    if (
      /label|aria|role|keyboard|form|name|alt|heading|region/.test(
        ruleId + tagString
      )
    )
      return "Development";
    if (
      /language|title|meta|link|content|heading-order/.test(ruleId + tagString)
    )
      return "Content";
    return "Development"; // default
  }
  // ------------------- summary.js -------------------
 /* function renderSummaryTable(aggregatedResults) {
    const container = document.getElementById("summary-container");
    if (!container) return;
    container.innerHTML = "";

    if (!aggregatedResults || aggregatedResults.length === 0) {
      container.innerHTML = `
      <coral-alert variant="info">
        <coral-alert-content>No scanned pages found. Please run a scan first.</coral-alert-content>
      </coral-alert>`;
      return;
    }

    //const header = document.createElement('h2');
    //header.textContent = 'Accessibility Summary';
    //header.className = 'summary-header';
    //container.appendChild(header);

    // keep a small client-side cache of page htmlText for live view
    window.A11Y_SCAN_HTML_CACHE = window.A11Y_SCAN_HTML_CACHE || {};

    aggregatedResults.forEach((page) => {
      const issues = page.results || [];
      const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
      issues.forEach((i) => counts[i.impact || "minor"]++);

      // Author and live url
      const authorPath = `${window.location.origin}/editor.html${page.path}.html`;
      const liveUrl = `${window.location.origin}${page.path}.html`;

      // build card
      const card = document.createElement("div");
      card.className = "summary-card detailed-card";

      // header row
      const cardHeader = document.createElement("div");
      cardHeader.className = "card-header";
      cardHeader.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="page-info" style="max-width:68%">
          <p style="margin:0"><strong>Author Page:</strong> <a href="${authorPath}" target="_blank">${authorPath}</a></p>
          <p style="margin:0"><strong>Live URL:</strong> <a href="${liveUrl}" target="_blank">${liveUrl}</a></p>
        </div>
        <div style="text-align:right">
          <div style="color:var(--coral-foreground-secondary)">${issues.length} issues</div>
          <div style="width:240px;display:flex;height:10px;border-radius:6px;overflow:hidden;margin-top:8px;">
            <div title="critical" style="flex:${counts.critical};background:#a31919"></div>
            <div title="serious" style="flex:${counts.serious};background:#f0a500"></div>
            <div title="moderate" style="flex:${counts.moderate};background:#f5d04f"></div>
            <div title="minor" style="flex:${counts.minor};background:#56b36a"></div>
          </div>
        </div>
      </div>
    `;
      card.appendChild(cardHeader);

      // body (table preview)
      const body = document.createElement("div");
      body.className = "card-body";
      body.style.marginTop = "12px";

      const table = document.createElement("table");
      table.className = "issue-table";
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";
      const thead = document.createElement("thead");
      thead.innerHTML = `<tr><th style="text-align:left;padding:8px">Rule</th><th style="text-align:left;padding:8px">Description</th><th style="text-align:left;padding:8px">Impact</th><th style="text-align:center;padding:8px">Occurrences</th></tr>`;
      table.appendChild(thead);
      const tbody = document.createElement("tbody");

      issues.slice(0, 5).forEach((v) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
        <td style="padding:8px;border-top:1px solid #eee">${v.id || "—"}</td>
        <td style="padding:8px;border-top:1px solid #eee">${(
          v.help ||
          v.description ||
          ""
        ).substring(0, 120)}</td>
        <td style="padding:8px;border-top:1px solid #eee;color:var(--coral-foreground-secondary)">${
          v.impact || "—"
        }</td>
        <td style="padding:8px;border-top:1px solid #eee;text-align:center">${
          v.nodes ? v.nodes.length : 0
        }</td>
      `;
        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      body.appendChild(table);
      card.appendChild(body);

      // footer actions
      const footer = document.createElement("div");
      footer.className = "card-footer";
      footer.style.display = "flex";
      footer.style.gap = "8px";
      footer.style.justifyContent = "flex-end";
      footer.style.marginTop = "12px";

      const pageReportBtn = document.createElement("button");
      pageReportBtn.setAttribute("is", "coral-button");
      pageReportBtn.className = "btn-card view-report";
      pageReportBtn.dataset.path = page.path;
      pageReportBtn.innerHTML = `<coral-icon icon="document" size="S"></coral-icon><coral-button-label>Page Report</coral-button-label>`;
      footer.appendChild(pageReportBtn);

      const fixBtn = document.createElement("button");
      fixBtn.setAttribute("is", "coral-button");
      fixBtn.className = "btn-card fix-suggestion";
      fixBtn.dataset.path = page.path;
      fixBtn.innerHTML = `<coral-icon icon="lightbulb" size="S"></coral-icon><coral-button-label>Fix Suggestion</coral-button-label>`;
      footer.appendChild(fixBtn);

      const aiBtn = document.createElement("button");
      aiBtn.setAttribute("is", "coral-button");
      aiBtn.className = "btn-card ai-remediate";
      aiBtn.dataset.path = page.path;
      aiBtn.innerHTML = `<coral-icon icon="sparkle" size="S"></coral-icon><coral-button-label>AI Remediate</coral-button-label>`;
      footer.appendChild(aiBtn);

      card.appendChild(footer);
      container.appendChild(card);

      // store html cache for live view
      if (page.htmlText) {
        window.A11Y_SCAN_HTML_CACHE[page.path] = page.htmlText;
      }
    });

    // Attach actions via event delegation (ensures binding once)
    container.addEventListener("click", (ev) => {
      const view = ev.target.closest(".view-report");
      if (view) {
        ev.preventDefault();
        const p = view.dataset.path;
        openPageReport(p);
        return;
      }
      const fix = ev.target.closest(".fix-suggestion");
      if (fix) {
        ev.preventDefault();
        const p = fix.dataset.path;
        openFixSuggestionDialog(p);
        return;
      }
      const ai = ev.target.closest(".ai-remediate");
      if (ai) {
        ev.preventDefault();
        runAIRemediate(ai.dataset.path);
        return;
      }
    });
  }
*/
function renderSummaryTable(pagesOrObject) {
  // Accept either an array or an object that contains `pages`
  let pages = pagesOrObject;
  if (!Array.isArray(pages) && pages && Array.isArray(pages.pages)) {
    pages = pages.pages;
  }
  if (!Array.isArray(pages)) {
    // nothing sensible to render
    const container = document.getElementById('summary-container');
    if (container) {
      container.innerHTML = `
        <coral-alert variant="info">
          <coral-alert-content>No scanned pages found. Please run a scan first.</coral-alert-content>
        </coral-alert>`;
    }
    return;
  }

  const container = document.getElementById('summary-container');
  if (!container) return;
  container.innerHTML = '';

  // ensure in-memory cache exists (keep it consistent)
  window.A11Y_SCAN_HTML_CACHE = window.A11Y_SCAN_HTML_CACHE || {};
  window.A11Y_SCAN_AGGREGATED_RESULTS = pages;

  pages.forEach((page) => {
    const issues = page.results || [];
    const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    issues.forEach((i) => counts[i.impact || 'minor']++);

    const authorPath = `${window.location.origin}/editor.html${page.path}.html`;
    const liveUrl = `${window.location.origin}${page.path}.html`;

    const card = document.createElement('div');
    card.className = 'summary-card detailed-card';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';
    cardHeader.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="page-info" style="max-width:68%">
          <p style="margin:0"><strong>Author Page:</strong> <a href="${authorPath}" target="_blank">${authorPath}</a></p>
          <p style="margin:0"><strong>Live URL:</strong> <a href="${liveUrl}" target="_blank">${liveUrl}</a></p>
        </div>
        <div style="text-align:right">
          <div style="color:var(--coral-foreground-secondary)">${issues.length} issues</div>
          <div style="width:240px;display:flex;height:10px;border-radius:6px;overflow:hidden;margin-top:8px;">
            <div title="critical" style="flex:${counts.critical};background:#a31919"></div>
            <div title="serious" style="flex:${counts.serious};background:#f0a500"></div>
            <div title="moderate" style="flex:${counts.moderate};background:#f5d04f"></div>
            <div title="minor" style="flex:${counts.minor};background:#56b36a"></div>
          </div>
        </div>
      </div>
    `;
    card.appendChild(cardHeader);

    const body = document.createElement('div');
    body.className = 'card-body';
    body.style.marginTop = '12px';

    const table = document.createElement('table');
    table.className = 'issue-table';
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th style="text-align:left;padding:8px">Rule</th><th style="text-align:left;padding:8px">Description</th><th style="text-align:left;padding:8px">Impact</th><th style="text-align:center;padding:8px">Occurrences</th></tr>`;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');

    issues.slice(0, 5).forEach((v) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:8px;border-top:1px solid #eee">${v.id || '—'}</td>
        <td style="padding:8px;border-top:1px solid #eee">${(v.help || v.description || '').substring(0,120)}</td>
        <td style="padding:8px;border-top:1px solid #eee;color:var(--coral-foreground-secondary)">${v.impact || '—'}</td>
        <td style="padding:8px;border-top:1px solid #eee;text-align:center">${v.nodes ? v.nodes.length : 0}</td>
      `;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    body.appendChild(table);
    card.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'card-footer';
    footer.style.display = 'flex';
    footer.style.gap = '8px';
    footer.style.justifyContent = 'flex-end';
    footer.style.marginTop = '12px';

    const pageReportBtn = document.createElement('button');
    pageReportBtn.setAttribute('is', 'coral-button');
    pageReportBtn.className = 'btn-card view-report';
    pageReportBtn.dataset.path = page.path;
    pageReportBtn.innerHTML = `<coral-icon icon="document" size="S"></coral-icon><coral-button-label>Page Report</coral-button-label>`;
    footer.appendChild(pageReportBtn);

    const fixBtn = document.createElement('button');
    fixBtn.setAttribute('is', 'coral-button');
    fixBtn.className = 'btn-card fix-suggestion';
    fixBtn.dataset.path = page.path;
    fixBtn.innerHTML = `<coral-icon icon="lightbulb" size="S"></coral-icon><coral-button-label>Fix Suggestion</coral-button-label>`;
    footer.appendChild(fixBtn);

    const aiBtn = document.createElement('button');
    aiBtn.setAttribute('is', 'coral-button');
    aiBtn.className = 'btn-card ai-remediate';
    aiBtn.dataset.path = page.path;
    aiBtn.innerHTML = `<coral-icon icon="sparkle" size="S"></coral-icon><coral-button-label>AI Remediate</coral-button-label>`;
    footer.appendChild(aiBtn);

    card.appendChild(footer);
    container.appendChild(card);

    if (page.htmlText) {
      window.A11Y_SCAN_HTML_CACHE = window.A11Y_SCAN_HTML_CACHE || {};
      window.A11Y_SCAN_HTML_CACHE[page.path] = page.htmlText;
    }
  });

  // single delegation handler on container (works for all cards)
  container.addEventListener('click', (ev) => {
    const view = ev.target.closest('.view-report');
    if (view) {
      ev.preventDefault();
      const p = view.dataset.path;
      openPageReport(p);
      return;
    }
    const fix = ev.target.closest('.fix-suggestion');
    if (fix) {
      ev.preventDefault();
      const p = fix.dataset.path;
      openFixSuggestionDialog(p);
      return;
    }
    const ai = ev.target.closest('.ai-remediate');
    if (ai) {
      ev.preventDefault();
      runAIRemediate(ai.dataset.path);
      return;
    }
  });
}
  function openFixSuggestionDialog(path) {
  const parentPath = localStorage.getItem('a11y-scan-path') || '';
  const normalizedPath = (path || '').replace(/\.html$/, '');

  $.ajax({
    type: 'GET',
    url: '/bin/a11y/scanresult',
    data: { pagePath: parentPath },
    dataType: 'json',
    success: function(body) {
      // normalize response shape
      let pages = Array.isArray(body) ? body : (Array.isArray(body.pages) ? body.pages : []);
      if (!pages.length && body && typeof body.pages === 'object' && !Array.isArray(body.pages)) {
        pages = Object.values(body.pages);
      }

      if (!pages || pages.length === 0) {
        const dlg = new Coral.Dialog().set({
          variant: 'info',
          header: { innerHTML: 'No Scan Data' },
          content: { innerHTML: 'No scan results were returned from the server.' },
          footer: { innerHTML: '<button is="coral-button" coral-close>OK</button>' },
          closable: true
        });
        document.body.appendChild(dlg);
        dlg.show();
        dlg.on('coral-overlay:close', () => dlg.remove());
        return;
      }

      const page = pages.find(p => ((p.path || '').replace(/\.html$/,'') === normalizedPath) || (p.path === path));
      if (!page) {
        console.warn('Page data not found for:', normalizedPath, pages.map(p => p.path));
        return alert('Page data not found. Try re-scanning the path or check server results.');
      }

      const suggestions = (page.results || []).map(function(r) {
        return `
          <li>
            <strong>${escapeHtml(r.id || '—')}</strong>: ${escapeHtml(r.help || r.description || '')}<br>
            <em>Impact:</em> ${escapeHtml(r.impact || 'N/A')} — 
            <em>WCAG:</em> ${escapeHtml(getWcagLabels(r.tags, r.id) || '—')}
          </li>
        `;
      }).join('');

      const dialog = new Coral.Dialog().set({
        variant: 'info',
        header: { innerHTML: `Fix Suggestions for ${escapeHtml(normalizedPath)}` },
        content: { innerHTML: `<ul class="fix-list" style="padding-left:16px;">${suggestions || '<li>No issues found for this page.</li>'}</ul>` },
        footer: { innerHTML: '<button is="coral-button" coral-close>Close</button>' },
        closable: true
      });
      document.body.appendChild(dialog);
      dialog.show();
      dialog.on('coral-overlay:close', () => dialog.remove());
    },
    error: function(xhr, status, err) {
      console.error('AJAX Error fetching scanresult:', status, err, xhr && xhr.responseText);
      const dlg = new Coral.Dialog().set({
        variant: 'error',
        header: { innerHTML: 'Error' },
        content: { innerHTML: 'Failed to fetch fix suggestions from server.' },
        footer: { innerHTML: '<button is="coral-button" coral-close>Close</button>' },
        closable: true
      });
      document.body.appendChild(dlg);
      dlg.show();
      dlg.on('coral-overlay:close', () => dlg.remove());
    }
  });

  // small helper to escape HTML (to avoid XSS in dialog)
  function escapeHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
}


  // ----------------- BEGIN: helpers to add -----------------
  /**
   * Clean AEM tokenized HTML like <tok-attr> / <tok-tag> so we show real HTML.
   * This is intentionally conservative: remove token wrappers but keep attributes/text.
   */
  // ------------------ improved cleanTokHtml (replace previous) ------------------
  function cleanTokHtml(s) {
    if (!s) return "";
    let out = String(s);

    // 1) remove any opening/closing tok-* elements with attributes:
    //    <tok-attr ...>  or  </tok-attr ...>  etc.
    out = out.replace(/<\/?tok-[a-z0-9-]+(?:\s[^>]*)?>/gi, "");

    // 2) remove stray token keywords that sometimes remain embedded
    out = out.replace(/\b(tok-attr|tok-tag|tok-value|tok-text)\b/gi, "");

    // 3) remove leftover quotes or sequences produced by the tokenization that break tags:
    //    e.g. '">html tok-attr">'  -> remove spurious '">' sequences between tags
    out = out.replace(/"\s*>/g, ">").replace(/>\s*"/g, ">");

    // 4) collapse repeated whitespace introduced by removals
    out = out.replace(/\s{2,}/g, " ");

    // 5) tidy spaces inside angle-brackets: "< html" => "<html" and "head >" => "head>"
    out = out.replace(/<\s+/g, "<").replace(/\s+>/g, ">");

    return out;
  }

  /** Normalize snippet for matching (strip tags, collapse whitespace) */
  function normalizeForSearch(sn) {
    if (!sn) return "";
    // remove tags, collapse whitespace, convert to lower-case
    return sn
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  /**
   * Find a good line index in the code viewer content lines for a snippet.
   * Returns zero-based line index or -1.
   */
/**
 * Robust line finder: accepts either an array of strings (raw lines)
 * or an array of DOM nodes (where dataset.raw may be present).
 * Tries multiple strategies: exact normalized line, selector token,
 * sliding-window across N lines, tag-name fallback.
 *
 * Returns zero-based line index or -1 if not found.
 */
// --------- Replace existing findLineIndexBySnippet with this ----------
function findLineIndexBySnippet(lines, nodeSnippet) {
  if (!lines || !lines.length || !nodeSnippet) return -1;

  // Helper: normalize for robust matching
  function norm(s) {
    return normalizeForSearch(String(s || "")).slice(0, 400); // keep enough context
  }

  const token = norm(nodeSnippet);
  // 1) Try normalized token match (best)
  if (token) {
    for (let i = 0; i < lines.length; i++) {
      let hay = "";
      try {
        if (typeof lines[i] === "object") {
          // if we encoded raw in data-raw, decode it (renderHtmlViewer uses encodeURIComponent)
          if (lines[i].dataset && lines[i].dataset.raw) {
            hay = decodeURIComponent(lines[i].dataset.raw || "");
          } else {
            hay = (lines[i].textContent || lines[i].innerText || "").toString();
          }
        } else if (typeof lines[i] === "string") {
          hay = lines[i];
        } else {
          hay = String(lines[i] || "");
        }
      } catch (e) {
        hay = String(lines[i] || "");
      }

      if (!hay) continue;
      const hayNorm = norm(hay);
      if (hayNorm && hayNorm.indexOf(token) !== -1) return i;
    }
  }

  // 2) Try tag-name heuristic: extract first tag from snippet and search for "<tag"
  const tagMatch = (nodeSnippet || "").match(/<\s*([a-z0-9-]+)/i);
  if (tagMatch) {
    const tag = tagMatch[1].toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      let hay = "";
      try {
        if (typeof lines[i] === "object") {
          if (lines[i].dataset && lines[i].dataset.raw) {
            hay = decodeURIComponent(lines[i].dataset.raw || "");
          } else {
            hay = (lines[i].textContent || lines[i].innerText || "").toString();
          }
        } else if (typeof lines[i] === "string") {
          hay = lines[i];
        } else {
          hay = String(lines[i] || "");
        }
      } catch (e) {
        hay = String(lines[i] || "");
      }
      if (hay.toLowerCase().includes("<" + tag)) return i;
      // also match bare tag start without "<" in malformed lines
      if (hay.toLowerCase().includes(tag)) return i;
    }
  }

  // 3) Last attempt: try a shorter token (first 60 chars) to increase chance
  const shortToken = normalizeForSearch(nodeSnippet).slice(0, 60);
  if (shortToken) {
    for (let i = 0; i < lines.length; i++) {
      const hay = (typeof lines[i] === "string") ? lines[i] : (lines[i].textContent || lines[i].innerText || "");
      if (!hay) continue;
      if (hay.toLowerCase().includes(shortToken)) return i;
    }
  }

  // Not found
  return -1;
}
// ---------------------------------------------------------------------



  // ----------------- END: helpers -----------------
 async function openPageReport(path) {
  // normalize path (no .html)
  const normalizedPath = path ? path.replace(/\.html$/, '') : path;
  // try cache
  const cache = window.A11Y_SCAN_AGGREGATED_RESULTS || null;
  let page = null;
  if (Array.isArray(cache)) {
    page = cache.find(p => (p.path || '') === normalizedPath || (p.path || '') === path);
  }

  // fallback: fetch fresh results from server and find page
  if (!page) {
    try {
      const parentPath = localStorage.getItem('a11y-scan-path') || '';
      const raw = await fetchScanResults(parentPath);
      let pages = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.pages) ? raw.pages : []);
      window.A11Y_SCAN_AGGREGATED_RESULTS = pages;
      page = pages.find(p => (p.path || '') === normalizedPath || (p.path || '') === path);
    } catch (err) {
      console.error('Unable to fetch page data for report:', err);
      const dlg = new Coral.Dialog().set({
        variant: 'error',
        header: { innerHTML: 'Page Data Error' },
        content: { innerHTML: 'Could not load page report data from server.' },
        footer: { innerHTML: '<button is="coral-button" coral-close>OK</button>' },
      });
      document.body.appendChild(dlg);
      dlg.show();
      dlg.on('coral-overlay:close', () => dlg.remove());
      return;
    }
  }

  if (!page) {
    const dlg = new Coral.Dialog().set({
      variant: 'error',
      header: { innerHTML: 'Page Not Found' },
      content: { innerHTML: 'Selected page not found in scan results. Try re-scanning.' },
      footer: { innerHTML: '<button is="coral-button" coral-close>OK</button>' },
    });
    document.body.appendChild(dlg);
    dlg.show();
    dlg.on('coral-overlay:close', () => dlg.remove());
    return;
  }

    // Remove any old modal DOM to avoid stale listeners
    const old = document.getElementById("page-report-dialog");
    if (old) old.remove();

    // Build Coral.Dialog via API for consistent initialization
    const dialog = new Coral.Dialog().set({
      id: "page-report-dialog",
      header: { innerHTML: `Page Report: ${path}` },
      content: {
        innerHTML: `
        <div class="page-report-container" style="display:flex;">
          <div class="page-report-sidebar" role="navigation" aria-label="Issues list">
            <div style="display:flex;flex-direction:column;gap:14px">
              <button is="coral-button" variant="default" id="ai-remediate-btn">AI Remediate</button>
              <div id="ai-fix-container" style="display:none"></div>
              <div id="issue-list" style="margin-top:8px"></div>
            </div>
          </div>
          <div class="page-report-main" role="main">
            <div class="report-toolbar" aria-hidden="false">
              <div class="report-tab active" data-tab="html" id="rp-tab-html">HTML View</div>
              <div class="report-tab" data-tab="live" id="rp-tab-live">Live View</div>
            </div>
            <div id="view-area" style="flex:1;overflow:auto;">
              <div id="rp-html-container" style="display:block;height:100%"></div>
              <iframe id="rp-live-iframe" style="display:none;width:100%;height:100%;border:none" sandbox="allow-same-origin allow-scripts allow-forms"></iframe>
            </div>
          </div>
        </div>
      `,
      },
      footer: {
        innerHTML: `<div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button is="coral-button" variant="quiet" id="rp-prev">Previous</button>
                    <button is="coral-button" variant="primary" id="rp-next">Next</button>
                    <button is="coral-button" variant="quiet" coral-close>Close</button>
                  </div>`,
      },
      closable: true,
    });

    // mark dialog for CSS
    dialog.classList.add("a11y-report-modal");

    document.body.appendChild(dialog);
    Coral.commons.ready(dialog, () => dialog.show());

    // Scoped references
    const sidebar = dialog.querySelector("#issue-list");
    const aiFixContainer = dialog.querySelector("#ai-fix-container");
    const htmlContainer = dialog.querySelector("#rp-html-container");
    const liveFrame = dialog.querySelector("#rp-live-iframe");
    const tabHtml = dialog.querySelector("#rp-tab-html");
    const tabLive = dialog.querySelector("#rp-tab-live");
    const prevBtn = dialog.querySelector("#rp-prev");
    const nextBtn = dialog.querySelector("#rp-next");

    // Utility: escape and light highlight
    function escapeHtml(s) {
      return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
    function simpleHighlight(html) {
      return escapeHtml(html || "");
    }
    // --- Add this helper in openPageReport scope (after `const sidebar = ...`) ---
    function markSidebarActive(index) {
      const rows = Array.from(sidebar.querySelectorAll(".issue-row"));
      rows.forEach((r, i) => {
        const isActive = i === index;
        r.classList.toggle("issue-active", isActive);
        r.classList.toggle("expanded", isActive);
        r.classList.toggle("collapsed", !isActive);

        const toggle = r.querySelector(".issue-toggle");
        if (toggle)
          toggle.setAttribute("aria-expanded", isActive ? "true" : "false");

        const occ = r.querySelector(".occurrence-list");
        if (occ) occ.style.display = isActive ? "block" : "none";

        if (isActive) {
          r.setAttribute("aria-current", "true");
          r.setAttribute("tabindex", "-1");
          // make sure visible
          r.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          r.removeAttribute("aria-current");
          r.removeAttribute("tabindex");
        }
      });
    }

    // Render HTML viewer inside the htmlContainer (gutter + content)
    // Render HTML viewer inside the htmlContainer (gutter + content)
// === Patch A === renderHtmlViewer: make displayLines match rawLines
function renderHtmlViewer(fullHtml) {
  htmlContainer.innerHTML = "";
  const cleaned = cleanTokHtml(fullHtml || "");
  // keep pretty & display derived from same source
  const pretty = cleaned.replace(/></g, ">\n<");
  const safe = simpleHighlight(pretty);

  const rawLines = pretty.split(/\r?\n/);
  const displayLines = safe.split(/\r?\n/);

  // build DOM the same way you already do — use rawLines for data-raw
  const wrap = document.createElement("div");
  wrap.className = "code-wrap"; /* ...existing style setup... */

  const gutter = document.createElement("div");
  gutter.className = "code-gutter";
  gutter.innerHTML = rawLines.map((_, i) => `<div class="gutter-line">${i+1}</div>`).join('');

  const content = document.createElement("div");
  content.className = "code-content";
  content.innerHTML = displayLines.map((l,i) => {
    const raw = rawLines[i] || '';
    const dataRaw = encodeURIComponent(raw);
    return `<div class="code-line" data-raw="${dataRaw}">${l || '&nbsp;'}</div>`;
  }).join('');

  wrap.appendChild(gutter);
  wrap.appendChild(content);
  htmlContainer.appendChild(wrap);

  content.addEventListener('scroll', () => { gutter.scrollTop = content.scrollTop; });

  content.addEventListener('click', (e) => {
    const ln = e.target.closest('.code-line'); if (!ln) return;
    content.querySelectorAll('.line-highlight').forEach(n => n.classList.remove('line-highlight'));
    ln.classList.add('line-highlight');
    ln.scrollIntoView({ behavior:'smooth', block:'center' });
  });

  htmlContainer._rawLines = rawLines;     // IMPORTANT: expose raw string lines
  htmlContainer._lines = Array.from(content.querySelectorAll('.code-line'));
  htmlContainer._gutter = Array.from(gutter.querySelectorAll('.gutter-line'));
}

// === Patch B === safe selector resolution & highlight injection
function resolveElementFromSelector(doc, selector) {
  if (!selector) return null;
  let sel = selector.toString().trim().replace(/^["']|["']$/g, "");
  try {
    const el = doc.querySelector(sel);
    if (el) return el;
  } catch (e) {}
  try {
    if (window.CSS && CSS.escape) {
      const tokens = sel.split(/\s+/).map(t => CSS.escape(t)).join(' ');
      const el = doc.querySelector(tokens);
      if (el) return el;
    }
  } catch (e) {}
  try {
    const simple = sel.replace(/\[.*?\]/g, '').replace(/["']/g, '').trim();
    if (simple) {
      const el = doc.querySelector(simple);
      if (el) return el;
    }
  } catch (e) {}
  return null;
}

function ensureHighlightStyle(doc) {
  if (doc._a11yHighlightInjected) return;
  const s = doc.createElement('style');
  s.textContent = `.a11y-found{ outline:4px solid #ff9800 !important; box-shadow:0 0 0 6px rgba(255,152,0,0.25) !important; z-index:9999999 !important; }`;
  doc.head.appendChild(s);
  doc._a11yHighlightInjected = true;
}


    // Build sidebar issue list (fast)
    const issues = page.results || [];
    sidebar.innerHTML = "";
    const frag = document.createDocumentFragment();
    issues.forEach((issue, idx) => {
      const item = document.createElement("div");
      item.className = "issue-row  collapsed";
      item.dataset.index = idx;
      item.style.padding = "0";
      item.style.borderBottom = "1px dashed #eee";

      const header = document.createElement("div");
      header.className = "issue-header";
      header.style.display = "flex";
      header.flexDirection = "row";
      header.style.justifyContent = "space-between";
      header.style.alignItems = "flex-start";
      header.style.gap = "8px";
      const titleWrapper = document.createElement("div");
      titleWrapper.style.flex = "1";
      titleWrapper.innerHTML = `
      <div class="issue-title ibm-plex-mono-thin " style="font-weight:700">${escapeHtml(
        issue.id || "—"
      )}</div>
      <div class="issue-desc" style="color:#666;margin-top:6px">${escapeHtml(
        (issue.help || issue.description || "").substring(0, 150)
      )}</div>
    `;
      header.appendChild(titleWrapper);
      const toggle = document.createElement("button");
      toggle.className = "issue-toggle";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", `occ-list-${idx}`);
      toggle.setAttribute("title", "Expand / Collapse occurrences");
      toggle.style.border = "none";
      toggle.style.background = "transparent";
      toggle.style.cursor = "pointer";
      toggle.style.padding = "6px";
      toggle.innerHTML = `<span class="toggle-icon"><svg focusable={false} role="presentation" height="12" width="12" viewBox="0 0 20 20" className="icon arrow"><path d="M12.02 6.121L19.8 13.9l-2.121 2.122L9.9 8.244l-7.778 7.778L0 13.899 9.9 4l2.12 2.121z" /></svg></span>`;
      // make it keyboard focusable
      toggle.setAttribute("tabindex", "0");

      header.appendChild(toggle);
      item.appendChild(header);

      const occList = document.createElement("div");
      occList.className = "occurrence-list";
      occList.style.marginTop = "8px";

      const nodes =
        issue.nodes && issue.nodes.length
          ? issue.nodes
          : [{ html: "", target: [] }];
      nodes.forEach((node, occIndex) => {
        const occ = document.createElement("div");
        occ.className = "occurrence-row";
        occ.style.display = "flex";
        occ.style.flexDirection = "column";
        occ.style.alignItems = "center";
        occ.style.justifyContent = "space-between";
        occ.style.padding = "0";

        const preview = (node.html || (node.target && node.target[0]) || "")
          .toString()
          .slice(0, 80);
        occ.innerHTML = `
      <div class="issue-detail" style="display:flex;align-items:center;gap:12px;">
        <div class="issue-desc" style="font-size:13px;color:#444">${escapeHtml(
          preview
        )}</div>
         <div class="issue-count" style="width:36px;height:28px;border-radius:4px;background:#f3f3f3;color:#333;display:flex;align-items:center;justify-content:center;font-weight:700">${
           occIndex + 1
         }</div>
      </div>
      <div class="issue-options" style="display:flex;gap:8px">
        <button is="coral-button" variant="quiet" class="rp-occ-btn" data-issue="${idx}" data-occ="${occIndex}" data-action="html">View HTML</button>
        <button is="coral-button" variant="quiet" class="rp-occ-btn" data-issue="${idx}" data-occ="${occIndex}" data-action="live">Live</button>
      </div>`;
        occList.appendChild(occ);
      });

      item.appendChild(occList);
      frag.appendChild(item);
    });
    // append the fragment to the sidebar
    sidebar.appendChild(frag);

    // give Coral a tiny moment to upgrade the programmatic buttons
    Coral.commons.ready(dialog, () => {
      setTimeout(() => {
        Array.from(dialog.querySelectorAll('[is="coral-button"]')).forEach(
          (b) => {
            // no-op; just helps with timing in slow environments
          }
        );
      }, 30);
    });

    // lazy HTML content: get cached snapshot if present else page.htmlText
    // get raw snapshot then clean tok-* markers
    const cached =
      window.A11Y_SCAN_HTML_CACHE &&
      window.A11Y_SCAN_HTML_CACHE[path.replace(/\.html$/, "")];
    const rawHtmlSnapshot = cached || page.htmlText || "";
    // when snapshot came from rendered DOM you don't need cleanTokHtml; but safe to call it
    const htmlSnapshot = rawHtmlSnapshot || "";

    // initial render of full HTML (but if very large this is still fast because only building strings)
    renderHtmlViewer(htmlSnapshot);

    // Tab behavior (scoped)
    function switchToHtml() {
      tabHtml.classList.add("active");
      tabLive.classList.remove("active");
      htmlContainer.style.display = "block";
      liveFrame.style.display = "none";
    }
    // inside openPageReport / renderHtmlViewer area where you switch to live:
    function switchToLive() {
      tabLive.classList.add("active");
      tabHtml.classList.remove("active");
      htmlContainer.style.display = "none";
      liveFrame.style.display = "block";

      // Prefer to load the real page so CSS/JS/clientlibs resolve normally
      if (path) {
        liveFrame.removeAttribute("srcdoc"); // clear previous fallback
        liveFrame.src = `${window.location.origin}${path}.html`;
        // ensure sandbox allows scripts + same-origin (you already set it)
      } else if (htmlSnapshot) {
        // fallback: add a base href so relative URLs fix up
        liveFrame.srcdoc =
          `<base href="${window.location.origin}">` + htmlSnapshot;
      }
    }

    tabHtml.addEventListener("click", switchToHtml);
    tabLive.addEventListener("click", () => {
      switchToLive();
    });

    // Sidebar delegated click handlers
    // delegated handler for occurrence buttons
    // ---------- Replace existing sidebar click handler with this ----------
sidebar.addEventListener('click', (ev) => {
  // 1) If user clicked a "View HTML" / "Live" button -> handle that first
  const occBtn = ev.target.closest('.rp-occ-btn');
  if (occBtn) {
    ev.preventDefault();
    const issueIdx = Number(occBtn.getAttribute('data-issue'));
    const occIdx = Number(occBtn.getAttribute('data-occ'));
    const action = occBtn.getAttribute('data-action');

    // Mark the sidebar row active/expanded for this issue
    markSidebarActive(issueIdx);
    const row = sidebar.querySelector(`.issue-row[data-index="${issueIdx}"]`);
    if (row && row.classList.contains('collapsed')) {
      // expand visual state if currently collapsed
      row.classList.remove('collapsed');
      row.classList.add('expanded');
      const toggle = row.querySelector('.issue-toggle');
      if (toggle) {
        toggle.setAttribute('aria-expanded', 'true');
        const icon = toggle.querySelector('.toggle-icon'); if (icon) icon.innerHTML = '<svg focusable={false} role="presentation" height="12" width="12" viewBox="0 0 20 20" className="icon arrow"><path d="M12.02 6.121L19.8 13.9l-2.121 2.122L9.9 8.244l-7.778 7.778L0 13.899 9.9 4l2.12 2.121z" /></svg>';
      }
      const occ = row.querySelector('.occurrence-list');
      if (occ) occ.style.display = 'block';
    }

    const issue = issues[issueIdx];
    const node = issue && issue.nodes && issue.nodes[occIdx];

    if (action === 'html') {
      // Show HTML tab and attempt to highlight the snippet
      switchToHtml();
      setTimeout(() => {
        const linesDom = htmlContainer._lines || [];
        const rawLines = htmlContainer._rawLines || [];
        // only bail if both are missing
        if (!linesDom.length && !rawLines.length) return;

        const snippet = (node && (node.liveHTML || node.html)) || '';
        // try raw-lines first (strings), then DOM nodes
        let found = -1;
        if (rawLines && rawLines.length) found = findLineIndexBySnippet(rawLines, snippet);
        if (found < 0 && linesDom && linesDom.length) found = findLineIndexBySnippet(linesDom, snippet);

        if (found >= 0) {
          // if we found by raw-lines we need the corresponding DOM node to highlight
          const targetDom = linesDom[found] || linesDom[0];
          linesDom.forEach(n => n.classList.remove('line-highlight'));
          if (targetDom) {
            targetDom.classList.add('line-highlight');
            targetDom.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // sync gutter highlight (optional)
            if (htmlContainer._gutter && htmlContainer._gutter[found]) {
              htmlContainer._gutter.forEach(g => g.classList.remove('gutter-highlight'));
              htmlContainer._gutter[found].classList.add('gutter-highlight');
            }
          }
              } else {
        // fallback: highlight the first non-empty visible line (better than always top)
        const pickIndex = (function () {
          if (linesDom && linesDom.length) {
            for (let i = 0; i < linesDom.length; i++) {
              const txt = (linesDom[i].textContent || linesDom[i].innerText || "").trim();
              if (txt && txt !== "&nbsp;" && txt.length > 1) return i;
            }
            return 0; // nothing non-empty, fallback to first
          }
          if (rawLines && rawLines.length) {
            for (let i = 0; i < rawLines.length; i++) {
              if ((rawLines[i] || "").trim().length > 1) return i;
            }
            return 0;
          }
          return -1;
        })();

        if (pickIndex >= 0 && linesDom[pickIndex]) {
          linesDom.forEach(n => n.classList.remove('line-highlight'));
          linesDom[pickIndex].classList.add('line-highlight');
          linesDom[pickIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (htmlContainer._gutter && htmlContainer._gutter[pickIndex]) {
            htmlContainer._gutter.forEach(g => g.classList.remove('gutter-highlight'));
            htmlContainer._gutter[pickIndex].classList.add('gutter-highlight');
          }
        }
      }

      }, 60);
      return;
    }

    if (action === 'live') {
      // Live view flow
      if (!htmlSnapshot) {
        const dlg = new Coral.Dialog().set({
          header: { innerHTML: 'Live View Unavailable' },
          content: { innerHTML: 'No cached snapshot available. Please rescan in Single Page live mode.' },
          footer: { innerHTML: '<button is="coral-button" coral-close>OK</button>' },
        });
        document.body.appendChild(dlg);
        dlg.show();
        dlg.on('coral-overlay:close', () => dlg.remove());
        return;
      }
      switchToLive();
      // use srcdoc so CSS resolves relative to origin if needed
      liveFrame.srcdoc = htmlSnapshot;
      liveFrame.onload = () => {
        try {
          const doc = liveFrame.contentDocument;
          // remove previous highlights
          Array.from(doc.querySelectorAll('[data-a11y-highlight]')).forEach(n => { n.style.outline=''; n.removeAttribute('data-a11y-highlight'); });

          // first try selector targets, then fallback to text/outerHTML search
          let didHighlight = false;
          const targets = node && node.target && node.target.length ? node.target : [];
          for (let t of targets) {
            try {
              const sel = t.toString();
              // guard querySelector with try/catch (invalid selectors possible)
              const el = doc.querySelector(sel);
              if (el) {
                el.style.outline = '3px solid #ff9800';
                el.setAttribute('data-a11y-highlight','true');
                el.scrollIntoView({ behavior:'smooth', block:'center' });
                didHighlight = true;
                break;
              }
            } catch (e) { /* ignore invalid selector and continue */ }
          }

          if (!didHighlight && node && (node.liveHTML || node.html)) {
            const token = normalizeForSearch(node.liveHTML || node.html).slice(0, 200);
            if (token) {
              const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null, false);
              let wnode;
              while ((wnode = walker.nextNode())) {
                try {
                  const txt = (wnode.textContent || '').toLowerCase();
                  if (txt.includes(token)) {
                    const el = (wnode.nodeType === 3) ? wnode.parentElement : wnode;
                    if (el) {
                      el.style.outline = '3px solid #ff9800';
                      el.setAttribute('data-a11y-highlight','true');
                      el.scrollIntoView({ behavior:'smooth', block:'center' });
                      didHighlight = true;
                      break;
                    }
                  }
                } catch (e) {}
              }
            }
          }
        } catch (e) { console.warn('Failed to highlight in liveFrame', e); }
      };
      return;
    }

    // handled the occBtn click - return to avoid fallthrough
    return;
  }

  // 2) If click was on expand/collapse toggle -> handle it
  const toggleBtn = ev.target.closest('.issue-toggle');
  if (toggleBtn) {
    ev.preventDefault();
    const row = toggleBtn.closest('.issue-row');
    const idx = Number(row && row.dataset.index || -1);
    const expanded = row.classList.toggle('expanded');
    row.classList.toggle('collapsed', !expanded);

    toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    const icon = toggleBtn.querySelector('.toggle-icon');
    if (icon) icon.innerHTML = expanded ? '<svg focusable={false} role="presentation" height="12" width="12" viewBox="0 0 20 20" className="icon arrow"><path d="M12.02 6.121L19.8 13.9l-2.121 2.122L9.9 8.244l-7.778 7.778L0 13.899 9.9 4l2.12 2.121z" /></svg>' : '<svg focusable={false} role="presentation" height="12" width="12" viewBox="0 0 20 20" className="icon arrow"><path d="M12.02 6.121L19.8 13.9l-2.121 2.122L9.9 8.244l-7.778 7.778L0 13.899 9.9 4l2.12 2.121z" /></svg>';

    const occ = row.querySelector('.occurrence-list');
    if (occ) occ.style.display = expanded ? 'block' : 'none';

    // if expanded, also mark active and focus
    if (expanded && idx >= 0) markSidebarActive(idx);
    return;
  }

  // (ignore other clicks)
});
// ---------------------------------------------------------------------


    // keyboard support: Enter / Space toggles the expand button
    sidebar.addEventListener("keydown", (ev) => {
      const targetToggle = ev.target.closest(".issue-toggle");
      if (!targetToggle) return;
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        targetToggle.click();
      }
    });

    // Prev / Next navigation: move through issues and highlight in sidebar & viewer
    let currentIndex = issues.length ? 0 : -1;
    function focusIssue(i) {
      if (i < 0 || i >= issues.length) return;
      currentIndex = i;
      const rows = Array.from(sidebar.querySelectorAll(".issue-row"));
      rows.forEach(
        (r, idx) => (r.style.background = idx === i ? "#fffef6" : "transparent")
      );
      // also simulate click on View HTML to show snippet
      // simulate click on first occurrence's View HTML (data-action="html")
      markSidebarActive(i);
      const firstOccBtn = sidebar.querySelector(
        `.rp-occ-btn[data-issue="${i}"][data-occ="0"][data-action="html"]`
      );
      if (firstOccBtn) firstOccBtn.click();
    }
    prevBtn.addEventListener("click", () => {
      if (currentIndex > 0) focusIssue(currentIndex - 1);
    });
    nextBtn.addEventListener("click", () => {
      if (currentIndex < issues.length - 1) focusIssue(currentIndex + 1);
    });

    // AI remediate mock behavior
    const aiBtn = dialog.querySelector("#ai-remediate-btn");
    aiBtn.addEventListener("click", () => {
      aiFixContainer.style.display = "block";
      aiFixContainer.innerHTML = '<coral-wait size="M" centered></coral-wait>';
      setTimeout(() => {
        aiFixContainer.innerHTML = `<div style="padding:8px">Suggested fixes: <ul><li>Ensure <code>alt</code> attributes</li><li>Add <code>main</code> landmark</li></ul></div>`;
      }, 600);
    });

    // initial focus
    if (issues.length) focusIssue(0);

    // cleanup when dialog closed
    dialog.on("coral-overlay:close", () => {
      try {
        markSidebarActive(-1);
        dialog.remove();
      } catch (e) {}
    });
  }

  // Render the HTML panel inside the provided 'main' element
  function renderHtmlViewInModal(htmlText, mainEl) {
    if (!mainEl) return;

    // ensure we clean AEM tok-* markers and then highlight
    //const cleaned = cleanTokHtml(htmlText || '');
    // const safe = simpleHighlight(cleaned || '');
    const cleaned = cleanTokHtml(htmlText || "");
    const safe = escapeHtml(cleaned || "");
    // clear target container
    mainEl.innerHTML = "";

    // toolbar (keeps minimal markup to avoid changing Coral layout)
    const toolbar = document.createElement("div");
    toolbar.className = "report-toolbar";
    toolbar.style.display = "flex";
    toolbar.style.gap = "8px";
    toolbar.style.marginBottom = "8px";

    const htmlTab = document.createElement("div");
    htmlTab.className = "report-tab active";
    htmlTab.textContent = "HTML View";
    const liveTab = document.createElement("div");
    liveTab.className = "report-tab";
    liveTab.textContent = "Live View";

    toolbar.appendChild(htmlTab);
    toolbar.appendChild(liveTab);

    // code wrap (gutter + content)
    const codeWrap = document.createElement("div");
    codeWrap.className = "code-wrap";
    codeWrap.style.display = "flex";
    codeWrap.style.gap = "12px";
    codeWrap.style.alignItems = "flex-start";

    // gutter
    const gutter = document.createElement("div");
    gutter.className = "code-gutter";
    gutter.style.userSelect = "none";
    gutter.style.paddingTop = "6px";
    gutter.style.whiteSpace = "nowrap";

    // content panel
    const content = document.createElement("div");
    content.className = "code-content";
    content.style.overflow = "auto";
    content.style.maxHeight = "66vh";
    content.style.flex = "1";
    content.style.fontFamily = '"Courier New", monospace';
    content.style.fontSize = "13px";
    content.style.lineHeight = "1.45";
    content.style.whiteSpace = "pre";

    // build lines
    const lines = safe.split(/\r?\n/);
    gutter.innerHTML = lines
      .map(
        (_, i) => `<div class="gutter-line" data-line="${i + 1}">${i + 1}</div>`
      )
      .join("");
    content.innerHTML = lines
      .map((l) => `<div class="code-line">${l || "&nbsp;"}</div>`)
      .join("");

    // assemble
    codeWrap.appendChild(gutter);
    codeWrap.appendChild(content);
    mainEl.appendChild(toolbar);
    mainEl.appendChild(codeWrap);

    // expose lines for external usage (findLineIndexBySnippet etc)
    mainEl._lines = Array.from(content.querySelectorAll(".code-line"));
    mainEl._gutter = Array.from(gutter.querySelectorAll(".gutter-line"));

    // sync scroll: when content scrolls, gutter scrolls
    content.addEventListener("scroll", () => {
      gutter.scrollTop = content.scrollTop;
    });

    // clicking a line highlights it and scrolls into view
    content.addEventListener("click", (ev) => {
      const lineEl = ev.target.closest(".code-line");
      if (!lineEl) return;
      // remove previous highlights
      content
        .querySelectorAll(".line-highlight")
        .forEach((n) => n.classList.remove("line-highlight"));
      lineEl.classList.add("line-highlight");

      // keep gutter in sync: highlight gutter number
      const idx = Array.prototype.indexOf.call(
        content.querySelectorAll(".code-line"),
        lineEl
      );
      if (idx >= 0) {
        mainEl._gutter.forEach((g) => g.classList.remove("gutter-highlight"));
        if (mainEl._gutter[idx])
          mainEl._gutter[idx].classList.add("gutter-highlight");
      }

      // scroll to center line
      lineEl.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    // simple tab toggles (HTML <-> Live)
    htmlTab.addEventListener("click", () => {
      htmlTab.classList.add("active");
      liveTab.classList.remove("active");
      codeWrap.style.display = "flex";
    });

    liveTab.addEventListener("click", () => {
      liveTab.classList.add("active");
      htmlTab.classList.remove("active");
      // switch out codeWrap and allow caller to create live view via global renderer
      if (typeof window.renderLiveInReport === "function") {
        // let consumer render a live view inside mainEl
        // consumer should hide or remove the codeWrap when rendering live view
        window.renderLiveInReport(mainEl);
      } else {
        // fallback: hide code view and show a message
        codeWrap.style.display = "none";
        const msg = document.createElement("div");
        msg.style.padding = "12px";
        msg.style.color = "#666";
        msg.innerHTML =
          "<p>Live View not available — ensure a live snapshot is provided.</p>";
        // ensure we don't duplicate message if user toggles
        const existing = mainEl.querySelector(".live-placeholder");
        if (!existing) mainEl.appendChild(msg);
        msg.className = "live-placeholder";
      }
    });

    // small initial scroll position
    content.scrollTop = 0;
  }

 async function getStoredResults(parentPath) {
  try {
    const pagePath = parentPath || localStorage.getItem('a11y-scan-path') || '';
    const url = '/bin/a11y/scanresult' + (pagePath ? '?pagePath=' + encodeURIComponent(pagePath) : '');
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      console.warn('getStoredResults: server returned', res.status);
      return null;
    }

    // Try to parse JSON safely
    let body;
    try {
      body = await res.json();
    } catch (err) {
      // fallback: try text then parse if possible
      const txt = await res.text();
      try { body = JSON.parse(txt); } catch (e) { console.warn('getStoredResults: invalid JSON response'); return null; }
    }

    // Normalize common shapes:
    //  - array of pages -> return as is
    //  - { pages: [ ... ] } -> return pages
    //  - { pages: { key: {...}, ... } } -> return Object.values(pages)
    if (Array.isArray(body)) return body;
    if (body && Array.isArray(body.pages)) return body.pages;
    if (body && typeof body.pages === 'object') return Object.values(body.pages);

    // If body itself looks like a single page object, wrap as array
    if (body && body.path && body.results) return [body];

    return null;
  } catch (err) {
    console.error('getStoredResults error:', err);
    return null;
  }
}

  async function findPageResult(path) {
    const results = await getStoredResults();
    if (!results || !Array.isArray(results)) return null;
    const normalized = path.replace(/\.html$/, "");
    return results.find(
      (p) => p.path === normalized || p.path === `${normalized}.html`
    );
  }
  async function runAIRemediate(path) {
    const dialog = new Coral.Dialog().set({
      variant: "info",
      header: { innerHTML: "AI Remediation (Preview)" },
      content: { innerHTML: `<p>Running AI suggestions for ${path}...</p>` },
      footer: {
        innerHTML: '<button is="coral-button" coral-close>Close</button>',
      },
    });
    document.body.appendChild(dialog);
    dialog.show();

    // TODO: integrate with OpenAI or internal remediation service
    setTimeout(() => {
      dialog.content.innerHTML = `
      <p>✅ AI found 3 suggested fixes:</p>
      <ul>
        <li>Add <code>alt</code> text for missing images</li>
        <li>Ensure <code>main</code> landmark exists</li>
        <li>Improve color contrast on buttons</li>
      </ul>
    `;
    }, 1500);
  }

  async function fetchChildPages(rootPath, depth = 2) {
    try {
      const response = await fetch(`${rootPath}.${depth}.json`);
      const data = await response.json();
      const pages = [];

      function walk(obj, path) {
        Object.keys(obj).forEach((key) => {
          const child = obj[key];
          if (!child || typeof child !== "object") return;

          if (child["jcr:primaryType"] === "cq:Page") {
            pages.push({ path: `${path}/${key}` });
          } else {
            walk(child, `${path}/${key}`);
          }
        });
      }

      walk(data, rootPath);
      return pages;
    } catch (e) {
      console.error("Failed to fetch child pages:", e);
      return [];
    }
  }

  async function runAxeOnHTML(htmlText, path) {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    iframe.contentDocument.open();
    iframe.contentDocument.write(htmlText);
    iframe.contentDocument.close();

    await new Promise((r) => setTimeout(r, 500));

    if (!iframe.contentWindow.axe) {
      const script = iframe.contentDocument.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js";
      iframe.contentDocument.head.appendChild(script);
      await new Promise((r) => (script.onload = r));
    }

    const results = await iframe.contentWindow.axe.run(iframe.contentDocument);
    iframe.remove();
    results.violations?.forEach((rule) => {
      rule.nodes.forEach((node) => {
        try {
          const element = iframe.contentDocument.querySelector(node.target[0]);
          if (element && element.outerHTML) node.liveHTML = element.outerHTML;
        } catch {}
      });
    });

    const violationsWithType = (results.violations || []).map((v) => ({
      ...v,
      type: "violation",
    }));
    const incompleteWithType = (results.incomplete || []).map((v) => ({
      ...v,
      type: "potential",
    }));

    return [...violationsWithType, ...incompleteWithType];
  }
  const customWcagMap = {
    "empty-heading": "WCAG 1.3.1 (A)",
    "heading-order": "WCAG 1.3.1 (A)",
    "landmark-unique": "WCAG 1.3.1 (A)",
    "landmark-one-main": "WCAG 1.3.1 (A)",
    "landmark-no-duplicate-contentinfo": "WCAG 1.3.1 (A)",
    region: "WCAG 1.3.1 (A), 2.4.1 (A)",
    "hidden-content": "WCAG 1.3.1 (A), 4.1.2 (A)",
  };

  /*function getWcagLabels(tags, ruleId = '') {
  if (customWcagMap[ruleId]) return customWcagMap[ruleId];

  if (!tags || !tags.length) return '—';
  const wcagTags = tags.filter(t => /^wcag/i.test(t));
  if (wcagTags.length > 0) {
    return wcagTags
      .map(t => t.replace(/wcag(\d*)(a{1,3})/i, 'WCAG $1 $2').toUpperCase())
      .join(', ');
  }
  if (tags.includes('best-practice')) return 'Best Practice';
  return '—';
}*/
 function getWcagLabels(tags, ruleId = "") {
  // 1. Check custom override map first
  if (ruleId && customWcagMap[ruleId]) {
    return customWcagMap[ruleId];
  }

  // 2. Try to extract and format WCAG labels from tags
  if (tags && tags.length > 0) {
    const wcagTags = tags
      .filter((t) => /^wcag/i.test(t))
      .map((t) => {
        const match = t.match(/wcag(\d*)(a{1,3})/i);
        if (match) {
          const [, version, level] = match;
          return `WCAG ${version ? version + " " : ""}${level.toUpperCase()}`;
        }
        return t.toUpperCase();
      });

    // If we found valid WCAG tags, return them as a string
    if (wcagTags.length > 0) {
      return wcagTags.join(", ");
    }
  }

  // 3. FALLBACK: If no tags matched, look up by ruleId in the axe map
  const map = window.AXE_BESTPRACTICE_WCAG_MAP || {};
  if (ruleId && map[ruleId]) {
    return map[ruleId];
  }
  // 4. FINAL FALLBACK: Default label for best practices
  return map["__FALLBACK_BEST_PRACTICE"] || "Best Practice";
}
  function renderResultsTable(
    violations,
    htmlText,
    container,
    showPagePath = false
  ) {
    const itemsPerPage = 10;
    let currentPage = 1;
    let filtered = [...violations];
    let searchTerm = "";

    // Split the HTML text into lines once for line lookups
    const htmlLines = htmlText ? htmlText.split("\n") : [];

    // === UI CONTROLS (Filter + Pagination) ===
    container.innerHTML = `
    <div class="table-controls">
      <div class="filters">
        <label>Impact:</label>
        <select id="filter-impact">
          <option value="all">All</option>
          <option value="critical">Critical</option>
          <option value="serious">Serious</option>
          <option value="moderate">Moderate</option>
          <option value="minor">Minor</option>
        </select>

        <label>WCAG:</label>
        <select id="filter-wcag">
          <option value="all">All</option>
          <option value="A">WCAG A</option>
          <option value="AA">WCAG AA</option>
          <option value="AAA">WCAG AAA</option>
          <option value="BestPractice">Best Practice</option>
        </select>

        <label>Type:</label>
        <select id="filter-type">
          <option value="all">All</option>
          <option value="violation">Confirmed</option>
          <option value="potential">Potential</option>
        </select>

        <label>Search:</label>
        <input type="text" id="filter-search" placeholder="Search by rule, WCAG or text...">
      </div>

      <div class="pagination">
        <button id="prev-page" is="coral-button" variant="quiet" icon="chevronLeft"></button>
        <span id="page-info">Page 1</span>
        <button id="next-page" is="coral-button" variant="quiet" icon="chevronRight"></button>
      </div>
    </div>

    <div id="table-wrapper"></div>
  `;

    const tableWrapper = container.querySelector("#table-wrapper");
    const impactFilter = container.querySelector("#filter-impact");
    const wcagFilter = container.querySelector("#filter-wcag");
    const typeFilter = container.querySelector("#filter-type");
    const searchFilter = container.querySelector("#filter-search");
    const prevPageBtn = container.querySelector("#prev-page");
    const nextPageBtn = container.querySelector("#next-page");
    const pageInfo = container.querySelector("#page-info");

    // === FILTER LOGIC ===
    function applyFilters() {
      filtered = violations.filter((v) => {
        const wcagTags = getWcagLabels(v.tags, v.id);
        const impactMatch =
          impactFilter.value === "all" || v.impact === impactFilter.value;
        const wcagMatch =
          wcagFilter.value === "all" ||
          wcagTags.includes(`WCAG ${wcagFilter.value}`);
        const typeMatch =
          typeFilter.value === "all" || v.type === typeFilter.value;
        const searchMatch =
          searchTerm === "" ||
          v.id.toLowerCase().includes(searchTerm) ||
          (v.description || "").toLowerCase().includes(searchTerm) ||
          wcagTags.toLowerCase().includes(searchTerm);
        return impactMatch && wcagMatch && typeMatch && searchMatch;
      });
      currentPage = 1;
      renderPage();
    }
    // helper: safe pre element
    function createSafePre(content, cssClass) {
      const pre = document.createElement("pre");
      if (cssClass) pre.className = cssClass;
      pre.textContent =
        content || "(No specific element — applies to document or context)";
      return pre;
    }

    // helper: build the table header (static)
    function createTableHeader() {
      const table = document.createElement("table");
      table.className = "results-table";
      const thead = document.createElement("thead");
      thead.innerHTML = `
      <tr>
        ${showPagePath ? "<th>Page Path</th>" : ""}
        <th>Rule</th>
        <th>Impact</th>
        <th>WCAG Level</th>
        <th>Description</th>
        <th>Line No</th>
        <th>Type</th>
        <th>Category</th>
        <th>Occurrences</th>
        <th>Actions</th>
      </tr>
    `;
      table.appendChild(thead);
      const tbody = document.createElement("tbody");
      table.appendChild(tbody);
      return { table, tbody };
    }
    // === TABLE RENDER LOGIC ===
    function renderPage() {
      const start = (currentPage - 1) * itemsPerPage;
      const pageItems = filtered.slice(start, start + itemsPerPage);
      tableWrapper.innerHTML = "";

      if (pageItems.length === 0) {
        tableWrapper.innerHTML =
          '<p style="padding:10px;">No results match your filters.</p>';
        return;
      }

      const { table, tbody } = createTableHeader();

      pageItems.forEach((v) => {
        // WCAG tags (handles missing gracefully)
        const wcagTags = getWcagLabels(v.tags, v.id) || "—";
        const occurrenceCount = (v.nodes && v.nodes.length) || 0;

        // Determine line number context
        /*  let lineNumber = '—';
        const htmlSnippet = node && node.html ? node.html : '';
        const htmlTextContent = v.htmlText || htmlText || '';
        const htmlLines = htmlTextContent.split('\n');
        const node = (v.nodes && v.nodes[0]) || null;
        const snippet = node?.html || '';
        let codeContext = '';
        
        if (snippet && htmlLines.length > 0) {
          const tagMatch = snippet.match(/<\s*([a-z0-9-]+)/i);
          const searchToken = tagMatch ? `<${tagMatch[1]}` : snippet.substring(0, 20);
          for (let i = 0; i < htmlLines.length; i++) {
            if (htmlLines[i].toLowerCase().includes(searchToken.toLowerCase())) {
              lineNumber = i + 1;
              const startLine = Math.max(0, i - 2);
              const endLine = Math.min(htmlLines.length, i + 3);
              codeContext = htmlLines.slice(startLine, endLine).join('\n');
              break;
            }
          }
        }*/
        // Node info
        const node = (v.nodes && v.nodes[0]) || null;
        const htmlSnippet = node && node.html ? node.html : "";
        let lineNumber = "—";
        let codeBlock = "";

        // Attempt to find a sensible search token (tag name or target) to locate line number
        let searchToken = "";
        if (htmlSnippet) {
          const tagMatch = htmlSnippet.match(/<\s*([a-z0-9-]+)/i);
          if (tagMatch)
            searchToken = `<${tagMatch[1]}`; // search for "<iframe" etc
          else {
            // fallback: node.target may contain selector like "iframe"
            searchToken =
              (node && node.target && node.target[0]) ||
              htmlSnippet.split(/\s+/)[0];
          }
        } else if (node && node.target && node.target[0]) {
          searchToken = node.target[0];
        }

        if (searchToken && htmlLines.length > 0) {
          for (let i = 0; i < htmlLines.length; i++) {
            if (
              htmlLines[i]
                .toLowerCase()
                .includes(searchToken.replace(/</g, "").toLowerCase())
            ) {
              lineNumber = i + 1;
              const startLine = Math.max(0, i - 2);
              const endLine = Math.min(htmlLines.length, i + 3);
              const context = htmlLines.slice(startLine, endLine);
              codeBlock = context
                .map((line, idx) => {
                  const actual = startLine + idx + 1;
                  const marker = actual === lineNumber ? "👉" : "  ";
                  return `${marker} ${actual
                    .toString()
                    .padStart(3, " ")} | ${line}`;
                })
                .join("\n");
              break;
            }
          }
        }

        // Build the row entirely via DOM (no innerHTML for dynamic values)
        const tr = document.createElement("tr");
        // Add Page Path column only in multi-page mode
        if (showPagePath) {
          const tdPath = document.createElement("td");
          tdPath.textContent = v.pagePath || "(N/A)";
          tr.appendChild(tdPath);
        }

        // Rule cell
        const tdRule = document.createElement("td");
        tdRule.textContent = v.id || "—";
        tr.appendChild(tdRule);

        // Impact cell
        const tdImpact = document.createElement("td");
        const impactSpan = document.createElement("span");
        impactSpan.className = `impact-${v.impact || "minor"}`;
        impactSpan.textContent = v.impact || "N/A";
        tdImpact.appendChild(impactSpan);
        tr.appendChild(tdImpact);

        // WCAG cell
        const tdWcag = document.createElement("td");
        const wcagSpan = document.createElement("span");
        wcagSpan.className = "wcag-tag";
        wcagSpan.textContent = wcagTags;
        tdWcag.appendChild(wcagSpan);
        tr.appendChild(tdWcag);

        // Description cell (safe)
        const tdDesc = document.createElement("td");
        tdDesc.textContent = v.description || "";
        tr.appendChild(tdDesc);

        // Line number cell
        const tdLine = document.createElement("td");
        tdLine.style.textAlign = "center";
        tdLine.textContent = lineNumber;
        tr.appendChild(tdLine);

        // Type cell (flag)
        const tdType = document.createElement("td");
        const typeSpan = document.createElement("span");
        typeSpan.className =
          v.type === "potential" ? "potential-flag" : "confirmed-flag";
        typeSpan.textContent =
          v.type === "potential" ? "⚠️ Potential" : "✔️ Confirmed";
        tdType.appendChild(typeSpan);
        tr.appendChild(tdType);
        // Category column
        const category = categorizeIssue(v.id, v.tags);
        const tdCategory = document.createElement("td");
        tdCategory.textContent = category;
        tr.appendChild(tdCategory);
        // Occurrences column
        // occurrenceCount = (v.nodes && v.nodes.length) || 0;
        const tdOccurrences = document.createElement("td");
        tdOccurrences.style.textAlign = "center";
        tdOccurrences.textContent = occurrenceCount;
        tr.appendChild(tdOccurrences);

        // CODE CELL (very important: use textContent so tags never render)
        /*const codeCell = document.createElement('td');
      const pre = createSafePre(htmlSnippet || '(No specific element — applies to document or context)');
      codeCell.appendChild(pre);

      // Add failure summary if present (safe text)
      if (node && node.failureSummary) {
        const fs = document.createElement('div');
        fs.className = 'failure-summary';
        fs.textContent = node.failureSummary;
        codeCell.appendChild(fs);
      }

      // Add collapsible context (safe text)
      if (codeBlock) {
          const viewBtn = document.createElement('button');
          viewBtn.setAttribute('is', 'coral-button');
          viewBtn.setAttribute('variant', 'quiet');
          viewBtn.textContent = 'View HTML';
          viewBtn.addEventListener('click', () => {
            showCodePopup(htmlText, lineNumber);
          });
          codeCell.appendChild(viewBtn);
        }*/
        // CODE CELL (very important: use textContent so tags never render)
        const codeCell = document.createElement("td");
        // Add "View HTML" button only if there are nodes
        if (occurrenceCount > 0) {
          const viewBtn = document.createElement("button");
          viewBtn.setAttribute("is", "coral-button");
          viewBtn.setAttribute("variant", "quiet");
          // viewBtn.innerHTML = '<img src="/apps/aem-a11yAccelerator-plugin/components/a11y-accelerator/clientlibs/view-html.svg" title="View HTML" alt="View HTML">';
          viewBtn.innerHTML =
            '<coral-icon icon="code" size="S" title="View HTML"></coral-icon>';
          viewBtn.addEventListener("click", () => {
            showOccurrencePopup(htmlText, v.nodes);
          });
          codeCell.appendChild(viewBtn);
        } else {
          codeCell.textContent = "(No HTML references)";
        }

        // 🔹 Add "Live View" button beside "View HTML"
        const liveBtn = document.createElement("button");
        liveBtn.setAttribute("is", "coral-button");
        liveBtn.setAttribute("variant", "quiet");
        //liveBtn.innerHTML = '<img src="/apps/aem-a11yAccelerator-plugin/components/a11y-accelerator/clientlibs/view-live.svg" title="Live View" alt="Live View">';
        liveBtn.innerHTML =
          '<coral-icon icon="homepage" size="S" title="Live View"></coral-icon>';
        liveBtn.addEventListener("click", () => {
          showLiveIssueHighlight(
            v.nodes,
            v.id,
            v.description,
            v.htmlText || ""
          );
        });
        codeCell.appendChild(liveBtn);
        // 🔹 Loop through each node (each occurrence of this issue)
        if (v.nodes && v.nodes.length > 0) {
          v.nodes.forEach((node, idx) => {
            const nodeSnippet = node.html
              ? node.html.replace(/</g, "&lt;").replace(/>/g, "&gt;")
              : "(No specific HTML found)";
            const nodeFailure = node.failureSummary || "";

            // Build collapsible occurrence details
            /*const occurrenceBlock = document.createElement('details');
    occurrenceBlock.classList.add('occurrence-details');
    const summary = document.createElement('summary');
    summary.textContent = `Occurrence ${idx + 1}`;
    occurrenceBlock.appendChild(summary);*/

            const pre = document.createElement("pre");
            pre.innerHTML = nodeSnippet;
            //occurrenceBlock.appendChild(pre);

            if (nodeFailure) {
              const failP = document.createElement("p");
              failP.className = "failure-summary";
              failP.textContent = nodeFailure;
              // occurrenceBlock.appendChild(failP);
            }

            //codeCell.appendChild(occurrenceBlock);
          });
        } else {
          // No node references (applies to entire document)
          const pre = document.createElement("pre");
          pre.textContent =
            "(Applies to entire document — no specific HTML element)";
          codeCell.appendChild(pre);
        }

        // Add "View HTML" button for full context (optional)
        /* if (codeBlock) {
      const viewBtn = document.createElement('button');
      viewBtn.setAttribute('is', 'coral-button');
      viewBtn.setAttribute('variant', 'quiet');
      viewBtn.textContent = 'View HTML';
      viewBtn.addEventListener('click', () => {
        showCodePopup(htmlText, lineNumber);
      });
      codeCell.appendChild(viewBtn);
    }

*/
        tr.appendChild(codeCell);
        tbody.appendChild(tr);
        //tbody.appendChild(row);
      });

      tableWrapper.appendChild(table);

      const totalPages = Math.ceil(filtered.length / itemsPerPage);
      pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
      prevPageBtn.disabled = currentPage === 1;
      nextPageBtn.disabled = currentPage === totalPages;
    }

    // === Pagination Events ===
    prevPageBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderPage();
      }
    });
    nextPageBtn.addEventListener("click", () => {
      const totalPages = Math.ceil(filtered.length / itemsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        renderPage();
      }
    });

    // === Filter Events ===
    [impactFilter, wcagFilter, typeFilter].forEach((el) =>
      el.addEventListener("change", applyFilters)
    );
    searchFilter.addEventListener("input", (e) => {
      searchTerm = e.target.value.toLowerCase().trim();
      applyFilters();
    });

    // Initial render
    renderPage();
  }

  function renderGroupedResults(aggregatedResults, container) {
    container.innerHTML = "";

    // Flatten all results and include htmlText
    const combinedResults = [];
    aggregatedResults.forEach((group) => {
      const pagePath = group.path;
      const htmlText = group.htmlText || "";
      (group.results || []).forEach((result) => {
        combinedResults.push({ ...result, pagePath, htmlText });
      });
    });

    if (combinedResults.length === 0) {
      container.innerHTML = "<p>No accessibility issues found 🎉</p>";
      return;
    }

    // Add a descriptive header
    const header = document.createElement("h3");
    header.textContent = "Accessibility Scan Results (All Pages Combined)";
    container.appendChild(header);

    // Pass `showPagePath = true` for multi-page context
    renderResultsTable(
      combinedResults,
      combinedResults[0]?.htmlText || "",
      container,
      true
    );
  }

  function normalizeAxeResults(results, iframeDoc) {
    results.violations?.forEach((rule) => {
      rule.nodes.forEach((node) => {
        try {
          const element = iframeDoc.querySelector(node.target[0]);
          if (element) node.liveHTML = element.outerHTML;
        } catch {}
      });
    });
    results.incomplete?.forEach((rule) => {
      rule.nodes.forEach((node) => {
        try {
          const element = iframeDoc.querySelector(node.target[0]);
          if (element) node.liveHTML = element.outerHTML;
        } catch {}
      });
    });

    const violationsWithType = (results.violations || []).map((v) => ({
      ...v,
      type: "violation",
    }));
    const incompleteWithType = (results.incomplete || []).map((v) => ({
      ...v,
      type: "potential",
    }));
    return [...violationsWithType, ...incompleteWithType];
  }

  function showOccurrencePopup(fullHTML, nodes) {
    const modal = document.getElementById("code-context-modal");
    const codeContent = document.getElementById("code-content");
    const navPrev = document.getElementById("occ-prev");
    const navNext = document.getElementById("occ-next");
    const occCounter = document.getElementById("occurrence-counter");

    if (!modal || !codeContent) return;

    const htmlLines = fullHTML.split("\n");
    let currentIndex = 0;

    function normalize(str) {
      return str.replace(/\s+/g, " ").trim().toLowerCase();
    }

    function renderOccurrence(index) {
      const node = nodes[index];
      if (!node) return;

      const safeSnippet = node.liveHTML
        ? node.liveHTML
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
        : node.html
        ? node.html
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
        : "(No specific HTML snippet found)";

      let highlightLine = -1;

      // Try multiple matching strategies
      const normalizedSnippet = node.html ? normalize(node.html) : "";
      for (let i = 0; i < htmlLines.length; i++) {
        if (
          (normalizedSnippet &&
            normalize(htmlLines[i]).includes(normalizedSnippet)) ||
          (node.target &&
            node.target[0] &&
            htmlLines[i].includes(node.target[0].replace(/[>"']/g, "")))
        ) {
          highlightLine = i;
          break;
        }
      }

      // If still not found, find by element type
      if (highlightLine === -1 && node.html) {
        const tagMatch = node.html.match(/<\s*([a-z0-9-]+)/i);
        if (tagMatch) {
          const tagName = tagMatch[1];
          for (let i = 0; i < htmlLines.length; i++) {
            if (htmlLines[i].includes(`<${tagName}`)) {
              highlightLine = i;
              break;
            }
          }
        }
      }

      // Render HTML lines with highlight
      const lines = htmlLines.map((line, idx) => {
        const escaped = line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const isHighlight = idx === highlightLine;
        return `<div class="${isHighlight ? "highlight-line" : ""}">
                <span class="line-num">${idx + 1}</span> ${escaped}
              </div>`;
      });

      codeContent.innerHTML = lines.join("");
      occCounter.textContent = `Occurrence ${index + 1} of ${nodes.length}`;

      if (highlightLine !== -1) {
        const highlighted = modal.querySelector(".highlight-line");
        if (highlighted)
          highlighted.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        codeContent.insertAdjacentHTML(
          "afterbegin",
          `<p style="color:#d33; font-weight:bold;">⚠ Unable to locate the exact line in HTML. Showing entire file context.</p>`
        );
      }
    }

    // Hook navigation buttons
    navPrev.onclick = () => {
      if (currentIndex > 0) {
        currentIndex--;
        renderOccurrence(currentIndex);
      }
    };

    navNext.onclick = () => {
      if (currentIndex < nodes.length - 1) {
        currentIndex++;
        renderOccurrence(currentIndex);
      }
    };

    // Initialize
    Coral.commons.ready(modal, () => modal.show());
    renderOccurrence(currentIndex);
  }

  function showLiveIssueHighlight(nodes, ruleId, description, htmlText = null) {
    let iframe = getScanIframe();

    // 🩶 If no active iframe (multi-page), use stored HTML snapshot
    if (!iframe || !iframe.contentDocument) {
      if (htmlText) {
        iframe = document.createElement("iframe");
        iframe.id = "a11y-scan-frame-temp";
        iframe.style.display = "none";
        document.body.appendChild(iframe);
        iframe.contentDocument.open();
        iframe.contentDocument.write(htmlText);
        iframe.contentDocument.close();
      } else {
        const dialog = new Coral.Dialog().set({
          header: { innerHTML: "Live View Unavailable" },
          content: {
            innerHTML: "No live page or stored HTML found. Please rescan.",
          },
          footer: {
            innerHTML:
              '<button is="coral-button" variant="primary" coral-close>OK</button>',
          },
          closable: true,
          variant: "error",
        });
        document.body.appendChild(dialog);
        dialog.show();
        dialog.on("coral-overlay:close", () => dialog.remove());
        return;
      }
    }

    const modal = document.getElementById("live-view-modal");
    const wrapper = document.getElementById("live-view-wrapper");
    if (!modal || !wrapper) return;

    // 🧱 Clear modal and add control bar
    wrapper.innerHTML = `
    <div class="a11y-live-controls" style="display:flex;justify-content:space-between;
         align-items:center;background:#f5f5f5;border-bottom:1px solid #ccc;padding:6px 10px;">
      <div id="a11y-occurrence-counter">Occurrence 1 of ${nodes.length}</div>
      <div>
        <button is="coral-button" id="a11y-prev-btn" icon="chevronLeft" variant="quiet"></button>
        <button is="coral-button" id="a11y-next-btn" icon="chevronRight" variant="quiet"></button>
      </div>
    </div>
  `;

    // 🧱 Create iframe for live rendering
    const liveContainer = document.createElement("div");
    liveContainer.style.cssText =
      "position:relative;width:100%;height:85vh;overflow:auto;background:#fff;";
    wrapper.appendChild(liveContainer);

    const liveIframe = document.createElement("iframe");
    liveIframe.id = "a11y-live-preview";
    liveIframe.style.cssText =
      "width:100%;height:100%;border:none;display:block;";
    liveIframe.srcdoc = htmlText
      ? htmlText
      : iframe.contentDocument.documentElement.outerHTML;
    liveContainer.appendChild(liveIframe);

    Coral.commons.ready(modal, () => modal.show());

    liveIframe.onload = () => {
      const doc = liveIframe.contentDocument;
      if (!doc) return;

      // 💅 Styles for highlight overlays
      const style = doc.createElement("style");
      style.textContent = `
      .a11y-highlight-overlay {
        position: absolute;
        background: rgba(255, 0, 0, 0.25);
        border: 2px solid red;
        border-radius: 4px;
        z-index: 999999;
        pointer-events: none;
        box-shadow: 0 0 5px rgba(255,0,0,0.6);
        transition: opacity .3s ease;
      }
      .a11y-tooltip {
        position: absolute;
        background: #fff;
        border: 1px solid #333;
        border-radius: 3px;
        padding: 5px 8px;
        font-size: 12px;
        color: #000;
        z-index: 1000000;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        max-width: 260px;
        pointer-events: none;
      }
    `;
      doc.head.appendChild(style);

      const overlayLayer = doc.createElement("div");
      overlayLayer.style.cssText =
        "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;";
      doc.body.appendChild(overlayLayer);

      let currentIndex = 0;

      function renderHighlight(index) {
        overlayLayer.innerHTML = "";
        const node = nodes[index];
        if (!node || !node.target || !node.target[0]) return;

        // robust element-resolution for live highlight
        let el = null;
        const selector =
          node && node.target && node.target[0] ? node.target[0] : null;

        // try 1: direct querySelector (safe try/catch)
        if (selector) {
          try {
            el = doc.querySelector(selector);
          } catch (e) {
            el = null;
          }

          // try 2: if selector contains simple tag token or attribute, try CSS.escape for the token if it looks like a single token
          if (!el) {
            try {
              // attempt to escape token if it's a bare tag name or ID/class-like token
              const token = selector.replace(/^\s*["']?|["']?\s*$/g, ""); // trim quotes
              // only attempt CSS.escape when token looks simple (avoid escaping complex selectors)
              if (/^[a-z0-9\-_:\[\]\=\"'\.\#\s]+$/i.test(token)) {
                try {
                  el = doc.querySelector(token);
                } catch (e) {}
              }
            } catch (e) {}
          }
        }

        // try 3: fallback to searching by liveHTML / text match
        if (!el && (node.liveHTML || node.html)) {
          const needle = normalizeForSearch(node.liveHTML || node.html).slice(
            0,
            200
          );
          if (needle) {
            const walker = doc.createTreeWalker(
              doc.body,
              NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
              null,
              false
            );
            let wnode;
            while ((wnode = walker.nextNode())) {
              try {
                const hay = (
                  wnode.nodeType === 3
                    ? wnode.textContent
                    : wnode.outerHTML || wnode.textContent || ""
                ).toLowerCase();
                if (hay && hay.includes(needle)) {
                  el = wnode.nodeType === 3 ? wnode.parentElement : wnode;
                  break;
                }
              } catch (e) {}
            }
          }
        }

        // now if we have el, render overlay
        if (!el) {
          // graceful: can't find exact element; display a small toast or leave overlay blank
          console.warn("Could not locate element for selector:", selector);
          return;
        }

        const rect = el.getBoundingClientRect();
        const overlay = doc.createElement("div");
        overlay.className = "a11y-highlight-overlay";
        overlay.style.left = `${rect.left + doc.defaultView.scrollX}px`;
        overlay.style.top = `${rect.top + doc.defaultView.scrollY}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;

        const tooltip = doc.createElement("div");
        tooltip.className = "a11y-tooltip";
        tooltip.innerHTML = `<strong>${ruleId}</strong><br>${description}
                           <br><em>Occurrence ${index + 1} of ${
          nodes.length
        }</em>`;
        tooltip.style.left = `${rect.left + 10}px`;
        tooltip.style.top = `${rect.bottom + 10}px`;

        overlayLayer.appendChild(overlay);
        overlayLayer.appendChild(tooltip);

        // Auto-scroll to highlighted element
        doc.defaultView.scrollTo({
          top: rect.top + doc.defaultView.scrollY - 200,
          behavior: "smooth",
        });

        // Update counter text
        const counter = wrapper.querySelector("#a11y-occurrence-counter");
        counter.textContent = `Occurrence ${index + 1} of ${nodes.length}`;
      }

      // ⏮ / ⏭ Navigation
      const prevBtn = wrapper.querySelector("#a11y-prev-btn");
      const nextBtn = wrapper.querySelector("#a11y-next-btn");
      prevBtn.addEventListener("click", () => {
        if (currentIndex > 0) {
          currentIndex--;
          renderHighlight(currentIndex);
        }
      });
      nextBtn.addEventListener("click", () => {
        if (currentIndex < nodes.length - 1) {
          currentIndex++;
          renderHighlight(currentIndex);
        }
      });

      // Initialize first highlight
      renderHighlight(0);
    };
    // safe-selector-resolve inside showLiveIssueHighlight


  }

  document.addEventListener("coral-tab:selected", (e) => {
    const tab = e.target;
    if (tab.textContent && tab.textContent.trim().includes('Summary By Page')) {
        // initialize and render using server results
        initSummaryDashboard().catch((err) => {
          console.error('initSummaryDashboard error', err);
        });
      }
  });
  // Wait for all tabs to initialize before rendering
  $document.on("foundation-contentloaded", function () {
    //const container = document.getElementById('summary-container');
    //if (container && localStorage.getItem('a11y-multipage-results')) {
    //renderSummaryTable(JSON.parse(LZString.decompressFromUTF16(localStorage.getItem('a11y-multipage-results'))));
    //renderSummaryView(payload);
    // initSummaryDashboard();
    //} 
  }); 
})(Granite.$, $(document));
