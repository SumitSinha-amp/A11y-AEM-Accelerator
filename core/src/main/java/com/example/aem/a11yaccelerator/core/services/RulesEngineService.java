package com.example.aem.a11yaccelerator.core.services;
import com.adobe.forms.foundation.transfer.AssetScanInfo.Issue;
import org.osgi.service.component.annotations.Component;
import java.util.List;

public interface RulesEngineService {
    List<Issue> scanPage(String path);
}
