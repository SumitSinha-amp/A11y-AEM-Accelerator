(function (document, $, ns) {
    "use strict";

    $(document).on('change', '[name$="./selectedComponent"]', function (e) {
        var value = $(this).find(":selected").val()
        if (value == 'ctaDownload') {
            showButtonDetails();
        } else {
            showLinksDetails();
        }
    });

    $(document).on("dialog-ready", function (e) {
        $('[name$="./selectedComponent"]').trigger('change');
    });

    function showButtonDetails() {
        $(".buttonFields").show();
        $(".buttonFields,.buttonmultiFields").closest(".coral-Form-fieldwrapper").show();
        $(".linksFields,.linksmultiFields").closest(".coral-Form-fieldwrapper").hide();
        $(".linksFields,.linksmultiFields").find('[aria-required=true]').attr({
            'aria-required': 'false',
            'data-required': 'true'
        });
    }

    function showLinksDetails() {
        $(".buttonFields").hide();

        $(".buttonFields,.buttonmultiFields").closest(".coral-Form-fieldwrapper").hide();
        $(".buttonFields,.buttonmultiFields").find('[aria-required=true]').attr({
            'aria-required': 'false',
            'data-required': 'true'
        });

        $(".linksFields,.linksmultiFields").closest(".coral-Form-fieldwrapper").show();
    }

})(document, Granite.$, Granite.author);
