import { A11Y_CONFIG } from './config.js';

export function configurePathField(pathField, scanMode = 'single') {
  const { PICKER_BASE_URL, ROOT_PATH, FILTER_TYPE } = A11Y_CONFIG;
  const SELECTION_COUNT = scanMode === 'single' ? 'single' : 'multiple';
  const selectionType = scanMode === 'single' ? 'cq:Page' : 'hierarchy';
  
  const pickerSrc = `${PICKER_BASE_URL}?_charset_=utf-8`
    + `&root=${ROOT_PATH}`
    + `&filter=${FILTER_TYPE}`
    + `&selectionCount=${SELECTION_COUNT}`
    + `&type=${encodeURIComponent(selectionType)}`;

  pathField.id = 'scan-pathfield';
  pathField.setAttribute('pickersrc', pickerSrc);
  pathField.setAttribute('multiple', scanMode === 'multiple');

  const tagList = pathField.querySelector('coral-taglist');
  if (tagList) tagList.items.clear();

  pathField.addEventListener('foundation-autocomplete:selected', e => {
    const taglist = pathField.querySelector('coral-taglist');
    if (taglist && e.detail?.item) {
      const value = e.detail.item.value || e.detail.item.textContent.trim();
      if (![...taglist.items.getAll()].some(t => t.value === value)) {
        const tag = document.createElement('coral-tag');
        tag.value = value;
        tag.textContent = value;
        taglist.appendChild(tag);
      }
    }
  });
}

