window.A11Y_CONFIG = {
  PICKER_BASE_URL: '/mnt/overlay/granite/ui/content/coral/foundation/form/pathfield/picker.html',
  ROOT_PATH: '/content',
  FILTER_TYPE: 'hierarchy',
  AXE_SCRIPT_URL: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js',
  AXE_OPTIONS: {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
    },
    rules: {
      'document-title': { enabled: true },
      'image-alt': { enabled: true },
      'color-contrast': { enabled: true }
    }
  }
};

window.getPageURL = function (path) {
  const baseOrigin = window.location.origin;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseOrigin}${cleanPath}.html`;
};
