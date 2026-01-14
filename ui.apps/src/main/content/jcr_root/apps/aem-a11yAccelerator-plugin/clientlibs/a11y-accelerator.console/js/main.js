(function ($, $document) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const scanBtn = document.getElementById('scan-button');
    const statusAlert = document.getElementById('status-alerts');
    const resultsContainer = document.getElementById('scan-page');
    const scanForm = document.getElementById('scan-form');
    const pathField = scanForm?.querySelector('foundation-autocomplete');
    const taglist = pathField?.querySelector('coral-taglist');
    let scanMode = 'single';

    if (!scanBtn || !pathField) return;

    // Handle Scan Mode toggle
    const modeToggle = document.getElementById('scan-mode');
    if (modeToggle) {
      modeToggle.addEventListener('change', function (e) {
        scanMode = e.target.value;
        console.log('Scan mode:', scanMode);
      });
    }

    // Handle Scan button
    scanBtn.addEventListener('click', async function (e) {
      e.preventDefault();
      const selectedTags = taglist?.querySelectorAll('coral-tag') || [];
      const selectedValues = Array.from(selectedTags).map(tag => tag.value);

      if (selectedValues.length === 0) {
        CoralUtils.createErrorDialog('Validation Error', 'Please select a page before scanning.');
        return;
      }

      Loaders.animateScanButton(scanBtn, true);
      Loaders.showLoadingUI(statusAlert, resultsContainer);

      try {
        const pageUrl = getPageURL(selectedValues[0]);
        console.log('Scanning:', pageUrl);
        // Example async simulation
        await new Promise(r => setTimeout(r, 1500));
        resultsContainer.innerHTML = `<p>✅ Scan complete for <b>${pageUrl}</b></p>`;
      } catch (err) {
        CoralUtils.createErrorDialog('Scan Error', err.message);
      } finally {
        Loaders.animateScanButton(scanBtn, false);
      }
    });
  });
})(Granite.$, $(document));
