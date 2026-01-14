/* scanjs.v2.js
   AEM Accessibility Accelerator — Panel-integrated v2
   - Creates a coral-panel inside the AEM sidepanel (component inspector)
   - Groups rules by rule.id and shows occurrence counts
   - Accordion per rule: Details & Components
   - Single-issue highlight, blue outline + yellow flash
   - Coral popover with remediation button -> opens CRX/DE for component path
   - Preserves Scan and Toggle highlights
*/
(function (window, document, $) {
  "use strict";

  if (window !== window.top) return;
  // don't run inside iframe
  if (window.__A11Y_ACCELERATOR_V2__) return;
  window.__A11Y_ACCELERATOR_V2__ = true;

  const A11Y = {
    panelId: "a11y-inspector-panel-v2",
    panelLabel: "Accessibility Accelerator",
    toggleBtnId: "a11y-toolbar-toggle-v2",
    toolbarInjected: false,
    issuesByRule: {},
    // { ruleId: { count, help, nodes: [{ selector, rawTarget, html, componentPath, componentType }] } }
    allOccurrences: [],
    // flat array for navigation
    occurrencesExcel: [],
    iframe: null,
    iframeDoc: null,
    currentOccurrenceIndex: -1,
    navElements: null,
    highlightsEnabled: true,
    init() {
      // Ensure we are in author/editor area
      if (!window.location.pathname.includes("/editor.html")) return;
      $(document).on("foundation-contentloaded", () => {
        setTimeout(() => {
          A11Y.injectToolbarButton();
          A11Y.injectPanel();
        }, 500);
      });

      const obs = new MutationObserver(() => {
        if (!document.getElementById(this.toggleBtnId))
          A11Y.injectToolbarButton();
        if (!document.getElementById(this.panelId)) A11Y.injectPanel();
      });
      obs.observe(document.body, {
        childList: true,
        subtree: true,
      });

      $(window).on("cq-editor-selectionchange", (e, editable) =>
        this.onEditorSelectionChange(editable)
      );
    },

    /* ===============================
       🔹 Inject Toolbar Button (AEM Top Bar)
       =============================== */
    injectToolbarButton() {
      if (document.getElementById("a11y-toolbar-toggle-v2")) return;

      const toolbar = document.querySelector(".coral3-ActionBar-secondary");
      if (!toolbar) {
        // 🔁 Retry every 500ms up to 5 seconds
        let retries = 0;
        const check = setInterval(() => {
          toolbar = document.querySelector(
            ".coral3-ActionBar-secondary, .editor-ActionBar"
          );
          if (toolbar) {
            clearInterval(check);
            A11Y.injectToolbarButton();
          } else if (++retries > 10) {
            clearInterval(check);
            console.warn("A11Yv2: Could not find author toolbar");
          }
        }, 500);
        return;
      }
      const btn = document.createElement("button");
      btn.id = "a11y-toolbar-toggle-v2";
      btn.setAttribute("is", "coral-button");
      btn.setAttribute("variant", "quiet");
      btn.setAttribute("title", "Toggle Accessibility Accelerator");
      // btn.innerHTML = `<coral-icon icon="accessibility" size="S" style="color:#cfe8ff"></coral-icon>`;
      btn.style.width = "36px";
      btn.style.height = "45px";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "center";
      toolbar.appendChild(btn);

      btn.style.zIndex = "9999";
      btn.style.visibility = "visible";
      btn.style.opacity = "1";
      btn.style.background = "transparent";

      const icon = document.createElement("coral-icon");
      //icon.setAttribute('icon', 'accessibility');
      icon.setAttribute("size", "S");
      icon.style.color = "#6e6e6e";
      icon.setAttribute("icon", "dashboard");

      btn.appendChild(icon);

      Coral.commons.ready(icon, function () {
        console.log("Coral icon upgraded");
      });

      btn.addEventListener("click", () => {
        const panel = document.getElementById("a11y-right-slidepanel");
        if (panel && panel.classList.contains("is-open")) {
          panel.classList.remove("is-open");
          document.body.classList.remove("a11y-panel-open");
          btn.removeAttribute("aria-pressed");
        } else {
          if (!panel) this.injectRightSlidePanel();
          setTimeout(() => {
            document
              .getElementById("a11y-right-slidepanel")
              ?.classList.add("is-open");
            document.body.classList.add("a11y-panel-open");
            btn.setAttribute("aria-pressed", "true");
          }, 200);
        }
      });

      console.log("A11y Toolbar Button added");
    },

    injectPanel() {
      if (document.getElementById("a11y-right-slidepanel")) return;

      const panel = document.createElement("div");
      panel.id = "a11y-right-slidepanel";
      panel.className = "a11y-slidepanel coral3-Shell-panel";
      panel.setAttribute("role", "region");
      panel.innerHTML = `
    <div class="a11y-slidepanel-header">
      <h3>Accessibility Accelerator</h3>
      <button is="coral-button" variant="quiet" icon="close" size="S" id="a11y-close-panel-btn"></button>
    </div>
    <div class="a11y-slidepanel-content">
	<div style="display:flex;gap:8px;align-items:center;">
      <button is="coral-button" variant="primary" id="a11y-scan-btn-v2" icon="search">Scan Page</button>
	    <button is="coral-button" variant="default" id="a11y-cancel-btn-v2" icon="stopCircle" disabled>Stop Scan</button>
      <button is="coral-button" variant="quiet" id="a11y-clear-btn-v2" icon="close">Clear Results</button>
      <div style="margin-top: 0;display: flex; gap: 25,padding-top: 10; justify-content: space-between; width: 100%; flex-direction: column" class="hidden" id="issues-nav">
          <div style="display: flex; width: 100%; justify-content: space-around;">
            <button id="a11y-prev-v2" class="button-nav prev"><span class="content"><i class="mdi arrow-left" /></span> </button>
            <button id="a11y-next-v2" class="button-nav next"><span class="content"><i class="mdi arrow-right" /></span></button>
          </div>
          <div style="display:flex; margin-top:10px; width:100%; justify-content:space-evenly;">
              <span>Prev Issue</span>
              <span>Next Issue</span>
          </div>
      </div>
	 </div>
	 <div id="a11y-progress-wrapper" style="margin-top:10px;display:none;">
	  <div id="a11y-progress-text"
		style="font-size:12px;color:var(--coral-foreground-secondary);margin-bottom:4px;">
		<div class="loader-img"></div> <span id="a11y-progress-percent">0%</span> done
	  </div>
	  <div id="a11y-progress-bar"
		style="height:5px;background:linear-gradient(90deg,#007aff,#4dbfff);width:0%;border-radius:3px;transition:width 0.4s ease;">
	  </div>
	</div>
  


      <div class="a11y-toggle-row" >
       <span>Show highlights and Navigation</span>
        <label class="a11y-switch"> 
          <input type="checkbox" id="a11y-toggle-highlights-v2" checked />
          <span class="a11y-slider" />
        </label>
      </div>
	   
      <div id="a11y-summary-container" style="margin-top:16px;"></div>
      <div id="a11y-issue-groups" style="margin-top:12px;min-height:180px;display:flex;align-items:center;justify-content:center;color:var(--coral-foreground-secondary);font-size:13px;">
		<div id="a11y-placeholder">Click <b>Scan Page</b> for Accessibility Issues.</div>
	  </div>
    </div>
  `;
      document.body.appendChild(panel);

      // Close logic
      document
        .getElementById("a11y-close-panel-btn")
        .addEventListener("click", () => {
          panel.classList.remove("is-open");
          document.body.classList.remove("a11y-panel-open");
          document
            .getElementById("a11y-toolbar-toggle-v2")
            ?.removeAttribute("aria-pressed");
        });

      // Hook up internal logic
      document
        .getElementById("a11y-scan-btn-v2")
        .addEventListener("click", () => this.runScan());
      document
        .getElementById("a11y-cancel-btn-v2")
        .addEventListener("click", () => this.cancelScan());
      document
        .getElementById("a11y-clear-btn-v2")
        .addEventListener("click", () => this.clearScanResults());
        document.getElementById("a11y-toggle-highlights-v2")
			  ?.addEventListener("change", (e) => {
			    const toggle = e.target;
			    localStorage.setItem(
			      "a11y-highlights-v2",
			      toggle.checked ? "on" : "off"
			    );
			    this.applyHighlightsVisibility(); 
			  });
      document
        .getElementById("a11y-prev-v2")
        .addEventListener("click", () => this.navigate(-1));
      document
        .getElementById("a11y-next-v2")
        .addEventListener("click", () => this.navigate(1));
      //this.bindHighlightToggle();
      this.injectPanelStyles();

      console.log("✅ A11y Right Slide Panel injected");
    },

    injectPanelStyles() {
      if (document.getElementById("a11y-style")) return;
      const s = document.createElement("style");
      s.id = "a11y-style";
      s.textContent = `
    /* Panel Container */
    .a11y-slidepanel {
      position: fixed;
      top: 0; /* below author header */
      right: 0;
      width: 420px;
      height: calc(100% - 64px);
      background: var(--coral-background, #fff);
      border-left: 1px solid rgba(0,0,0,0.15);
      box-shadow: -4px 0 8px rgba(0,0,0,0.2);
      transform: translateX(100%);
      transition: transform 0.3s ease;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow-y: hidden;
    }

    .a11y-slidepanel.is-open {
      transform: translateX(0);
      right: 0;
      bottom: 0;
      background-color: #eeeeee;
      position: absolute !important;
      top: 0 !important;
      min-width: 28%;
      max-width: 97.5%;
      width: 30%;
      height: 100%;
      overflow-y: hidden;
    }

    /* Push main content left when open */
    body.a11y-panel-open .editor-panel.editor-panel-active,
    body.a11y-panel-open .editor-panel.editor-panel-active {
      transition: margin-right 0.3s ease;
      right: 28%!important;
      width: 72%!important;
    }

    .a11y-slidepanel-header {
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:10px 16px;
      border-bottom:1px solid rgba(0,0,0,0.1);
      background: var(--coral-background-lighter,#f5f5f5);
      height: 20px;
    }

    .a11y-slidepanel-content {
      flex:1;
      padding:16px;
      overflow-y:auto;
    }

    @media screen and (min-width: 1025px) {
        .coral3-Shell-panel.a11y-slidepanel.is-open ~ #Content {
            right: 30%!important;
            width: 72%!important;
        }
    }
	/* === Skeleton Loader === */
	.a11y-skeleton {
	  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
	  background-size: 200% 100%;
	  animation: a11y-skeleton-shimmer 1.8s ease-in-out infinite;
	  border-radius: 4px;
	}
	@keyframes a11y-skeleton-shimmer {
	  0% { background-position: 200% 0; }
	  100% { background-position: -200% 0; }
	}
	.a11y-skeleton-line {
	  height: 14px;
	  width: 100%;
	  margin: 6px 0;
	  border-radius: 4px;
	}
	.a11y-skeleton-line.short { width: 60%; }
	.a11y-skeleton-line.medium { width: 80%; }

	/* === Scan Button Progress === */
	#a11y-scan-btn-v2.loading {
	  position: relative;
	  pointer-events: none;
	  opacity: 0.8;
	}
	#a11y-scan-btn-v2.loading::after {
	  content: "";
	  position: absolute;
	  left: 0;
	  bottom: 0;
	  height: 3px;
	  width: var(--progress-width, 0%);
	  background-color: #007aff;
	  transition: width 0.3s ease;
	  border-radius: 2px;
	}
	#a11y-placeholder {
	  opacity: 0.7;
	  font-style: italic;
	  text-align: center;
	  transition: opacity 0.3s ease;
	}
	#a11y-issue-groups {
  display: block !important;
  padding-top: 8px;
  font-size: 13px;
  color: var(--coral-foreground-primary);
}
.a11y-rule-wrapper {
  background: #fff;
  border-radius: 6px;
  border: 1px solid rgba(0,0,0,0.08);
  margin-bottom: 12px;
  padding: 10px 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.a11y-rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.a11y-rule-title {
  font-weight: 600;
  font-size: 14px;
  color: #333;
}
.a11y-count-badge {
  background: #e7f0ff;
  color: #0366d6;
  border-radius: 10px;
  padding: 2px 8px;
  font-size: 12px;
}
.a11y-rule-wrapper coral-accordion {
  width: 100%;
  margin-top: 6px;
  display: block;
}
.a11y-rule-wrapper coral-accordion-item {
  border-top: 1px solid rgba(0,0,0,0.08);
}
.a11y-rule-wrapper coral-accordion-item-content {
  background: #fafafa;
  padding: 8px !important;
}
.a11y-component-block {
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 8px;
  background: #fff;
  margin-bottom: 10px;
}
.a11y-occ-row pre {
  background: #f9f9f9;
  border: 1px solid #eee;
}
#a11y-expand-btn coral-icon {
  color: #007aff;
}
.a11y-rule-title span {
  background: #eef5ff;
  border-radius: 4px;
  padding: 2px 6px;
}
.a11y-rule-title span[data-level="A"] { background: #eafbea; color: #118a00; }
.a11y-rule-title span[data-level="AA"] { background: #fff7e6; color: #d89a00; }
.a11y-rule-title span[data-level="AAA"] { background: #fdeaea; color: #cc0000; }
#a11y-expand-btn {
    cursor: pointer;
    font-size: 13px;
    color: var(--coral-foreground);
    display: flex;
    align-items: center;
    gap: 4px;
    transition: color 0.2s ease;
  }
 .a11y-expand-icon { font-size:1em;transition: transform 0.22s ease; transform-origin: 50% 50%; }
.a11y-expand-btn { border-radius: 4px;border-radius: 4px;border: 0;background: none;outline: none;padding:0}
.a11y-expand-btn:focus { outline: 2px solid rgba(0,122,255,0.14); }
coral-accordion.a11y-collapsed {
  max-height: 0 !important;
  overflow: hidden !important;
  opacity: 0;
  margin-top: 0;
  margin-bottom: 0;
  transition: all 0.25s ease;
}
coral-accordion:not(.a11y-collapsed) {
  opacity: 1;
  max-height: 2000px; /* large enough to fit content */
  transition: all 0.3s ease;
}
  @keyframes a11yHighlightPulse {
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1); opacity: 0.6; }
}
.a11y-toggle-row {
    display: flex; 
    justify-content: right; 
    align-items: flex-end; 
    background: rgba(255,255,255,0.03); 
    padding: 8px 10px; 
    border-radius: 8px; 
    margin-bottom: 10px; 
    color: #666; 
    gap: 6px;
}
.a11y-switch { position:relative; width:44px; height:22px; display:inline-block; }
.a11y-switch input { display:none; }
.a11y-slider { position:absolute; left:0; top:0; right:0; bottom:0; background:#aaa; border-radius:22px; transition:background 0.25s; }
.a11y-slider::before { content:""; position:absolute; left:2px; top:2px; width:18px; height:18px; background:#fff; border-radius:50%; transition:transform 0.25s; }
.a11y-switch input:checked + .a11y-slider { background: linear-gradient(90deg,#007aff,#00bfff); }
.a11y-switch input:checked + .a11y-slider::before { transform: translateX(22px); }
 body.a11y-hide-highlights .a11y-acc-highlight { outline: none !important; background: transparent !important; box-shadow:none !important; }
.loader-img {
  width: fit-content;
  font-weight: bold;
  font-family: monospace;
  font-size: 16px;
  clip-path: inset(0 3ch 0 0);
  animation: l4 1s steps(4) infinite;
}
.loader-img:before {
  content:"Scanning! Please Wait..."
}
@keyframes l4 {to{clip-path: inset(0 -1ch 0 0)}}
  `;
      (top.document.head || document.head).appendChild(s);
      const style = document.createElement("style");
      style.textContent = `
          .a11y-overlay-flash {
            outline: 3px solid #2f80ed !important;
            box-shadow: 0 0 10px rgba(47,128,237,0.4);
            animation: a11yFlash 1.5s ease-out forwards;
          }
          @keyframes a11yFlash {
            0% { background-color: rgba(47,128,237,0.2); }
            100% { background-color: transparent; }
          }
        `;
      top.document.head.appendChild(style);
    },
    cancelScan() {
      if (this._abortScanController) {
        this._abortScanController.abort();
        this._abortScanController = null;

        const summary = document.getElementById("a11y-summary-container");
        const status = document.getElementById("a11y-scan-status");
        if (summary)
          summary.innerHTML = `<span style="color:var(--coral-warn)">⚠️ Scan canceled by user.</span>`;
        if (status) status.textContent = "Scan canceled.";

        const btnScan = document.getElementById("a11y-scan-btn-v2");
        const btnCancel = document.getElementById("a11y-cancel-btn-v2");
        if (btnScan) {
          btnScan.classList.remove("loading");
          btnScan.style.removeProperty("--progress-width");
          btnScan.innerHTML = `<coral-icon icon="search" size="S"></coral-icon> Scan Page`;
        }
        if (btnCancel) btnCancel.disabled = true;

        this.clearSkeleton();
        const progressText = document.getElementById("a11y-progress-text");
        if (progressText) progressText.style.display = "none";
        const progressWrapper = document.getElementById(
          "a11y-progress-wrapper"
        );
        if (progressWrapper) {
          progressWrapper.style.display = "none";
        }
      }
    },
    areHighlightsEnabled() {
      const stored = localStorage.getItem("a11y-highlights-v2");
      if (stored === "off") return false;
      const toggle = document.querySelector("#a11y-toggle-highlights-v2");
      return toggle ? toggle.checked !== false : true;
    },
    bindHighlightToggle() {
      const panel = document.getElementById("a11y-right-slidepanel");
      const toggle = panel.querySelector("#a11y-toggle-highlights-v2");
      if (!toggle) return;

      // Restore persisted state
      const pref = localStorage.getItem("a11y-highlights-v2");
      if (pref === "off") toggle.checked = false;
      // toggle.addEventListener('change', () => {
      localStorage.setItem("a11y-highlights-v2", toggle.checked ? "on" : "off");

      this.applyHighlightsVisibility();
      //});
    },
    applyHighlightsVisibility() {
        const pref = localStorage.getItem('a11y-highlights-v2');
        const enabled =
          pref !== 'off' &&
          document.getElementById('a11y-toggle-highlights-v2')?.checked !== false;

        try {
          if (!this.iframeDoc) return;
          this.iframeDoc.querySelectorAll('.a11y-acc-highlight,.a11y-acc-active').forEach(el => {
            el.style.outline = enabled ? '' : 'none';
            el.style.backgroundColor = enabled ? '' : 'transparent';
          });
        } catch (e) {}

        const navEnabled = enabled && this.allOccurrences.length > 0;
        this.setNavEnabled(navEnabled);
    },

    clearScanResults() {
      this.issuesByRule = {};
      this.allOccurrences = [];
      this.currentOccurrenceIndex = -1;

      const summary = document.getElementById("a11y-summary-container");
      const groups = document.getElementById("a11y-issue-groups");

      if (summary) summary.innerHTML = "";
      if (groups) {
        groups.innerHTML = `<div id="a11y-placeholder">Click <b>Scan Page</b> to see results.</div>`;
        groups.style.display = "flex";
        groups.style.alignItems = "center";
        groups.style.justifyContent = "center";
      }

      const scanBtn = document.getElementById("a11y-scan-btn-v2");
      //cancelBtn = document.getElementById("a11y-cancel-btn-v2");
      if (scanBtn) {
        scanBtn.classList.remove("loading");
        scanBtn.style.removeProperty("--progress-width");
        scanBtn.innerHTML = `<coral-icon icon="search" size="S"></coral-icon> Scan Page`;
      }
      if (cancelBtn) cancelBtn.disabled = true;
    },

    clearSkeleton() {
      const summary = document.getElementById("a11y-summary-container");
      const groups = document.getElementById("a11y-issue-groups");
      if (summary && summary.dataset.loading) {
        delete summary.dataset.loading;
        summary.innerHTML = "";
      }
      if (groups && groups.dataset.loading) {
        delete groups.dataset.loading;
        groups.innerHTML = `<div id="a11y-placeholder">Click <b>Scan Page</b> to see results.</div>`;
      }
    },

    /* ===============================
      Scan Function
       =============================== */

    async runScan() {
      // Abort controller for canceling scan
      this._abortScanController = new AbortController();
      const { signal } = this._abortScanController;

      const cancelBtn = document.getElementById("a11y-cancel-btn-v2");
      if (cancelBtn) cancelBtn.disabled = false;
      // reset
      this.issuesByRule = {};
      this.allOccurrences = [];
      this.currentOccurrenceIndex = -1;
      this.iframe = null;
      this.iframeDoc = null;
      this.clearPopover();

      const summaryEl = document.getElementById("a11y-summary-container");
      const groupsEl = document.getElementById("a11y-issue-groups");
      if (summaryEl)
        summaryEl.textContent = "Scanning… locating content iframe...";
      if (groupsEl) groupsEl.innerHTML = "";
      const scanBtn = document.getElementById("a11y-scan-btn-v2");

      // --- Step 1: Setup Skeleton UI ---
      if (groupsEl) {
        groupsEl.innerHTML = `
		  <div style="margin-top:10px;">
			<div class="a11y-skeleton a11y-skeleton-line"></div>
			<div class="a11y-skeleton a11y-skeleton-line medium"></div>
			<div class="a11y-skeleton a11y-skeleton-line"></div>
      <div class="a11y-skeleton a11y-skeleton-line"></div>
			<div class="a11y-skeleton a11y-skeleton-line medium"></div>
			<div class="a11y-skeleton a11y-skeleton-line"></div>
      <div class="a11y-skeleton a11y-skeleton-line"></div>
			<div class="a11y-skeleton a11y-skeleton-line medium"></div>
			<div class="a11y-skeleton a11y-skeleton-line"></div>
      <div class="a11y-skeleton a11y-skeleton-line"></div>
			<div class="a11y-skeleton a11y-skeleton-line medium"></div>
			<div class="a11y-skeleton a11y-skeleton-line"></div>
      <div class="a11y-skeleton a11y-skeleton-line"></div>
			<div class="a11y-skeleton a11y-skeleton-line medium"></div>
			<div class="a11y-skeleton a11y-skeleton-line"></div>
      <div className="a11y-skeleton a11y-skeleton-line" ></div>
			<div className="a11y-skeleton a11y-skeleton-line medium" ></div>
			<div className="a11y-skeleton a11y-skeleton-line" ></div>
		  </div>
		`;
        groupsEl.dataset.loading = "true";
      }

      if (summaryEl) {
        summaryEl.innerHTML = `
		  <div class="a11y-skeleton a11y-skeleton-line short"></div>
		  <div class="a11y-skeleton a11y-skeleton-line medium"></div>
		  <div id="a11y-scan-status" style="font-size:12px;margin-top:6px;color:var(--coral-foreground-secondary)"></div>
		`;
        summaryEl.dataset.loading = "true";
      }

      const statusEl = document.getElementById("a11y-scan-status");

      //if (scanBtn) {
      //scanBtn.classList.add("loading");
      //scanBtn.innerHTML = `Scanning...`;
      //}
      const progressWrapper = document.getElementById("a11y-progress-wrapper");
      const progressText = document.getElementById("a11y-progress-text");
      const progressPercent = document.getElementById("a11y-progress-percent");
      const progressBar = document.getElementById("a11y-progress-bar");

      let lastPercent = 0;
      const setProgress = (percent, msg) => {
        if (scanBtn)
          scanBtn.style.setProperty("--progress-width", percent + "%");
        if (statusEl) statusEl.textContent = msg;

        // Show progress UI
        if (progressWrapper) progressWrapper.style.display = "block";
        if (progressText && progressPercent && progressBar) {
          progressPercent.textContent = `${percent}%`;
          progressBar.style.width = percent + "%";
        }

        // Smooth transition from previous value
        if (progressBar && percent > lastPercent) {
          progressBar.style.transition = "width 0.6s ease";
          lastPercent = percent;
        }
      };
      try {
        // robust iframe detection
        setProgress(5, "Locating content iframe...");
        let frame = null;
        const selectors = [
          "iframe#ContentFrame",
          "iframe.EditorFrame",
          'iframe[id^="ContentFrame"]',
          'iframe[src*="/editor.html/"]',
        ];
        for (const sel of selectors) {
          try {
            const f = document.querySelector(sel);
            if (f && f.contentDocument && f.contentWindow) {
              frame = f;
              break;
            }
          } catch (e) {}
        }
        if (!frame) {
          const all = Array.from(document.querySelectorAll("iframe"));
          for (const f of all) {
            try {
              if (
                f.contentDocument &&
                f.contentWindow &&
                f.contentDocument.body
              ) {
                frame = f;
                break;
              }
            } catch (e) {}
          }
        }
        if (!frame) {
          if (summaryEl)
            summaryEl.innerHTML =
              '<span style="color:var(--coral-foreground-secondary)">No same-origin content iframe found (scan cannot run).</span>';
          return;
        }
        this.iframe = frame;
        this.iframeDoc = frame.contentDocument;

        // wait for iframe readiness (interactive/complete)
        try {
          await this.waitForFrameReady(this.iframeDoc, 8000);
          setProgress(40, "Iframe ready. Loading accessibility engine...");
        } catch (e) {
          if (summaryEl)
            summaryEl.innerHTML = `<span style="color:var(--coral-warn)">Iframe not ready: ${String(
              e
            )}</span>`;
          return;
        }

        // inject axe if needed
        try {
          if (!this.iframe.contentWindow.axe) {
            const s = this.iframeDoc.createElement("script");
            s.src =
              "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js";
            this.iframeDoc.head.appendChild(s);
            await new Promise((res, rej) => {
              s.onload = res;
              s.onerror = () => rej(new Error("Failed to load axe"));
              setTimeout(() => rej(new Error("axe load timeout")), 8000);
            });
          }
        } catch (err) {
          if (summaryEl)
            summaryEl.innerHTML = `<span style="color:var(--coral-warn)">Failed to load axe-core: ${String(
              err
            )}</span>`;
          return;
        }
        setProgress(60, "Running accessibility scan...");
        // run axe with a sensible config
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
            "document-title": {
              enabled: true,
            },
            "empty-heading": {
              enabled: true,
            },
            "image-alt": {
              enabled: true,
            },
            "video-caption": {
              enabled: true,
            },
            "color-contrast-enhanced": {
              enabled: true,
            },
            region: {
              enabled: true,
            },
            "landmark-one-main": {
              enabled: true,
            },
            "landmark-no-duplicate-contentinfo": {
              enabled: true,
            },
            "landmark-unique": {
              enabled: true,
            },
            "aria-allowed-role": {
              enabled: true,
            },
            "aria-required-parent": {
              enabled: true,
            },
            "target-size": {
              enabled: true,
            }, //'target-size-minimum': { enabled: true },
          },
          resultTypes: ["violations", "incomplete"],
          reporter: "v2",
        };
        let results;
        try {
          if (signal.aborted) throw new Error("Scan canceled");
          results = await Promise.race([
            this.iframe.contentWindow.axe.run(this.iframeDoc, axeOptions),
            new Promise((_, rej) =>
              setTimeout(() => rej(new Error("axe.run timeout")), 30000)
            ),
          ]);
          // if (signal.aborted) throw new Error("Scan canceled");
          // results = await Promise.race([
          //   this.iframe.contentWindow.axe.run(this.iframeDoc, axeOptions),
          //   new Promise((_, rej) => setTimeout(() => rej(new Error('axe.run timeout')), 30000))
          // ]);
          setProgress(100, "Scan complete!");
        } catch (err) {
          if (summaryEl)
            summaryEl.innerHTML = `<span style="color:var(--coral-warn)">Scan failed: ${String(
              err
            )}</span>`;
          return;
        }
        setProgress(85, "Parsing and rendering results...");
        // parse results into grouped data
        this.parseResults(results);

        // render summary, groups, and highlights
        this.renderSummary();
        this.renderIssueGroups();
        //this.highlightAllOccurences();
        //  this.highlightOverlayByPath(path);
        // --- Replace iframe-level highlight with overlay highlights ---
        // Invocation: replace your forEach block with this:
        //  this.allOccurrences.forEach((occ, i) => {
        //this.highlightOccurrenceOnOverlay(occ, i);
        // });
        if (this.highlightsEnabled) {
          this.allOccurrences.forEach((occ, i) => {
            this.highlightOccurrenceOnOverlay(occ, i);
          });
        }
        //this.applyHighlightsVisibility();
        // if there are queryable occurrences, enable navigator and set to first
        if (this.allOccurrences.length) {
          this.currentOccurrenceIndex = 0;
          this.focusOccurrence(0);
        } else {
          document.getElementById("a11y-nav-count-v2").textContent = "0 / 0";
        }
      } finally {
        // Always cleanup loader
        /*if (scanBtn) {
          setTimeout(() => {
            scanBtn.classList.remove("loading");
            scanBtn.style.removeProperty("--progress-width");
            scanBtn.innerHTML = `<coral-icon icon="search" size="S"></coral-icon> Scan Page`;
          }, 1200);
        }*/
        if (progressWrapper) {
          setTimeout(() => {
            progressWrapper.style.opacity = "0";
            progressWrapper.style.transition = "opacity 0.6s ease";
            setTimeout(() => {
              progressWrapper.style.display = "none";
              progressWrapper.style.opacity = "1";
              if (progressBar) progressBar.style.width = "0%";
              if (progressPercent) progressPercent.textContent = "0%";
            }, 600);
          }, 1500);
        }
        const progressText = document.getElementById("a11y-progress-text");
        if (progressText) progressText.style.display = "none";
      }
      // cancelBtn = document.getElementById("a11y-cancel-btn-v2");
      if (cancelBtn) cancelBtn.disabled = true;
      this._abortScanController = null;
    },

    waitForFrameReady(doc, timeout = 8000) {
      return new Promise((resolve, reject) => {
        const start = Date.now();
        (function check() {
          try {
            if (!doc) return reject("no doc");
            if (
              doc.readyState === "complete" ||
              doc.readyState === "interactive"
            )
              return resolve();
          } catch (e) {
            return reject(e);
          }
          if (Date.now() - start > timeout)
            return reject("timeout waiting for iframe ready");
          setTimeout(check, 150);
        })();
      });
    },

    parseResults(results) {
      const violations = results.violations || [];
      const incomplete = results.incomplete || [];
      const all = [...violations, ...incomplete];

      const editableMap = {};
      if (window.Granite && Granite.author && Granite.author.editables) {
        Granite.author.editables.forEach((e) => {
          try {
            const selector = e.dom && e.dom.selector ? e.dom.selector : null;
            if (selector)
              editableMap[selector] = {
                path: e.path,
                type: e.type,
                title: e.config && e.config.title,
              };
          } catch (e) {}
        });
      }

      const occurrences = [];
      for (const rule of all) {
        const nodes = rule.nodes || [];
        for (const node of nodes) {
          const rawTarget =
            Array.isArray(node.target) && node.target.length
              ? node.target[0]
              : null;
          let selector = rawTarget;
          // try to make selector queryable inside iframe
          try {
            if (selector) this.iframeDoc.querySelector(selector);
          } catch (err) {
            const cleaned = selector ? selector.replace(/["']/g, "") : null;
            try {
              if (cleaned)
                this.iframeDoc.querySelector(cleaned) && (selector = cleaned);
            } catch (e) {}
          }
          // try to map to a Granite editable component

          let compPath = "(unknown)";
          let compType = "(unmapped)";
          let contextHtml = "(unavailable)";
          let compName = "(unknown)";
          try {
            if (selector) {
              const el = this.iframeDoc.querySelector(selector);

              if (el) {
                const info = this.getAemComponentInfo(el);

                if (info) {
                  compName = info.componentName || "(unknown)";

                  compPath = info.componentPath || "(unknown)";

                  compType = info.componentType || "(unmapped)";

                  contextHtml = info.contextHtml || node.html || "";
                }
              }
            }
          } catch (e) {
            console.warn("A11Yv2: component resolution failed", e);
          }

          // Extract WCAG level (e.g. wcag2a, wcag2aa, wcag2aaa)
          const wcagTag = (rule.tags || []).find((t) => /^wcag2(a+)$/.test(t));
          const wcagLevel = wcagTag
            ? wcagTag.replace("wcag2", "").toUpperCase()
            : "—";
          occurrences.push({
            ruleId: rule.id,

            help: rule.help || rule.description || "",

            impact: rule.impact || "",

            selector: selector,

            rawTarget: rawTarget,

            html: contextHtml,
            // use full snippet now

            failureSummary: node.failureSummary || "",

            componentName: compName,

            componentPath: compPath,

            componentType: compType,
            wcagLevel,
          });
        }
      }

      this.occurrencesExcel = occurrences;

      // group by rule
      this.issuesByRule = {};
      occurrences.forEach((o) => {
        if (!this.issuesByRule[o.ruleId]) {
          this.issuesByRule[o.ruleId] = {
            ruleId: o.ruleId,
            help: o.help,
            impact: o.impact,
            nodes: [],
          };
        }
        this.issuesByRule[o.ruleId].nodes.push(o);
      });

      // flat list for navigation (only entries with selector)
      this.allOccurrences = occurrences.filter((o) => o.selector);
      this.highlightIssuesInAuthor();
      top.document.querySelector("#issues-nav").setAttribute("class", "");
    },
    /* ===============================
       🔹 Enhanced AEM Component Mapper
       =============================== */

    getAemComponentInfo(element) {
      try {
        if (!element) return null;

        // ===============================
        // STEP 1: Get element inside the iframe (content frame)
        // ===============================
        const iframe = top.document.querySelector(
          'iframe[name="ContentFrame"], iframe#ContentFrame, iframe.EditorFrame'
        );
        const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
        if (!doc) return null;

        const el =
          element.ownerDocument === doc
            ? element
            : doc.querySelector(element.nodeName);
        if (!el) return null;

        // ===============================
        // STEP 2: Find nearest cq-placeholder or editable ancestor
        // ===============================
        let placeholder = null;
        let overlayEl = null;
        let componentName = "(unknown)";
        let componentType = "(unknown type)";
        let componentPath = null;
        let parentComponent = null;
        let walker = el?.parentElement;
        // start from parent of el

        while (walker && walker !== doc.body) {
          // --- Check if this parent has a direct child with class cq-placeholder ---
          const placeholderChild = Array.from(walker.children).find((child) =>
            child.classList?.contains("cq-placeholder")
          );

          if (placeholderChild) {
            placeholder = placeholderChild;
            componentName = placeholder.getAttribute("data-emptytext") || null;

            // --- Check if same parent has a direct <cq> tag ---
            const cqTag = Array.from(walker.children).find(
              (child) => child.tagName?.toLowerCase() === "cq"
            );

            if (cqTag) {
              try {
                const config = cqTag.getAttribute("data-config");
                if (config) {
                  const parsed = JSON.parse(config);
                  componentType = parsed.type || null;
                }
              } catch (e) {
                console.warn("Invalid JSON in data-config:", e);
              }
            }

            break;
            // stop once we found the first cq-placeholder
          }

          // Move up to next parent
          walker = walker.parentElement;
        }

        return {
          componentName,
          componentType,
          componentPath,
          parentComponent,
          el,
        };
      } catch (err) {
        console.warn("A11Yv2: overlay/component mapping failed", err);
        return null;
      }
    },

    /**
     * buildContextSnippet()
     * - Returns safe HTML snippet with all ancestor wrappers
     */
    buildContextSnippet(el, depthLimit = 4) {
      try {
        let current = el;
        let html = "";
        let depth = 0;
        while (current && current.nodeType === 1 && depth < depthLimit) {
          const outer = current.outerHTML;
          html = outer ? `${outer}\n${html}` : html;
          current = current.parentElement;
          depth++;
        }
        return this.escapeHtml(html.trim().substring(0, 800));
        // limit length
      } catch (e) {
        return "(failed to build snippet)";
      }
    },

    renderSummary() {
      const total = Object.values(this.issuesByRule).reduce(
        (acc, r) => acc + (r.nodes ? r.nodes.length : 0),
        0
      );
      const summaryEl = document.getElementById("a11y-summary-container");
      if (!summaryEl) return;
      summaryEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:600">Scan results</div>
          <div style="color:var(--coral-foreground-secondary)">Found ${total} occurrences across ${
        Object.keys(this.issuesByRule).length
      } rule(s)</div>
          <button
        id="exportExcelBtn"
        is="coral-button"
        variant="primary"
        title="Download accessibility report as Excel"
      >
        <coral-icon icon="download" size="S"></coral-icon>
        <span>xlsx</span>
      </button>
          </div>
      `;

      const exportBtn = document.getElementById("exportExcelBtn");
      if (exportBtn) {
        exportBtn.addEventListener("click", () => {
          exportBtn.setAttribute("disabled", "true");
          exportBtn.querySelector("span").textContent = "Generating...";

          try {
            // this.loadExcelLibrary();
            if (this.occurrencesExcel?.length) {
              this.exportOccurrencesToExcel(this.occurrencesExcel);
            } else {
              alert("No accessibility issues found to export.");
            }
          } catch (err) {
            alert("Failed to load Excel export library.");
            console.error(err);
          }

          exportBtn.removeAttribute("disabled");
          exportBtn.querySelector("span").textContent = "Download";
        });
      }
    },

    renderIssueGroups() {
      const container = document.getElementById("a11y-issue-groups");
      if (!container) return;
      container.innerHTML = "";

      Object.values(this.issuesByRule).forEach((rule) => {
        const wrapper = document.createElement("div");
        wrapper.className = "a11y-rule-wrapper";
        wrapper.style.marginBottom = "8px";
        const sampleNode = rule.nodes?.[0];
        const wcagLevel = sampleNode?.wcagLevel || "—";
        const header = document.createElement("div");
        const accordion = new Coral.Accordion();
        accordion.classList.add("a11y-collapsed");
        header.className = "a11y-rule-header";
        header.innerHTML = `
<div class="a11y-rule-title" style="font-weight:600">
  ${rule.ruleId}
 <span data-level="${wcagLevel}" style="margin-left:6px;font-size:12px;">(WCAG ${wcagLevel})</span>
</div>
<div style="display:flex;align-items:center;gap:8px">
  <div class="a11y-count-badge">${(rule.nodes || []).length} occurrences</div>
 <button type="button" class="a11y-expand-btn" aria-expanded="false" title="Expand / Collapse" >
      <coral-icon icon="chevronDown" size="S" class="a11y-expand-icon" />
    </button>
</div>
    `;
        wrapper.appendChild(header);
        // --- safe event wiring (no coral-icon dependency) ---

        const expandBtn = header.querySelector(".a11y-expand-btn");
        if (expandBtn) {
          // const expandLabel = expandBtn.querySelector('.a11y-expand-label');
          //const expandIcon = expandBtn.querySelector('.a11y-expand-icon');

          // 🔁 Always find current first item dynamically each click
          const getFirstItem = () =>
            accordion.querySelector("coral-accordion-item");

          expandBtn.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            //console.log("clicked");
            // Find the accordion that belongs to this rule block (just below header)
            const accordion = header.nextElementSibling?.matches(
              "coral-accordion"
            )
              ? header.nextElementSibling
              : header.parentElement.querySelector(":scope > coral-accordion");

            if (!accordion) {
              console.warn(
                "A11Yv2: No coral-accordion found near expand button"
              );
              return;
            }

            const isCollapsed = accordion.classList.contains("a11y-collapsed");

            // Toggle accordion collapse
            if (isCollapsed) {
              accordion.classList.remove("a11y-collapsed");
            } else {
              accordion.classList.add("a11y-collapsed");
            }

            const expandIcon = expandBtn.querySelector(".a11y-expand-icon");
            expandBtn.setAttribute("aria-expanded", String(isCollapsed));

            if (isCollapsed) {
              //  expandLabel.textContent = 'Collapse';
              if (expandIcon) expandIcon.setAttribute("icon", "chevronDown");
            } else {
              //  expandLabel.textContent = 'Expand';
              if (expandIcon) expandIcon.setAttribute("icon", "chevronUp");
            }
          });

          // 🧩 MutationObserver fallback — re-attach event if Coral swaps DOM
          const observer = new MutationObserver(() => {
            const firstItem = getFirstItem();
            if (!firstItem) return;
            // ensure we rebind to new coral-item state if needed
            if (!expandBtn.hasAttribute("data-bound")) {
              expandBtn.setAttribute("data-bound", "true");
            }
          });
          observer.observe(accordion, {
            childList: true,
            subtree: true,
          });
        }

        /* ---------- Details ---------- */
        const detailsItem = new Coral.Accordion.Item();
        detailsItem.label.textContent = "Details";
        detailsItem.content.innerHTML = `
<div style="padding:8px;">
<div style="font-size:13px;font-weight:600;">Recommended Fix</div>
<div style="margin-top:6px;font-size:13px;color:var(--coral-foreground-secondary)">
          ${this.escapeHtml(rule.help || "(no description)")}
</div>
<div style="margin-top:8px;">
<a target="_blank" rel="noopener" href="https://www.w3.org/WAI/standards-guidelines/wcag/">WCAG reference</a>
</div>
</div>
    `;
        accordion.setAttribute("single", "true");
        accordion.appendChild(detailsItem);

        /* ---------- Components & Occurrences ---------- */
        const compItem = new Coral.Accordion.Item();
        compItem.label.textContent = "Components";

        const compContainer = document.createElement("div");
        compContainer.style.padding = "0";
        compContainer.style.maxHeight = "520px";
        compContainer.style.overflowY = "auto";

        // Group by component path
        const compMap = {};
        (rule.nodes || []).forEach((n) => {
          const key = n.componentPath || "(unknown)";
          compMap[key] = compMap[key] || {
            path: key,
            name: n.componentName || "(unknown)",
            type: n.componentType || "(unmapped)",
            issues: [],
          };
          compMap[key].issues.push(n);
        });

        Object.values(compMap).forEach((c) => {
          const block = document.createElement("div");
          block.className = "a11y-component-block";
          block.style.marginBottom = "14px";
          block.innerHTML = `
      `;

          // Each issue occurrence in this component
          c.issues.forEach((occ, idx) => {
            const htmlContext = this.escapeHtml(
              (occ.html || "(no snippet)").trim().substring(0, 1200)
            )
              .replace(/&amp;/g, "&")
              .replace(/\s*\n\s*/g, "\n") // normalize line breaks
              .replace(/\n{2,}/g, "\n") // remove multiple blank lines
              .replace(/>\s+</g, ">\n<");
            //console.log(htmlContext);
            const parents =
              occ.parents && occ.parents.length
                ? occ.parents
                    .map(
                      (p) => `
<li style="margin:2px 0;">
<div style="font-size:12px;font-weight:600;">${this.escapeHtml(p.type)}</div>
<div style="font-size:11px;color:var(--coral-foreground-secondary)">${this.escapeHtml(
                        p.path
                      )}</div>
</li>
          `
                    )
                    .join("")
                : '<li style="font-size:12px;color:var(--coral-foreground-secondary)">(No parent info)</li>';

            const row = document.createElement("div");
            row.className = "a11y-occ-row";
            row.style.cssText = `
          border:1px solid #ddd;
          border-radius:4px;
          margin-bottom:10px;
          padding:8px 10px;
          background:#fafafa;
        `;
            row.innerHTML = `
<div style="font-size:12px;color:#444;margin-bottom:4px;">
<span style="font-weight:600;">HTML Context:</span>
</div>
<pre style="font-size:11px;font-family:monospace;white-space:pre-wrap;word-break:break-all;background:#fff;border:1px solid #eee;padding:6px;border-radius:4px;max-height:180px;overflow:auto;">
${htmlContext}
</pre>
<details style="margin-top:6px;">
<summary style="cursor:pointer;font-size:12;color:#0366d6">Show Component</summary>
<ul style="margin-top:4px;padding-left:14px;list-style-type:none">
<li><strong>Component Name:</strong> ${occ.componentName} </li>
<li><strong>Path:</strong> ${this.escapeHtml(
              occ.componentType || "(unknown)"
            )}</li>
</ul>
</details>
<div style="margin-top:8px;display:flex;gap:6px;justify-content:flex-end;">
<button is="coral-button" variant="quiet" size="S" class="a11y-highlight-occ" data-index="${this.allOccurrences.findIndex(
              (o) => o.selector === occ.selector
            )}" data-path="${this.escapeAttr(occ.componentPath)}"
  >
              Highlight
</button>
<button is="coral-button" variant="primary" size="S" class="a11y-remediate-occ" data-path='${
              occ.html
            }'>
              Suggestions
</button>
</div>
        `;
            const snippetPre = row.querySelector(".a11y-context-snippet");
            if (snippetPre) snippetPre.textContent = occ.html || "(no snippet)";
            block.appendChild(row);
          });

          compContainer.appendChild(block);
        });
        compItem.content.appendChild(compContainer);
        accordion.setAttribute("single", "true");
        accordion.appendChild(compItem);

        wrapper.appendChild(accordion);
        container.appendChild(wrapper);

        /* ---------- Interactions ---------- */
        Coral.commons.ready(() => {
          // highlight/remediate
          compContainer.addEventListener("click", (ev) => {
            const hl = ev.target.closest(".a11y-highlight-occ");
            const rm = ev.target.closest(".a11y-remediate-occ");

            // Highlight Button
            if (hl) {
              const path = hl.getAttribute("data-path");
              if (path && path !== "(unknown)") {
                // 🔹 New behavior: highlight real overlay
                this.highlightOverlayByPath(path);
              } else {
                // fallback to iframe highlight if no path
                const idx = Number(hl.getAttribute("data-index"));
                if (!isNaN(idx)) this.focusOccurrence(idx);
              }
            }
            // Remediate Button
            else if (rm) {
              const btn = this;
              const ruleId = rule.ruleId;
              const snippet = rm.getAttribute("data-path");
              const helpText = rule.help;

              btn.disabled = true;
              btn.innerHTML = "Loading...";
              console.log(ruleId + snippet + helpText);

              $.ajax({
                type: "POST",
                url: "/bin/a11yaccelerator/a11y-ai-suggestions",
                data: JSON.stringify({
                  ruleId,
                  snippet,
                  helpText,
                }),
                contentType: "application/json",
                success: function (res) {
                  console.log("Response:", res);
                  let suggestionText = "";
                  const escapeHtml = (str) =>
                    String(str)
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;")
                      .replace(/'/g, "&#039;");
                  if (res.suggestion) {
                    suggestionText = `<pre style="white-space:pre-wrap;">${escapeHtml(
                      res.suggestion
                    )}</pre>`;
                  } else {
                    suggestionText = `<pre style="white-space:pre-wrap;">${escapeHtml(
                      JSON.stringify(res, null, 2)
                    )}</pre>`;
                  }
                  const dialog = new Coral.Dialog().set({
                    id: "aiSuggestionDialog",
                    header: {
                      innerHTML: "<h3>AI Suggestions</h3>",
                    },
                    content: {
                      innerHTML: `<pre style="white-space:pre-wrap;">${suggestionText}</pre>`,
                    },
                    footer: {
                      innerHTML: `<button is="coral-button" variant="primary" coral-close>Close</button>`,
                    },
                  });

                  dialog.style.width = "480px";
                  dialog.style.maxWidth = "90vw";
                  dialog.style.zIndex = "99999";
                  // stay above side panel
                  dialog.style.position = "fixed";
                  dialog.style.top = "10%";
                  dialog.style.left = "50%";
                  dialog.style.transform = "translateX(-50%)";
                  dialog.classList.add("ai-suggestion-popup");
                  document.body.appendChild(dialog);
                  dialog.show();
                },
                error: function (xhr, status, error) {
                  // console.error("AJAX Error:", xhr.status, xhr.responseText);

                  console.error("AJAX Error:", status, error, xhr.responseText);

                  const dialog = new Coral.Dialog().set({
                    id: "aiErrorDialog",
                    header: {
                      innerHTML: "<h3>Error</h3>",
                    },
                    content: {
                      innerHTML: `<p>Failed to fetch AI suggestions.<br>Status: ${xhr.status}<br>${xhr.responseText}</p>`,
                    },
                    footer: {
                      innerHTML: `<button is="coral-button" variant="primary" coral-close>Close</button>`,
                    },
                  });

                  document.body.appendChild(dialog);
                  dialog.show();
                },
              });
            }
          });
        });
      });
    },
    /**
     * Robust overlay highlight for an occurrence path
     * - tries Granite.author.editables (several matching heuristics)
     * - tries overlay DOM lookup with multiple path permutations
     * - falls back to adding a temporary highlight class + scrollIntoView on the overlay element
     */
    highlightOccurrenceOnOverlay(occ, idx) {
      console.log(
        "A11Yv2 diagnostics: trying to match",
        occ.componentPath,
        pathCandidates
      );
      console.log(
        "Granite present?",
        !!window.Granite,
        !!(Granite && Granite.author && Granite.author.editables)
      );
      console.log(
        "OverlayWrapper found?",
        !!top.document.querySelector("#OverlayWrapper")
      );
      try {
        if (!occ || !occ.componentPath || occ.componentPath === "(unknown)")
          return;

        const pathCandidates = [];
        const p = occ.componentPath;

        // common permutations to try
        pathCandidates.push(p);
        if (p.includes("/jcr:content/"))
          pathCandidates.push(p.split("/jcr:content/").pop());
        if (p.endsWith(".html")) pathCandidates.push(p.replace(/\.html$/, ""));
        if (!p.endsWith(".html")) pathCandidates.push(p + ".html");
        // include shorter suffix match
        pathCandidates.push(p.split("/").slice(-3).join("/"));

        // helper to try Granite.author.editables in various shapes
        const tryGranite = () => {
          try {
            if (!window.Granite || !Granite.author) return null;
            let editables = Granite.author.editables;
            if (!editables) return null;
            // if it's an object map, convert to values
            if (!Array.isArray(editables)) {
              try {
                editables = Object.values(editables);
              } catch (e) {
                /* ignore */
              }
            }
            if (!Array.isArray(editables)) return null;

            for (const cand of pathCandidates) {
              const found = editables.find((e) => {
                if (!e || !e.path) return false;
                // exact match or suffix/endsWith match
                return (
                  e.path === cand ||
                  (cand &&
                    e.path &&
                    (e.path === cand ||
                      cand.endsWith(e.path) ||
                      e.path.endsWith(cand) ||
                      e.path.includes(cand) ||
                      cand.includes(e.path)))
                );
              });
              if (found) return found;
            }
          } catch (e) {}
          return null;
        };
        // helper to find overlay DOM element
        const findOverlayElement = () => {
          try {
            const overlayRoot =
              top.document.querySelector("#OverlayWrapper") || top.document;
            // search by exact data-path
            for (const cand of pathCandidates) {
              if (!cand) continue;
              let el = overlayRoot.querySelector(
                `[data-type="Editable"][data-path="${cand}"]`
              );
              if (el) return el;
            }
            // fallback: find overlay whose label/text/title contains the placeholder/component name
            for (const cand of pathCandidates) {
              const overlays = overlayRoot.querySelectorAll(
                '[data-type="Editable"][data-path]'
              );
              for (const ov of overlays) {
                const lbl = (
                  ov.querySelector(".cq-Overlay--component-name")
                    ?.textContent ||
                  ov.getAttribute("data-text") ||
                  ov.getAttribute("title") ||
                  ""
                ).toLowerCase();
                if (!lbl) continue;
                if (cand && lbl.includes(String(cand).toLowerCase())) return ov;
                // also check path suffix match on DOM attribute
                const ovPath = ov.getAttribute("data-path") || "";
                if (
                  ovPath &&
                  pathCandidates.some(
                    (pc) => ovPath.endsWith(pc) || pc.endsWith(ovPath)
                  )
                )
                  return ov;
              }
            }
          } catch (e) {}
          return null;
        };
        // schedule with a small delay to avoid firing many UI updates at once
        setTimeout(() => {
          // 1) Try Granite.author selection (preferred; triggers native highlight)
          const edit = tryGranite();
          if (edit) {
            try {
              // Use whichever selection method exists
              if (
                Granite.author.selection &&
                typeof Granite.author.selection.set === "function"
              ) {
                Granite.author.selection.set(edit);
              } else if (
                Granite.author.selection &&
                typeof Granite.author.selection.select === "function"
              ) {
                Granite.author.selection.select(edit);
              } else if (typeof Granite.author.editableClick === "function") {
                // fallback older API (if available)
                Granite.author.editableClick(edit);
              }
            } catch (e) {
              // ignore and try DOM overlay fallback
              console.warn("A11Yv2: granite selection attempt failed", e);
            }
          }

          // 2) Always try highlightOverlayByPath (if available) - your existing function
          try {
            if (typeof this.highlightOverlayByPath === "function") {
              // pass first successful candidate
              const chosen =
                pathCandidates.find((pc) => !!pc) || occ.componentPath;
              this.highlightOverlayByPath(chosen);
            }
          } catch (e) {
            /* ignore */
          }

          // 3) If still not visible, manipulate overlay DOM directly
          const overlayEl = findOverlayElement();
          if (overlayEl) {
            try {
              // scroll it into view and add a temp class to make it obvious
              overlayEl.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
              overlayEl.classList.add("a11y-overlay-flash");
              // ensure it is visually on top
              overlayEl.style.zIndex = "99999";
              setTimeout(() => {
                overlayEl.classList.remove("a11y-overlay-flash");
                overlayEl.style.zIndex = "";
              }, 1800);
            } catch (e) {
              console.warn("A11Yv2: overlay DOM highlight failed", e);
            }
          } else {
            // no overlay found: log for diagnostics
            console.warn(
              "A11Yv2: no overlay element matched for path candidates",
              pathCandidates
            );
          }
        }, (idx || 0) * 140);
        // staggered timing
      } catch (e) {
        console.warn("A11Yv2: highlightOccurrenceOnOverlay error", e);
      }
    },

    // ===============================
    // EXPORT FUNCTION
    // ===============================
    exportOccurrencesToExcel(occurrences) {
      if (!occurrences || occurrences.length === 0) {
        alert("No occurrences to export.");
        return;
      }

      // --- Group by ruleId ---
      const grouped = occurrences.reduce((acc, item) => {
        (acc[item.ruleId] = acc[item.ruleId] || []).push(item);
        return acc;
      }, {});

      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Create one worksheet per rule group
      Object.keys(grouped).forEach((ruleId) => {
        const items = grouped[ruleId];

        // Create a user-friendly sheet name
        const sheetName = ruleId.substring(0, 30);
        // Excel sheet name limit

        // Create data rows
        const sheetData = [
          [
            "Rule ID",
            "Help / Description",
            "Impact",
            "Selector",
            "Failure Summary",
            "Component Name",
            "Component Path",
            "Component Type",
            "HTML Snippet",
          ],
          ...items.map((o) => [
            o.ruleId,
            o.help || o.description || "",
            o.impact || "",
            o.selector || "",
            o.failureSummary || "",
            o.componentName || "",
            o.componentPath || "",
            o.componentType || "",
            o.html || "",
          ]),
        ];

        const ws = XLSX.utils.aoa_to_sheet(sheetData);

        // Auto-size columns (roughly)
        const colWidths = sheetData[0].map((_, i) => ({
          wch: Math.max(
            ...sheetData.map((row) => (row[i] ? row[i].toString().length : 0)),
            15
          ),
        }));
        ws["!cols"] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      // --- Export and trigger download ---
      XLSX.writeFile(wb, "Accessibility_Report.xlsx");
    },

    highlightOverlayByPath(path) {
      if (!this.highlightsEnabled) return;
      try {
        if (!path || path === "(unknown)") return;

        const topDoc = window.top.document;
        const iframe = topDoc.querySelector(
          'iframe#ContentFrame, iframe[name="ContentFrame"], iframe.EditorFrame'
        );
        const overlayWrapper = topDoc.querySelector("#OverlayWrapper");
        const scrollView = topDoc.querySelector("#ContentScrollView");

        if (!iframe || !overlayWrapper || !scrollView) {
          console.warn("A11Yv2: Required overlay containers not found.");
          return;
        }

        // ✅ Step 1: Create or reuse highlight layer — INSIDE ContentScrollView
        let highlightLayer = topDoc.querySelector("#a11yHighlightLayer");
        if (!highlightLayer) {
          highlightLayer = topDoc.createElement("div");
          highlightLayer.id = "a11yHighlightLayer";
          Object.assign(highlightLayer.style, {
            position: "absolute",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: "2147483648",
            // just above OverlayWrapper
          });

          // insert after OverlayWrapper so it stacks above it
          if (overlayWrapper.nextSibling) {
            scrollView.insertBefore(highlightLayer, overlayWrapper.nextSibling);
          } else {
            scrollView.appendChild(highlightLayer);
          }
        }

        // ✅ Step 2: Locate target element
        let targetRect = null;
        const overlayEl = topDoc.querySelector(
          `[data-type="Editable"][data-path="${path}"]`
        );
        if (overlayEl) {
          targetRect = overlayEl.getBoundingClientRect();
        } else if (path.includes("/jcr:content/") && iframe?.contentDocument) {
          const shortPath = path.split("/jcr:content/").pop();
          const el = Array.from(
            iframe.contentDocument.querySelectorAll(
              "[data-path],[data-cq-data-path]"
            )
          ).find((e) =>
            (
              e.getAttribute("data-path") ||
              e.getAttribute("data-cq-data-path") ||
              ""
            ).endsWith(shortPath)
          );
          if (el) targetRect = el.getBoundingClientRect();
        }

        if (!targetRect) {
          console.warn("A11Yv2: No element found to highlight for path:", path);
          return;
        }

        // ✅ Step 3: Compute coordinates relative to viewport (iframe -> top)
        const iframeRect = iframe.getBoundingClientRect();
        const absTop = iframeRect.top + targetRect.top;
        const absLeft = iframeRect.left + targetRect.left;

        // ✅ Step 4: Create highlight box
        const box = topDoc.createElement("div");
        Object.assign(box.style, {
          position: "absolute",
          top: `${absTop}px`,
          left: `${absLeft}px`,
          width: `${targetRect.width}px`,
          height: `${targetRect.height}px`,
          border: "3px solid #007aff",
          background: "rgba(255, 230, 0, 0.35)",
          borderRadius: "4px",
          boxShadow: "0 0 12px rgba(0,122,255,0.6)",
          animation: "a11yHighlightPulse 1.6s ease-out",
          zIndex: "2147483648",
          pointerEvents: "none",
        });

        highlightLayer.appendChild(box);

        // ✅ Step 5: Auto-remove after 2 seconds
        setTimeout(() => box.remove(), 2000);
      } catch (e) {
        console.warn(
          "A11Yv2: highlightOverlayByPath (above OverlayWrapper) failed",
          e
        );
      }
    },

    highlightAllOccurences() {
      if (!this.iframeDoc) return;
      // remove previous
      try {
        this.iframeDoc
          .querySelectorAll(".a11y-acc-highlight")
          .forEach((el) =>
            el.classList.remove("a11y-acc-highlight", "a11y-acc-active")
          );
      } catch (e) {}
      // inject styles inside iframe
      try {
        if (!this.iframeDoc.getElementById("a11y-acc-style")) {
          const s = this.iframeDoc.createElement("style");
          s.id = "a11y-acc-style";
          s.textContent = `
            .a11y-acc-highlight { outline: 3px solid rgba(0,0,0,0.0); transition: outline 0.2s ease, background 0.4s ease; }
            .a11y-acc-active { outline: 3px solid #2f80ed !important; box-shadow: 0 0 8px rgba(47,128,237,0.24); background-color: rgba(255,255,0,0.10) !important; }
            .a11y-acc-flash { animation: a11y-flash 2.2s ease-out forwards; }
            @keyframes a11y-flash { 0% { background-color: rgba(255,255,0,0.35); } 40% { background-color: rgba(255,255,0,0.15); } 100% { background-color: transparent; } }
          `;
          this.iframeDoc.head.appendChild(s);
        }
      } catch (e) {
        console.warn("A11Yv2: could not inject styles into iframe", e);
      }

      // add highlight classes and data-index
      this.allOccurrences.forEach((occ, idx) => {
        if (!occ.selector) return;
        try {
          const el = this.iframeDoc.querySelector(occ.selector);
          if (el) {
            el.classList.add("a11y-acc-highlight");
            el.setAttribute("data-a11y-idx-v2", String(idx));
            // attach click handler to show popover for that occurrence
            if (!el._a11y_click) {
              el._a11y_click = (ev) => {
                ev.stopPropagation();
                this.focusOccurrence(idx, {
                  showPopover: true,
                  fromClick: true,
                });
              };
              el.addEventListener("click", el._a11y_click);
            }
          }
        } catch (e) {
          // skip invalid selector
        }
      });
    },

    setNavEnabled(enabled) {
      const prev = document.getElementById("a11y-prev-v2");
      const next = document.getElementById("a11y-next-v2");
      if (prev) prev.disabled = !enabled;
      if (next) next.disabled = !enabled;
    },

    navigate(delta) {
      if (!this.allOccurrences.length) return;
      let newIndex = this.currentOccurrenceIndex + delta;
      if (newIndex < 0) newIndex = 0;
      if (newIndex >= this.allOccurrences.length)
        newIndex = this.allOccurrences.length - 1;
      this.focusOccurrence(newIndex, {
        showPopover: true,
      });
    },
    highlightIssuesInAuthor() {
      if (!this.iframeDoc) return;

      // remove old
      try {
        this.iframeDoc
          .querySelectorAll(".a11y-acc-highlight,.a11y-acc-active")
          .forEach((el) =>
            el.classList.remove("a11y-acc-highlight", "a11y-acc-active")
          );
      } catch (e) {}

      // inject styles once
      if (!this.iframeDoc.getElementById("a11y-acc-style")) {
        const s = this.iframeDoc.createElement("style");
        s.id = "a11y-acc-style";
        s.textContent = `
          .a11y-acc-highlight {
            outline: 3px solid rgba(255,180,0,.9);
            background: rgba(255,235,130,.08);
            z-index: 9999;
          }
          .a11y-acc-active {
            outline: 3px solid #2f80ed !important;
            box-shadow: 0 0 12px rgba(47,128,237,.35);
            background: rgba(47,128,237,.08);
            z-index: 9999;
          }
        `;
        this.iframeDoc.head.appendChild(s);
      }

      // apply highlight to all selectors
      this.allOccurrences.forEach((occ, idx) => {
        if (!occ.selector) return;
        try {
          const el = this.iframeDoc.querySelector(occ.selector);
          //const pToggle = document.querySelector('#a11y-toggle-highlights-v2');
          //const show = pToggle ? pToggle.checked : true;
          if (!el) return;
          //this.applyHighlightsVisibility();
          el.classList.add("a11y-acc-highlight");
          el.setAttribute("data-a11y-idx-v2", idx);
        } catch (e) {}
      });
    },

    focusOccurrence(index) {
      if (!this.allOccurrences[index]) return;
      try {
        this.iframeDoc
          .querySelectorAll(".a11y-acc-active")
          .forEach((el) => el.classList.remove("a11y-acc-active"));
      } catch (e) {}
      const occ = this.allOccurrences[index];
      try {
        const el = this.iframeDoc.querySelector(occ.selector);
        if (el) {
          el.classList.add("a11y-acc-active");
          el.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      } catch (e) {}
      this.currentOccurrenceIndex = index;
    },
    showPopoverForOccurrence(index) {
      const occ = this.allOccurrences[index];
      if (!occ || !this.iframe || !this.iframe.contentWindow) return;
      // find element inside iframe
      let targetEl = null;
      try {
        targetEl = this.iframeDoc.querySelector(occ.selector);
      } catch (e) {}
      // compute content
      const htmlSnippet = this.escapeHtml(
        occ.html || occ.failureSummary || "(no snippet)"
      );
      const popContent = `
        <div style="max-width:320px;padding:8px;">
          <div style="font-weight:700;margin-bottom:6px;">${this.escapeHtml(
            occ.ruleId
          )}</div>
          <div style="font-size:13px;color:var(--coral-foreground-secondary)">${this.escapeHtml(
            occ.help || occ.failureSummary || ""
          )}</div>
          <div style="margin-top:8px;">
            <div style="font-size:12px;font-weight:600">Component</div>
            <div style="font-size:12px;color:var(--coral-foreground-secondary)">${this.escapeHtml(
              occ.componentName
            )} — ${this.escapeHtml(occ.componentType)}</div>
          </div>
          <div class="a11y-html-snippet">${htmlContext}</div>
          <div style="display:flex;gap:8px; margin-top:8px; justify-content:flex-end;">
            <button is="coral-button" variant="quiet" id="a11y-open-crx">Remediate</button>
            <button is="coral-button" variant="primary" id="a11y-close-pop">Close</button>
          </div>
        </div>
      `;
      // show popover using Coral inside top window (not inside iframe) and align near element bounding rect
      this.clearPopover();
      const pop = document.createElement("div");
      pop.id = "a11y-occ-popover-v2";
      pop.style.position = "absolute";
      pop.style.zIndex = 999999;
      pop.style.boxShadow = "0 6px 14px rgba(0,0,0,0.32)";
      pop.style.borderRadius = "8px";
      pop.style.background = "var(--coral-background)";
      pop.innerHTML = popContent;
      top.document.body.appendChild(pop);

      // position pop relative to element's bounding rect — element is inside iframe so translate coordinates
      if (targetEl) {
        try {
          const rect = targetEl.getBoundingClientRect();
          const iframeRect = this.iframe.getBoundingClientRect();
          // compute absolute coords
          const top = iframeRect.top + rect.top - 8;
          // a little offset
          const left = iframeRect.left + rect.left;
          // position pop to the right if space available, otherwise to the left
          const preferLeft = left + 340 > window.innerWidth;
          pop.style.top = `${Math.max(8, top)}px`;
          pop.style.left = preferLeft
            ? `${Math.max(8, iframeRect.left + rect.right - 340)}px`
            : `${left}px`;
        } catch (e) {
          pop.style.top = "80px";
          pop.style.right = "20px";
        }
      } else {
        // fallback
        pop.style.top = "80px";
        pop.style.right = "20px";
      }

      // wire up buttons
      const btnRem = pop.querySelector("#a11y-open-crx");
      if (btnRem)
        btnRem.addEventListener("click", () =>
          this.openCrxDe(occ.componentPath)
        );
      const btnClose = pop.querySelector("#a11y-close-pop");
      if (btnClose)
        btnClose.addEventListener("click", () => this.clearPopover());

      // clicking outside closes the popover
      const docClick = (ev) => {
        if (!pop.contains(ev.target)) this.clearPopover();
      };
      setTimeout(() => document.addEventListener("click", docClick), 20);
      // store cleanup handle
      this._popoverCleanup = () =>
        document.removeEventListener("click", docClick);
    },

    clearPopover() {
      const existing = document.getElementById("a11y-occ-popover-v2");
      if (existing) existing.remove();
      if (this._popoverCleanup) {
        try {
          this._popoverCleanup();
        } catch (e) {}
        this._popoverCleanup = null;
      }
    },

    openCrxDe(compPath) {
      // If compPath looks like /apps/..., open CRX/DE path directly
      if (!compPath || compPath === "(unknown)") {
        alert("Component path unknown — cannot open CRX/DE.");
        return;
      }
      // construct CRX/DE URL (open in new tab). This is a convention — may need environment-specific adjustment.
      // Use /crx/de/index.jsp#/path/to/node
      const host = window.location.origin;
      const crxde = `${host}/crx/de/index.jsp#${encodeURIComponent(compPath)}`;
      window.open(crxde, "_blank");
    },

    onEditorSelectionChange(editable) {
      if (!editable?.path) return;
      // toggle active class on corresponding entries in panel if any
      const rows = document.querySelectorAll(
        `#${this.panelId} .a11y-component-row`
      );
      rows.forEach((r) => {
        const path = r
          .querySelector(".a11y-component-actions")
          ?.querySelector("[data-comp]")
          ?.getAttribute("data-comp");
        if (!path) return;
        r.classList.toggle("active", path === editable.path);
      });
      // scroll the corresponding occurrence into view if it exists
      const occIdx = this.allOccurrences.findIndex(
        (o) => o.componentPath === editable.path
      );
      if (occIdx >= 0) {
        this.focusOccurrence(occIdx);
      }
    },

    escapeHtml(s) {
      if (!s) return "";
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    },

    escapeAttr(s) {
      if (!s) return "";
      return String(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },
  };

  // expose minimal API for debugging
  window.A11Y_ACCELERATOR_V2 = A11Y;

  // init after short delay (wait for AEM shell to mount)
  setTimeout(() => A11Y.init(), 500);
})(window, document, Granite.$);
