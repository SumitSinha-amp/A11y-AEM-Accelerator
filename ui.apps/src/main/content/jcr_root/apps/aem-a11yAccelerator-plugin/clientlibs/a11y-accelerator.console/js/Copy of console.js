(function ($, $document) {
    "use strict";

    $document.on("foundation-contentloaded", function () {

        // When Scan button is clicked
        $("#scanBtn").on("click", function () {
            const path =  $("#scanPath").val();

            if (!path) {
                Coral.Dialog.alert("Validation Error", "Please enter a content path to scan.");
                return;
            }

            // Clear existing rows
            const $table = $("#resultsTable");
            $table.find("tbody").empty();

            // Show loading indicator
            $table.append('<tbody><tr><td colspan="5">Scanning...</td></tr></tbody>');

            // Call servlet
            $.ajax({
                url: "/bin/a11ychecker.scan.json",
                type: "GET",
                data: { path: path },
                success: function (data) {
                    const rows = [];
                    $table.find("tbody").empty();

                    if (data && data.length > 0) {
                        data.forEach(function (issue) {
                            rows.push(
                                `<tr>
                                    <td>${issue.pagePath}</td>
                                    <td>${issue.component}</td>
                                    <td>${issue.issue}</td>
                                    <td>${issue.level}</td>
                                    <td>${issue.fix}</td>
                                </tr>`
                            );
                        });
                        $table.find("tbody").append(rows.join(""));
                    } else {
                        $table.find("tbody").append('<tr><td colspan="5">No issues found 🎉</td></tr>');
                    }
                },
                error: function () {
                    $table.find("tbody").html('<tr><td colspan="5">Error scanning content.</td></tr>');
                }
            });
        });
    });

})(Granite.$, jQuery(document));
