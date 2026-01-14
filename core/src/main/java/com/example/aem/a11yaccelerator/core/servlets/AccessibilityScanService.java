package com.example.aem.a11yaccelerator.core.servlets;
//import com.adobe.forms.foundation.transfer.AssetScanInfo.Issue;
//import com.day.cq.wcm.api.Page;
//import com.day.cq.wcm.api.PageManager;
import com.example.aem.a11yaccelerator.core.services.RulesEngineService;
//import com.google.gson.Gson;

import com.example.aem.a11yaccelerator.core.utils.HtmlSnapshotFetcher;
import com.example.aem.a11yaccelerator.core.utils.AxeCoreRunner;
import org.apache.sling.api.SlingHttpServletRequest;
import org.apache.sling.api.SlingHttpServletResponse;
//import org.apache.sling.api.resource.Resource;
//import org.apache.sling.api.resource.ResourceResolver;
import org.apache.sling.api.servlets.SlingAllMethodsServlet;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.osgi.framework.Constants;
import java.io.IOException;
//import java.util.*;

import javax.servlet.Servlet;
import javax.servlet.ServletException;


@Component(
    service = Servlet.class,
    property = {
        Constants.SERVICE_DESCRIPTION + "=Accessibility Scan Servlet",
        "sling.servlet.paths=/bin/a11yaccelerator/scan",
        "sling.servlet.methods=GET"
    }
)
public class AccessibilityScanService  extends SlingAllMethodsServlet {
    @Reference
    private RulesEngineService rulesEngine;

    @Override
    protected void doGet(SlingHttpServletRequest request, SlingHttpServletResponse response)
            throws ServletException, IOException {
        // Example: path provided as ?path=/content/mysite/en
        String scanPath = request.getParameter("path");
        if (scanPath == null || scanPath.isEmpty()) {
            response.setStatus(SlingHttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().write("{\"error\":\"Missing 'path' parameter\"}");
            return;
        }

        try {
            // Fetch HTML from Author instance (could be Publish in prod)
            String html = HtmlSnapshotFetcher.fetchHtml("http://localhost:4502", scanPath);

            if (html != null) {
                AxeCoreRunner runner = new AxeCoreRunner();
                String reportJson = runner.runAccessibilityScan(html);

                response.setContentType("application/json");
                response.getWriter().write(reportJson);
            } else {
                response.setStatus(SlingHttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                response.getWriter().write("{\"error\":\"Failed to fetch HTML snapshot\"}");
            }
        } catch (Exception e) {
            response.setStatus(SlingHttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().write("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }
    
}
