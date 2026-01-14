package com.example.aem.a11yaccelerator.core.services.impl;

import com.adobe.forms.foundation.transfer.AssetScanInfo.Issue;
import com.example.aem.a11yaccelerator.core.services.AxeCoreService;
import com.example.aem.a11yaccelerator.core.services.RulesEngineService;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;

import java.util.ArrayList;
import java.util.List;

@Component(service = RulesEngineService.class, immediate = true)
public class RulesEngineServiceImpl implements RulesEngineService {

    @Reference
    private AxeCoreService axeCoreService;

    @Override
    public List<Issue> scanPage(String path) {
        List<Issue> issues = new ArrayList<>();

        // Example static rule: Missing alt text
        // (here you’d traverse page content and add issues if alt missing)

        // Delegate to AxeCoreService for actual axe-core checks
        if (axeCoreService != null) {
            issues.addAll(axeCoreService.checkPage(path));
        }

        return issues;
    }
}
