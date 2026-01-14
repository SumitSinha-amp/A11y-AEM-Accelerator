(function (window, document, $) {
  'use strict';

  // Only run in top window (not inside iframe)
  if (window !== window.top) {
    console.log('🚫 Skipping A11y Accelerator inside iframe context.');
    return;
  }

  // Global guard to prevent multiple executions
  if (window.__A11Y_SCANNER_INIT__) {
    console.log('♿ A11y Accelerator already initialized — skipping reinit.');
    return;
  }
  window.__A11Y_SCANNER_INIT__ = true;

  const AuthorScanner = {
    toggleInjected: false,
    iframe: null,
    iframeDoc: null,
    allIssues: [],
    currentIssueIndex: 0,
    navElements: null,

    // entry point
    async init() {
      if (!window.location.pathname.includes('/editor.html')) {
        console.log('🚫 Not in author mode');
        return;
      }
      console.log('✅ A11y Accelerator initializing...');
      try {
        await this.waitForToolbar();
        this.injectToggle();
        this.observeToolbarChanges();
      } catch (err) {
        console.warn('⚠️ A11y init: toolbar not found', err);
      }
    },

    // wait for the coral actionbar area
    async waitForToolbar(timeout = 8000) {
      return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = setInterval(() => {
          const toolbar = document.querySelector('.coral3-ActionBar-secondary');
          if (toolbar) {
            clearInterval(check);
            resolve(toolbar);
          } else if (Date.now() - start > timeout) {
            clearInterval(check);
            reject('Toolbar not found within timeout');
          }
        }, 250);
      });
    },

    // watch for re-renders and re-inject safely
    observeToolbarChanges() {
      const observer = new MutationObserver(() => {
        // If toolbar lost our button (e.g. re-render), re-inject one time
        if (!document.getElementById('a11y-toolbar-toggle')) {
          this.toggleInjected = false;
          // small delay to let Coral do its layout
          setTimeout(() => this.injectToggle(), 200);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    },

    // inject single toggle button to AEM actionbar
    injectToggle() {
      if (this.toggleInjected || document.getElementById('a11y-toolbar-toggle')) return;
      const toolbar = document.querySelector('.coral3-ActionBar-secondary');
      if (!toolbar) return console.warn('⚠️ Toolbar not ready for injection');

      const btn = document.createElement('button');
      btn.id = 'a11y-toolbar-toggle';
      btn.setAttribute('is', 'coral-button');
      btn.setAttribute('variant', 'quiet');
      btn.setAttribute('title', 'Toggle A11y Accelerator');
      btn.setAttribute('aria-pressed', 'false');

      // simple icon
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="color: #cfe8ff;">
          <path fill="currentColor" d="M12 2a2 2 0 012 2v2h3a1 1 0 01.8 1.6L14 15v4a1 1 0 01-1.6.8L7 17H4a1 1 0 01-1-1V6a2 2 0 012-2h7z"></path>
        </svg>
      `;

      // styling to blend in
      btn.style.width = '36px';
      btn.style.height = '36px';
      btn.style.borderRadius = '6px';
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.style.marginLeft = '6px';

      toolbar.appendChild(btn);
      this.toggleInjected = true;
      console.log('✅ A11y toggle injected');

      btn.addEventListener('click', () => {
        const panel = document.getElementById('a11y-panel');
        if (panel && panel.classList.contains('slide-in')) {
          this.closePanel();
          btn.setAttribute('aria-pressed', 'false');
        } else {
          this.openPanel();
          btn.setAttribute('aria-pressed', 'true');
        }
      });
    },

    // open panel using coral-panelstack-like markup (so it looks integrated)
    openPanel() {
      // If exists, just show
      let panel = document.getElementById('a11y-panel');
      if (panel) {
        panel.classList.add('slide-in');
        return;
      }

      panel = document.createElement('div');
      panel.id = 'a11y-panel';
      panel.className = 'a11y-panel';
      panel.innerHTML = `
        <coral-panelstack id="a11y-panelstack" class="a11y-panelstack" selected>
          <coral-panel id="a11y-main-panel" class="a11y-main-panel" selected>
            <coral-panel-header>
              ♿ Accessibility Accelerator
            </coral-panel-header>

            <div class="a11y-panel-body">
              <button id="a11y-scan-btn" is="coral-button" variant="primary" icon="search">Scan Page</button>

              <div class="a11y-toggle-row">
                <span>Show highlights</span>
                <label class="a11y-switch">
                  <input type="checkbox" id="a11y-toggle-highlights" checked>
                  <span class="a11y-slider"></span>
                </label>
              </div>

              <div id="a11y-navigator" style="display:none; margin-bottom:8px;">
                <button id="a11y-prev-panel" class="a11y-nav-btn" disabled>◀ Prev</button>
                <span id="a11y-count-panel">0 / 0</span>
                <button id="a11y-next-panel" class="a11y-nav-btn" disabled>Next ▶</button>
              </div>

              <div id="a11y-results" class="a11y-results">No scan run yet.</div>
            </div>
          </coral-panel>
        </coral-panelstack>
      `;

      document.body.appendChild(panel);

      // Add CSS once
      if (!document.getElementById('a11y-panel-style')) {
        const style = document.createElement('style');
        style.id = 'a11y-panel-style';
        style.textContent = `
          /* Panel (integrated) */
          #a11y-panel {
            position: fixed;
            top: 48px;
            right: 0;
            width: 420px;
            height: calc(100vh - 48px);
            background: linear-gradient(180deg,#1b1b1b,#0f0f0f);
            border-left: 1px solid rgba(255,255,255,0.06);
            box-shadow: -4px 0 20px rgba(0,0,0,0.6);
            transform: translateX(100%);
            opacity: 0;
            transition: transform 0.33s ease, opacity 0.33s ease;
            z-index: 2147483000;
            display:flex;
            flex-direction:column;
            font-family: "Adobe Clean", Arial, sans-serif;
          }
          #a11y-panel.slide-in { transform: translateX(0); opacity:1; }

          .a11y-panel-body { padding: 12px; overflow-y:auto; color:#e8eef8; flex:1; }
          #a11y-scan-btn { width:100%; margin-bottom:10px; }

          .a11y-toggle-row { display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:8px; margin-bottom:10px; color:#d6e9ff; }
          .a11y-nav-btn { padding:6px 8px; border-radius:6px; background:transparent; border:1px solid rgba(255,255,255,0.06); color:#e6f5ff; cursor:pointer; }
          .a11y-nav-btn:disabled { opacity:0.45; cursor:not-allowed; }

          .a11y-results { margin-top:8px; background: rgba(255,255,255,0.02); border-radius:6px; padding:6px; color:#cddff8; min-height:120px; }

          /* small switch */
          .a11y-switch { position:relative; width:44px; height:22px; display:inline-block; }
          .a11y-switch input { display:none; }
          .a11y-slider { position:absolute; left:0; top:0; right:0; bottom:0; background:rgba(255,255,255,0.12); border-radius:22px; transition:background 0.25s; }
          .a11y-slider::before { content:""; position:absolute; left:2px; top:2px; width:18px; height:18px; background:#fff; border-radius:50%; transition:transform 0.25s; }
          .a11y-switch input:checked + .a11y-slider { background: linear-gradient(90deg,#007aff,#00bfff); }
          .a11y-switch input:checked + .a11y-slider::before { transform: translateX(22px); }

          .a11y-issue-row { padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.03); cursor:pointer; }
          .a11y-issue-row:hover { background: rgba(255,255,255,0.02); }
          .a11y-issue-main { display:flex; justify-content:space-between; align-items:center; }
          .a11y-issue-meta { font-size:12px; color:#9fbff6; margin-top:6px; font-family: monospace; }
        `;
        document.head.appendChild(style);
      }

      // show panel
      requestAnimationFrame(() => panel.classList.add('slide-in'));

      // wire close
      panel.querySelector('#a11y-close')?.addEventListener('click', () => this.closePanel());

      // wire scan button
      const scanBtn = panel.querySelector('#a11y-scan-btn');
      if (scanBtn) {
        if (scanBtn._a11y_handler) scanBtn.removeEventListener('click', scanBtn._a11y_handler);
        scanBtn._a11y_handler = () => this.runScan();
        scanBtn.addEventListener('click', scanBtn._a11y_handler);
      }

      // wire highlight toggle
      const toggle = panel.querySelector('#a11y-toggle-highlights');
      if (toggle) {
        // restore preference
        const saved = localStorage.getItem('a11y-highlights');
        toggle.checked = saved !== 'off';
        toggle.addEventListener('change', () => {
          localStorage.setItem('a11y-highlights', toggle.checked ? 'on' : 'off');
          this.applyHighlightVisibility(toggle.checked);
        });
      }

      // wire navigator in panel
      const prev = panel.querySelector('#a11y-prev-panel');
      const next = panel.querySelector('#a11y-next-panel');
      const count = panel.querySelector('#a11y-count-panel');
      this.navElements = { prev, next, count, nav: panel.querySelector('#a11y-navigator') };
      prev.addEventListener('click', () => this.navigateIssue(-1));
      next.addEventListener('click', () => this.navigateIssue(1));

      // if there were previous scan results in localStorage, restore them
      this.restoreLastScan();
    },

    closePanel() {
      const panel = document.getElementById('a11y-panel');
      if (panel) panel.classList.remove('slide-in');
    },

    // show/hide highlights quickly by toggling a body class inside iframe
    applyHighlightVisibility(show) {
      const iframeDoc = this.iframe?.contentDocument;
      if (!iframeDoc) return;
      if (show) {
        iframeDoc.body.classList.remove('a11y-hide-highlights');
      } else {
        iframeDoc.body.classList.add('a11y-hide-highlights');
      }

      // enable/disable navigator buttons
      this.setNavigatorEnabled(!!show && this.allIssues && this.allIssues.length > 0);
    },

    setNavigatorEnabled(enabled) {
      if (!this.navElements) return;
      const { prev, next, nav } = this.navElements;
      if (!prev || !next || !nav) return;
      prev.disabled = !enabled;
      next.disabled = !enabled;
      nav.style.opacity = enabled ? '1' : '0.6';
    },

    // restore previous scan from localStorage if present for same page
    restoreLastScan() {
      const panel = document.getElementById('a11y-panel');
      if (!panel) return;
      const resultsEl = panel.querySelector('#a11y-results');
      try {
        const iframeCandidates = Array.from(document.querySelectorAll('iframe'));
        const frame = iframeCandidates.find(f => {
          try { return f && f.contentWindow && f.contentDocument; } catch (e) { return false; }
        });
        const pageKey = frame?.contentWindow?.location?.pathname || 'unknown';
        const saved = localStorage.getItem('a11y-last-scan:' + pageKey);
        if (!saved) return;
        const parsed = JSON.parse(saved);
        // show minimal summary and allow reapply highlights
        resultsEl.innerHTML = `<div style="color:#cddff8">Restored scan from ${new Date(parsed.ts).toLocaleString()}</div>`;
        // attach parsed results so user can re-run navigator/highlights
        this.allIssues = parsed.results || [];
        // re-highlight if user preference on
        const toggle = panel.querySelector('#a11y-toggle-highlights');
        const show = toggle ? toggle.checked : true;
        if (this.allIssues.length && show) {
          // need to set iframe references before highlighting
          this.iframe = frame;
          this.iframeDoc = this.iframe.contentDocument;
          setTimeout(() => { this.highlightIssues(); this.createNavigator(); this.setNavigatorEnabled(true); }, 250);
        }
      } catch (e) {
        // ignore restore errors
      }
    },

    // main scan runner
    async runScan() {
      console.log('A11y: runScan start');
      this.allIssues = [];
      this.currentIssueIndex = 0;

      const panel = document.getElementById('a11y-panel');
      const resultsEl = panel?.querySelector('#a11y-results');
      if (resultsEl) resultsEl.innerHTML = 'Locating author content...';

      // find iframe (prefer named content frames)
      const selectors = ['iframe#ContentFrame', 'iframe.EditorFrame', 'iframe[id^="ContentFrame"]', 'iframe'];
      let frame = null;
      for (const sel of selectors) {
        try {
          const candidate = document.querySelector(sel);
          if (candidate && candidate.contentDocument && candidate.contentWindow) { frame = candidate; break; }
        } catch (e) {}
      }
      // fallback to first accessible
      if (!frame) {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        for (const f of iframes) {
          try { if (f.contentDocument && f.contentWindow) { frame = f; break; } } catch(e) {}
        }
      }
      if (!frame) {
        if (resultsEl) resultsEl.innerHTML = '<div style="color:#ffb86b">No same-origin content iframe found (scan cannot run).</div>';
        return;
      }
      this.iframe = frame;
      this.iframeDoc = frame.contentDocument;

      // wait for iframe ready
      const waitForReady = (doc, timeout = 8000) => new Promise((resolve, reject) => {
        const start = Date.now();
        (function check() {
          try {
            if (!doc) return reject('no doc');
            if (doc.readyState === 'complete' || doc.readyState === 'interactive') return resolve();
          } catch (e) { return reject(e); }
          if (Date.now() - start > timeout) return reject('timeout waiting for iframe ready');
          setTimeout(check, 150);
        })();
      });
      try {
        await waitForReady(this.iframeDoc, 8000);
      } catch (err) {
        if (resultsEl) resultsEl.innerHTML = `<div style="color:#ffb86b">Iframe not ready or inaccessible: ${String(err)}</div>`;
        return;
      }

      // inject axe-core if missing
      try {
        if (!frame.contentWindow.axe) {
          const s = this.iframeDoc.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
          this.iframeDoc.head.appendChild(s);
          await new Promise((res, rej) => {
            s.onload = () => res();
            s.onerror = () => rej(new Error('failed loading axe-core'));
            setTimeout(() => rej(new Error('timeout loading axe-core')), 8000);
          });
          console.log('A11y: axe injected');
        } else {
          console.log('A11y: axe already present');
        }
      } catch (err) {
        if (resultsEl) resultsEl.innerHTML = `<div style="color:#ff7a7a">Error injecting axe-core: ${String(err)}</div>`;
        return;
      }

      // run axe
      const axeOptions = { resultTypes: ['violations', 'incomplete'], reporter: 'v2' };
      let results;
      try {
        results = await Promise.race([
          frame.contentWindow.axe.run(frame.contentDocument, axeOptions),
          new Promise((_, rej) => setTimeout(() => rej(new Error('axe.run timeout')), 30000))
        ]);
      } catch (err) {
        if (resultsEl) resultsEl.innerHTML = `<div style="color:#ff7a7a">Scan failed: ${String(err)}</div>`;
        console.error('A11y: axe.run failed', err);
        return;
      }

      // normalize occurrences: prefer violations then incomplete
      const occurrences = [];
      (results.violations || []).forEach(v => {
        (v.nodes || []).forEach(node => occurrences.push({ id: v.id, impact: v.impact, help: v.help || v.description, node }));
      });
      (results.incomplete || []).forEach(v => {
        (v.nodes || []).forEach(node => occurrences.push({ id: v.id, impact: v.impact, help: v.help || v.description, node }));
      });

      // Build allIssues with usable selector, rawTarget, html, and try to map to Granite.editables if available
      const editables = (window.Granite && Granite.author && Granite.author.editables) ? Granite.author.editables : [];
      const mapped = occurrences.map((o) => {
        const raw = Array.isArray(o.node.target) && o.node.target.length ? o.node.target[0] : null;
        let selector = raw;
        // try to validate selector in iframe context
        if (selector) {
          try {
            this.iframeDoc.querySelector(selector);
          } catch (e) {
            // fallback: remove quotes
            const cleaned = selector.replace(/["']/g, '');
            try { this.iframeDoc.querySelector(cleaned); selector = cleaned; }
            catch (e2) { selector = null; }
          }
        }
        // try to find element and component mapping
        let compPath = '(unknown)';
        let compType = '(unmapped)';
        let html = o.node.html || null;
        try {
          if (selector) {
            const el = this.iframeDoc.querySelector(selector);
            if (el) {
              // try to map to Granite editable containing this element
              try {
                const cmp = editables.find(ed => ed.dom && ed.dom.get && ed.dom.get(0).contains(el));
                if (cmp) {
                  compPath = cmp.path || compPath;
                  compType = cmp.type || compType;
                }
              } catch (e) {}
            }
          }
        } catch (e) {}
        return {
          rule: o.id,
          impact: o.impact,
          help: o.help,
          selector: selector,
          rawTarget: raw,
          html: html,
          componentPath: compPath,
          componentType: compType
        };
      });

      this.allIssues = mapped;

      // persist per page
      try {
        const pageKey = frame.contentWindow?.location?.pathname || 'unknown';
        localStorage.setItem('a11y-last-scan:' + pageKey, JSON.stringify({ ts: Date.now(), results: mapped }));
      } catch (e) {}

      // render results in panel
      if (resultsEl) {
        resultsEl.innerHTML = '';
        if (!mapped.length) {
          resultsEl.innerHTML = '<div style="color:#bfe1ff">No issues found 🎉</div>';
        } else {
          mapped.forEach((m, idx) => {
            const row = document.createElement('div');
            row.className = 'a11y-issue-row';
            row.dataset.a11yIndex = String(idx);
            row.innerHTML = `
              <div class="a11y-issue-main"><div><strong>${m.rule}</strong></div><div style="font-size:12px;color:#cfe8ff">${m.impact || ''}</div></div>
              <div class="a11y-issue-meta">${(m.componentType||'')}&nbsp; <span class="a11y-path">${m.componentPath || ''}</span></div>
            `;
            // click focuses on component in editor (if mapped) and highlights that occurrence
            row.addEventListener('click', (ev) => {
              this.focusIssue(idx);
              // if component path known, attempt to select in editor
              if (m.componentPath && m.componentPath !== '(unknown)') {
                this.selectComponentInEditor(m.componentPath);
              }
            });
            resultsEl.appendChild(row);
          });
        }
      }

      // apply highlights and navigator if there are queryable selectors
      const hasQueryable = this.allIssues.some(i => i.selector);
      if (hasQueryable) {
        this.highlightIssues();   // adds highlights to iframe and installs hover tooltip handlers
        this.createNavigator();   // fill panel navigator controls
        // apply toggle preference
        const pToggle = document.querySelector('#a11y-toggle-highlights');
        const show = pToggle ? pToggle.checked : true;
        this.applyHighlightVisibility(show);
      } else {
        const nav = document.getElementById('a11y-navigator');
        if (nav) nav.style.display = 'none';
        console.warn('A11y: no queryable selectors found');
      }

      console.log('A11y: scan complete', { total: this.allIssues.length });
    },

    // add highlight CSS & apply highlight classes and hover tooltip handlers inside iframe
    highlightIssues() {
      const doc = this.iframeDoc;
      if (!doc) return;

      // remove existing highlights & tooltip
      try { doc.querySelectorAll('.a11y-highlight').forEach(el => el.classList.remove('a11y-highlight','active')); } catch (e) {}
      const existingTooltip = doc.getElementById('a11y-hover-tooltip');
      if (existingTooltip) existingTooltip.remove();

      // ensure style injected once
      if (!doc.getElementById('a11y-highlight-style')) {
        const s = doc.createElement('style');
        s.id = 'a11y-highlight-style';
        s.textContent = `
          .a11y-highlight { outline: 3px solid rgba(255,180,0,0.95); background: rgba(255,235,130,0.08); transition: outline 160ms, box-shadow 160ms; }
          .a11y-highlight.active { outline: 3px solid #66b3ff !important; box-shadow: 0 0 12px rgba(102,179,255,0.28); background: rgba(102,179,255,0.06); }
          body.a11y-hide-highlights .a11y-highlight { outline: none !important; background: transparent !important; box-shadow:none !important; }
          /* tooltip inside iframe */
          #a11y-hover-tooltip {
            position: absolute;
            z-index: 2147483600;
            background: rgba(10,10,10,0.95);
            color: #f2f9ff;
            padding: 8px 10px;
            border-radius: 6px;
            max-width: 320px;
            font-size: 12px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.6);
            display:none;
          }
          #a11y-hover-tooltip .html-snippet { font-family: monospace; font-size:11px; color:#d6f0ff; margin-top:6px; max-height:120px; overflow:auto; background: rgba(255,255,255,0.02); padding:6px; border-radius:4px; }
          #a11y-hover-tooltip .remediate { display:inline-block; margin-top:8px; padding:6px 8px; background: linear-gradient(90deg,#007aff,#00bfff); color:#00172a; border-radius:6px; text-decoration:none; font-weight:600; }
        `;
        doc.head.appendChild(s);
      }

      // create tooltip element inside iframe
      const tooltip = doc.createElement('div');
      tooltip.id = 'a11y-hover-tooltip';
      tooltip.setAttribute('role','tooltip');
      doc.body.appendChild(tooltip);

      // Add highlights for each occurrence that has a selector
      this.allIssues.forEach((issue, idx) => {
        if (!issue.selector) return;
        try {
          const el = doc.querySelector(issue.selector);
          if (!el) return;

          el.classList.add('a11y-highlight');
          el.setAttribute('data-a11y-idx', String(idx));
          el.style.transition = 'outline 0.16s, background 0.16s';

          // hover handlers: show tooltip with issue.help and html snippet
          el.addEventListener('mouseenter', (ev) => {
            const t = doc.getElementById('a11y-hover-tooltip');
            if (!t) return;
            t.innerHTML = `<div style="font-weight:700">${issue.rule}</div>
                           <div style="color:#cfe8ff;margin-top:6px">${(issue.help||'').slice(0,240)}</div>
                           ${issue.html ? `<div class="html-snippet">${escapeHtml(issue.html).slice(0,600)}</div>` : ''}
                           ${issue.componentPath && issue.componentPath !== '(unknown)' ? `<a class="remediate" href="${remediateUrl(issue.componentPath)}" target="_blank" rel="noopener">Remediate</a>` : ''}`;
            t.style.display = 'block';
            positionTooltip(doc, t, el);
          });

          el.addEventListener('mouseleave', () => {
            const t = doc.getElementById('a11y-hover-tooltip');
            if (t) t.style.display = 'none';
          });

        } catch (e) {
          // invalid selector, skip
        }
      });

      // helper to reposition tooltip on scroll
      try {
        doc.addEventListener('scroll', () => {
          const t = doc.getElementById('a11y-hover-tooltip');
          if (!t || t.style.display !== 'block') return;
          // find active hovered element by :hover - not reliable; we reposition all tooltips by reading data attribute.
          // skip heavy logic here to keep things simple
        }, true);
      } catch(e){}

      // utility functions inside closure
      function positionTooltip(doc, tooltipEl, targetEl) {
        try {
          const rect = targetEl.getBoundingClientRect();
          const docEl = doc.documentElement;
          const left = rect.left + (rect.width / 2) - 160; // center tooltip approx
          let top = rect.top - 10 - tooltipEl.offsetHeight;
          if (top < 8) top = rect.bottom + 10;
          tooltipEl.style.left = (left < 8 ? 8 : left) + 'px';
          tooltipEl.style.top = (top + (doc.defaultView?.scrollY || 0)) + 'px';
        } catch (e) {}
      }
      function escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
      }
      function remediateUrl(path) {
        // open CRXDE for that path - best-effort
        return '/crx/de/index.jsp#' + encodeURIComponent(path);
      }
    },

    // create navigator controls inside the panel (not inside iframe)
    createNavigator() {
      const panel = document.getElementById('a11y-panel');
      if (!panel) return;
      const nav = panel.querySelector('#a11y-navigator');
      const countEl = panel.querySelector('#a11y-count-panel');
      const prev = panel.querySelector('#a11y-prev-panel');
      const next = panel.querySelector('#a11y-next-panel');
      if (!nav || !countEl || !prev || !next) return;

      if (!this.allIssues.length) {
        nav.style.display = 'none';
        return;
      }
      nav.style.display = 'flex';
      this.currentIssueIndex = 0;
      countEl.textContent = `1 / ${this.allIssues.length}`;
      // wire
      prev.disabled = true;
      next.disabled = this.allIssues.length <= 1;
      prev.onclick = () => this.navigateIssue(-1);
      next.onclick = () => this.navigateIssue(1);
      // store nav elements for enabling/disabling
      this.navElements = { prev, next, count: countEl, nav };
      this.setNavigatorEnabled(true);
    },

    navigateIssue(dir) {
      const newIndex = this.currentIssueIndex + dir;
      if (newIndex < 0 || newIndex >= this.allIssues.length) return;
      this.focusIssue(newIndex);
    },

    // focusing an issue will add .active class to the element in iframe and scroll to it
    focusIssue(index) {
      const doc = this.iframeDoc;
      if (!doc) return;
      const issue = this.allIssues[index];
      if (!issue) return;

      // remove previous active highlight
      try { doc.querySelectorAll('.a11y-highlight.active').forEach(el => el.classList.remove('active')); } catch(e) {}

      // find element by data attribute first (we set data-a11y-idx)
      let target = doc.querySelector(`[data-a11y-idx="${index}"]`);
      if (!target && issue.selector) {
        try { target = doc.querySelector(issue.selector); } catch(e) { target = null; }
      }
      if (target) {
        target.classList.add('active');
        try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}
        // briefly flash yellow highlight to mimic "yellow highlighter for few seconds"
        const origOutline = target.style.outline;
        target.style.outline = '4px solid rgba(255,230,80,0.95)';
        setTimeout(()=> {
          // reset to active style
          target.style.outline = '';
          // ensure active class still present so active styling applies
          target.classList.add('active');
        }, 1400);
      } else {
        console.warn('A11y: cannot find element to focus for issue', index, issue.selector);
      }

      // update nav counter in panel
      if (this.navElements && this.navElements.count) {
        this.navElements.count.textContent = `${index + 1} / ${this.allIssues.length}`;
        this.navElements.prev.disabled = index <= 0;
        this.navElements.next.disabled = index >= (this.allIssues.length - 1);
      }
      this.currentIssueIndex = index;
    },

    // safer selection in author UI — guard every call
    selectComponentInEditor(path) {
      try {
        if (!window.Granite || !Granite.author) {
          console.warn('A11y: Granite.author not available');
          return;
        }
        // find editable
        const editable = (Granite.author.editables || []).find(ed => ed.path === path);
        if (!editable) {
          console.warn('A11y: editable not found for path', path);
          return;
        }

        // selection APIs differ between versions; guard them
        try {
          if (Granite.author.selection && typeof Granite.author.selection.select === 'function') {
            Granite.author.selection.select(editable);
          } else if (Granite.author.editorLayerManager && typeof Granite.author.editorLayerManager.select === 'function') {
            Granite.author.editorLayerManager.select(editable);
          } else if (typeof Granite.author.editable === 'function') {
            // older fallback; try to select via editables API
            editable.select && editable.select();
          }
        } catch (e) {
          console.warn('A11y: selection API threw, ignoring', e);
        }

        // try to reposition overlay manager if present but guard against missing functions
        try {
          const overlayMgr = Granite.author.ui?.overlayManager || Granite.author.overlayManager || Granite.author?.editing?.overlayManager;
          if (overlayMgr && typeof overlayMgr.reposition === 'function') {
            overlayMgr.reposition();
          } else if (overlayMgr && typeof overlayMgr.repositionAll === 'function') {
            overlayMgr.repositionAll();
          }
        } catch (e) {
          // do not let this break selection — log and continue
          console.warn('A11y: overlay manager reposition failed (ignored)', e);
        }

        // scroll editable into view
        try {
          const dom = editable.dom && editable.dom.get && editable.dom.get(0);
          if (dom && typeof dom.scrollIntoView === 'function') dom.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {}

        console.log('A11y: selected component', path);
      } catch (e) {
        console.error('A11y: selectComponentInEditor error', e);
      }
    }
  };

  // expose
  window.AuthorScanner = AuthorScanner;

  // init on AEM foundation-contentloaded (and small fallback timeout)
  $(document).on('foundation-contentloaded', () => {
    setTimeout(() => AuthorScanner.init(), 250);
  });

  // keep selection sync: when author selection changes, highlight corresponding row
  $(window).on('cq-editor-selectionchange', (e, editable) => {
    try {
      if (!editable?.path) return;
      const rows = document.querySelectorAll('.a11y-issue-row');
      rows.forEach(r => r.classList.toggle('active', r.dataset.compPath === editable.path));
      const activeRow = document.querySelector(`.a11y-issue-row[data-comp-path="${editable.path}"]`);
      if (activeRow) activeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      console.log('A11y: synced selection to issues panel for', editable.path);
    } catch (e) {}
  });

})(window, document, Granite.$);
