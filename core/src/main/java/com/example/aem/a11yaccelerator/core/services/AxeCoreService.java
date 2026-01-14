package com.example.aem.a11yaccelerator.core.services;

import com.adobe.forms.foundation.transfer.AssetScanInfo.Issue;
import java.util.List;

public interface AxeCoreService {
    /**
     * Runs accessibility checks (axe-core) on the given page path.
     *
     * @param path the AEM page path
     * @return list of accessibility issues found
     */
    List<Issue> checkPage(String path);
    
}
