(function ($, $document) {
    "use strict";

    $document.on("foundation-contentloaded", function () {
        // Wait for components to be fully upgraded
        window.requestAnimationFrame(() => {
          document.querySelectorAll('#scan-mode coral-radio').forEach(radio => {
              radio.addEventListener('click', e => {
                document
                  .querySelectorAll('#scan-mode coral-radio')
                  .forEach(other => (other.checked = false));
                e.target.checked = true;
              });
            });
            document.querySelectorAll('input[name="scan-mode"]').forEach(radio => {
              radio.addEventListener('change', e => {
                scanMode = e.target.value;
              });
            });
        });
        
    });




})(Granite.$, $(document));