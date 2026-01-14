/* a11y-wcag-mapping.js
   Mapping of axe-core "best-practice" rules -> suggested WCAG references
   NOTE: review/mutate to match your organization's policy.
*/

window.AXE_BESTPRACTICE_WCAG_MAP = {
  // Structural / landmarks / headings
  "region": "WCAG 1.3.1 (A), 2.4.1 (A)",
  "empty-heading": "WCAG 1.3.1 (A)",
  "heading-order": "WCAG 1.3.1 (A)",
  "landmark-unique": "WCAG 1.3.1 (A)",
  "landmark-one-main": "WCAG 1.3.1 (A)",
  "landmark-no-duplicate-contentinfo": "WCAG 1.3.1 (A)",
  "main-island": "WCAG 1.3.1 (A)",

  // ARIA / roles / attributes (diagnostic, but tie to Name/Role/Value)
  "aria-allowed-attr": "WCAG 4.1.2 (A)",
  "aria-prohibited-attr": "WCAG 4.1.2 (A)",
  "aria-required-attr": "WCAG 4.1.2 (A)",
  "aria-required-parent": "WCAG 4.1.2 (A)",
  "aria-roles": "WCAG 4.1.2 (A)",
  "aria-allowed-role": "WCAG 4.1.2 (A)",
  "presentation-role-conflict": "WCAG 4.1.2 (A)",
  "aria-hidden-focus": "WCAG 4.1.2 (A)",
  "aria-hidden-body": "WCAG 4.1.2 (A)",

  // Name/Label/value / form
  "labels": "WCAG 4.1.2 (A)",
  "label-title-only": "WCAG 4.1.2 (A)",
  "labelable-control": "WCAG 4.1.2 (A)",
  "form-field-multiple-labels": "WCAG 4.1.2 (A)",
  "duplicate-id-aria": "WCAG 4.1.1 (A)",

  // Links / navigation / skip links
  "skip-link": "WCAG 2.4.1 (A)",
  "bypass": "WCAG 2.4.1 (A)",
  "identical-links-same-purpose": "WCAG 2.4.9 (AA)",
  "link-in-text-block": "WCAG 2.4.4 (A)",
  "skip-to-main": "WCAG 2.4.1 (A)",

  // Focus & keyboard
  "nested-interactive": "WCAG 4.1.2 (A)",
  "scrollable-region-focusable": "WCAG 2.1.1 (A), 2.1.3 (A)",
  "control-focusable": "WCAG 2.1.1 (A)",
  "focusable-content": "WCAG 2.1.1 (A)",
  "focus-order-semantics": "WCAG 2.4.3 (A)",

  // Visual / target / interaction sizes
  "target-size": "WCAG 2.5.8 (AA) [WCAG 2.2/2.5]",
  "touch-area": "WCAG 2.5.8 (AA)",
  "interactive-supports-focus": "WCAG 2.1.1 (A)",

  // Hidden / visibility / presentation issues
  "hidden-content": "WCAG 1.3.1 (A), 4.1.2 (A)",
  "hidden-focusable": "WCAG 4.1.2 (A)",
  "visual-order-follows-dom": "WCAG 1.3.2 (AA)",
  "focusable-offscreen": "WCAG 2.4.3 (A)",

  // Images / text alternatives (best-practice ones; core WCAG-mapped rules will have wcag tags)
  "image-redundant-alt": "WCAG 1.1.1 (A)",
  "decorative-image-alt": "WCAG 1.1.1 (A)",
  "complex-image-caption": "WCAG 1.1.1 (A), 1.3.1 (A)",

  // Tables / captions / headers
  "table-duplicate-name": "WCAG 1.3.1 (A)",
  "table-fake-caption": "WCAG 1.3.1 (A)",
  "td-has-header": "WCAG 1.3.1 (A)",

  // Frames / iframes
  "frame-tested": "WCAG 4.1.2 (A), 2.4.1 (A)",
  "frame-title-unique": "WCAG 2.4.1 (A)",

  // Meta tags / viewport / refresh
  "meta-refresh": "WCAG 2.2.1 (A)",
  "meta-viewport": "WCAG 1.4.4 (AA)",
  "html-has-lang": "WCAG 3.1.1 (A)",
  "valid-lang": "WCAG 3.1.2 (AA)",

  // Performance/usability best practice
  "identical-links-same-purpose": "WCAG 2.4.9 (AA)",
  "duplicate-id": "WCAG 4.1.1 (A)",

  // Misc / other advisories
  "presentation-role-conflict": "WCAG 4.1.2 (A)",
  "scrollable-region-focusable": "WCAG 2.1.1 (A)",
  "css-orientation-lock": "WCAG 1.3.1 (A)",
  "meta-redirect": "WCAG 2.2.1 (A)",

  // Generic fallback for other best-practice rules not enumerated
  // (optional: the code that reads this map can use this fallback label)
  "__FALLBACK_BEST_PRACTICE": "Advisory (Best Practice) — review; related SCs may include 1.3.1, 4.1.2"
};
