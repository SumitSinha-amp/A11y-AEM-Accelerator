package com.example.aem.a11yaccelerator.core.services.impl;

import com.adobe.forms.foundation.transfer.AssetScanInfo.Issue;
import com.example.aem.a11yaccelerator.core.services.AxeCoreService;
import com.example.aem.a11yaccelerator.core.utils.AxeCoreRunner;
import org.osgi.service.component.annotations.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * AxeCoreService implementation that integrates with axe-core runner.
 */
@Component(service = AxeCoreService.class, immediate = true)
public class AxeCoreServiceImpl implements AxeCoreService {

    @Override
    public List<Issue> checkPage(String path) {
        List<Issue> issues = new ArrayList<>();

        try {
            // 🔹 Step 1: Fetch HTML snapshot of the page
            String html = fetchPageHtml(path);
                /*  1. Run AEM custom rules
                    if (pageTitleEmpty(String path)) {
                        issues.add(new Issue(
                            "page-title-missing",
                            "Page title is empty",
                            path + "/jcr:content",
                            "A"
                        ));
                    }

                    if (imageAltMissing(path)) {
                        issues.add(new Issue(
                            "img-alt-missing",
                            "Image missing alt attribute",
                            path + "/jcr:content/image",
                            "A"
                        ));
                    }
*/
            // 🔹 Step 2: Run axe-core analysis (through JS runner / Node integration)
            List<Issue> axeIssues = runAxeCore(html);

            // 🔹 Step 3: Collect results
            issues.addAll(axeIssues);

        } catch (Exception e) {
            // Log error (AEM uses SLF4J)
            System.err.println("AxeCoreServiceImpl: Error scanning page " + path + " - " + e.getMessage());
        }

        return issues;
    }

    /**
     * Fetch HTML snapshot for given AEM page.
     */
    private String fetchPageHtml(String path) {
        // TODO: Use HtmlSnapshotFetcher or Sling HTTP client
        // Example placeholder return
        return "<html><body><img src='test.png'></body></html>";
    }

    /**
     * Run axe-core validation against HTML.
     * In real setup: call axe-core (via GraalJS, Puppeteer, or Node service).
     */
     private List<Issue> runAxeCore(String html) {
        List<Issue> issues = new ArrayList<>();

        // Example stub issue for missing alt text
        // Issue missingAlt = new Issue();
        // missingAlt.setId("img-alt-missing");
        // missingAlt.setDescription("Image is missing alt attribute");
        // issues.add(missingAlt);

        return issues;
    }
}
