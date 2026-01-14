window.SingleScanner = (function () {

  /**
   * Fetch HTML content of a given page path.
   */
  async function fetchPageHTML(url) {
    const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
    if (!response.ok) throw new Error(`Failed to load page: ${response.status}`);
    return await response.text();
  }

  /**
   * Runs axe-core accessibility scan on a single page.
   */
  async function runSinglePageScan(pagePath, resultsContainer, statusAlert) {
    const pageUrl = getPageURL(pagePath);
    console.log(`🔍 Starting accessibility scan for: ${pageUrl}`);

    // Create hidden iframe for isolated page scan
    const iframe = document.createElement('iframe');
    iframe.id = 'a11y-scan-frame';
    iframe.src = pageUrl;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    // Wait for iframe to load
    await new Promise((resolve, reject) => {
      iframe.onload = resolve;
      iframe.onerror = reject;
    });

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;

    // Inject axe-core dynamically if not already present
    if (!win.axe) {
      const script = doc.createElement('script');
      script.src = window.A11Y_CONFIG.AXE_SCRIPT_URL;
      doc.head.appendChild(script);
      await new Promise(r => (script.onload = r));
    }

    // Wait for DOM stability (optional small delay)
    await new Promise(r => setTimeout(r, 500));

    // Run axe-core
    const results = await win.axe.run(doc, window.A11Y_CONFIG.AXE_OPTIONS);

    // Hide spinner UI
    Loaders.hideLoadingUI(statusAlert);

    // Merge violations + incomplete (potential)
    const violationsWithType = (results.violations || []).map(v => ({ ...v, type: 'violation' }));
    const incompleteWithType = (results.incomplete || []).map(v => ({ ...v, type: 'potential' }));
    const allFindings = [...violationsWithType, ...incompleteWithType];

    // Show summary message
    statusAlert.setAttribute('variant', allFindings.length > 0 ? 'success' : 'info');
    statusAlert.querySelector('p').textContent =
      `Scan complete. Found ${allFindings.length} total issues (including potential).`;

    // Render results
    resultsContainer.innerHTML = '';
    if (allFindings.length > 0) {
      ResultsRenderer.renderResultsTable(allFindings, doc.documentElement.outerHTML, resultsContainer);
    } else {
      resultsContainer.innerHTML = '<p> No accessibility issues found.</p>';
    }

    console.log(`Accessibility scan complete for: ${pageUrl}`);
  }

  return {
    runSinglePageScan,
    fetchPageHTML
  };
})();
