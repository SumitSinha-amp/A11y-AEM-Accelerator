window.Loaders = (function () {
  function showLoadingUI(statusAlert, resultsContainer) {
    statusAlert.removeAttribute('hidden');
    statusAlert.setAttribute('variant', 'info');
    statusAlert.querySelector('p').innerHTML = `
      <span>Scanning... Please wait</span>
      <span class="spinner"></span>
    `;
    resultsContainer.innerHTML = generateSkeletonHTML(6);
  }

  function hideLoadingUI(statusAlert) {
    const spinner = statusAlert.querySelector('.spinner');
    if (spinner) spinner.remove();
  }

  function animateScanButton(button, isScanning) {
    if (!button) return;
    if (isScanning) {
      button.setAttribute('disabled', 'true');
      button.classList.add('scanning');
      button.innerHTML = `
        <span class="scan-spinner"></span>
        <span class="scan-text">Scanning...</span>
      `;
    } else {
      button.removeAttribute('disabled');
      button.classList.remove('scanning');
      button.innerHTML = `
        <coral-icon icon="search" size="S"></coral-icon>
        <coral-button-label>Scan</coral-button-label>
      `;
    }
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

  return {
    showLoadingUI,
    hideLoadingUI,
    animateScanButton
  };
})();
