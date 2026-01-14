(function(document, $) {
    "use strict";

    // 1. Selector for your custom pathfield
    // We use the ID to specifically target your element, but a class is better for reusability.
    const PATHFIELD_SELECTOR = '#rootPath';
    const VALUE_FIELD_NAME = 'value'; // Name of the property for setting the path value

    // Function to handle the opening of the path picker dialog
    function openPathPicker(pathFieldElement) {
        const pickerSrc = pathFieldElement.getAttribute('pickersrc');

        if (!pickerSrc) {
            console.error("PathField does not have a 'pickersrc' attribute.");
            return;
        }

        // Get the current value from the pathfield to pre-select it in the picker
        const currentValue = pathFieldElement[VALUE_FIELD_NAME] || pathFieldElement.getAttribute(VALUE_FIELD_NAME) || '';

        // The pickerSrc may already contain 'root', so handle both cases
        let finalPickerSrc = pickerSrc;
        if (pickerSrc.indexOf('selection=') === -1) {
             finalPickerSrc += (pickerSrc.indexOf('?') > -1 ? '&' : '?') + 'selection=' + encodeURIComponent(currentValue);
        }

        // Create a new Picker Dialog and open it
        const picker = new Coral.Dialog().set({
            content: {
                // Load the picker content into the dialog
                innerHTML: `<iframe src="${finalPickerSrc}" class="granite-pathfield-picker-iframe"></iframe>`
            },
            fullscreen: true,
            closable: true,
            variant: 'fullscreen',
            backdrop: 'static'
        });

        // Add the dialog to the DOM and show it
        document.body.appendChild(picker);
        picker.show();

        // 2. Event listener for when a path is selected (sent from the iframe)
        const closeListener = (event) => {
            // Check if the event came from the path picker iframe
            if (event.data && event.data.type === 'PATH_SELECTED') {
                const selectedPath = event.data.path;

                // Update the pathfield's value.
                // You must use the Coral API to set the value for the component to update correctly.
                pathFieldElement[VALUE_FIELD_NAME] = selectedPath;

                // Manually dispatch the 'change' event to trigger Granite UI validation/listeners
                pathFieldElement.dispatchEvent(new Event('change', { bubbles: true }));

                // Close the dialog
                picker.hide();
            }
        };

        window.addEventListener('message', closeListener);

        // Clean up the listener when the dialog is hidden
        picker.on('coral-overlay:close', () => {
            window.removeEventListener('message', closeListener);
            // Remove the dialog element from the DOM after it closes
            picker.remove();
        });
    }

    // 3. Main Initialization and Event Binding
    $(document).on('foundation-contentloaded', function(e) {
        // Find your custom pathfield element
        const pathFieldElement = document.querySelector(PATHFIELD_SELECTOR);

        if (pathFieldElement) {
            // The coral-pathfield has a built-in button, but the *Granite* one is a separate trigger.
            // For a custom pathfield, the standard browse button is a Coral.Button with class:
            const browseButton = pathFieldElement.querySelector('button.coral-DecoratedTextfield-button');

            if (browseButton) {
                // Attach the click handler to the browse button
                browseButton.addEventListener('click', function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    openPathPicker(pathFieldElement);
                });
            } else {
                console.warn(`Browse button not found for custom pathfield with ID: ${PATHFIELD_SELECTOR}`);
            }

            // Ensure the Coral element is upgraded if it's raw HTML outside of a Granite context
            if (pathFieldElement.is && pathFieldElement.is.toLowerCase() === 'coral-pathfield' && !pathFieldElement._isPolyfilled) {
                 Coral.commons.ready(pathFieldElement);
            }
        }
    });

})(document, Granite.$);
