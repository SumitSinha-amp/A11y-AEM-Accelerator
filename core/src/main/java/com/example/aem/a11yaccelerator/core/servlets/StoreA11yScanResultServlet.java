package com.example.aem.a11yaccelerator.core.servlets;

import org.apache.commons.io.IOUtils;
import org.apache.log4j.Logger;
import org.apache.sling.api.SlingHttpServletRequest;
import org.apache.sling.api.SlingHttpServletResponse;
import org.apache.sling.api.resource.LoginException;
import org.apache.sling.api.resource.ResourceResolver;
import org.apache.sling.api.resource.ResourceResolverFactory;
import org.apache.sling.api.servlets.SlingAllMethodsServlet;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;

import javax.jcr.Node;
import javax.jcr.NodeIterator;
import javax.jcr.RepositoryException;
import javax.jcr.Session;
import javax.servlet.Servlet;
import javax.servlet.ServletException;
import java.io.IOException;
import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@Component(service = { Servlet.class }, property = {
        "sling.servlet.paths=/bin/a11y/scanresult",
        "sling.servlet.methods=POST,GET"
})
public class StoreA11yScanResultServlet extends SlingAllMethodsServlet {

    @Reference
    private ResourceResolverFactory factory;

    @Override
    protected void doPost(SlingHttpServletRequest request, SlingHttpServletResponse response)
            throws ServletException, IOException {

                Logger logger = Logger.getLogger(StoreA11yScanResultServlet.class);

        String body = request.getReader().lines().collect(Collectors.joining(System.lineSeparator()));

        if (body == null || body.isEmpty()) {
            response.setStatus(400);
            response.getWriter().write("Missing request body");
            return;
        }

        try (ResourceResolver resolver = getServiceResourceResolver()) {
            logger.error(resolver);
            Session session = resolver.adaptTo(Session.class);
            JSONObject rootJson = new JSONObject(body);

            if (!rootJson.has("pages")) {
                response.setStatus(400);
                response.getWriter().write("Invalid JSON. Expected 'pages' array.");
                return;
            }

            JSONArray pagesArray = rootJson.getJSONArray("pages");

            // Ensure /var/a11y-scans exists
            Node varNode = session.getNode("/var");
            Node a11yRootNode = varNode.hasNode("a11y-scans")
                    ? varNode.getNode("a11y-scans")
                    : varNode.addNode("a11y-scans", "sling:Folder");

            for (int i = 0; i < pagesArray.length(); i++) {
                JSONObject pageObj = pagesArray.getJSONObject(i);
                String pagePath = pageObj.optString("pagePath");
                JSONArray scanResultArray = pageObj.optJSONArray("scanResult");


                if (pagePath == null || scanResultArray == null) continue;

                // convert pagePath to relative under /var/a11y-scans
                String relativePath = pagePath.startsWith("/") ? pagePath.substring(1) : pagePath;

                // Create all intermediate folders
                Node pageParentNode = createIntermediateNodes(a11yRootNode, relativePath);

                // Create or update scanResult node
                Node resultNode;
                if (pageParentNode.hasNode("scanResult")) {
                    resultNode = pageParentNode.getNode("scanResult");
                } else {
                    resultNode = pageParentNode.addNode("scanResult", "nt:unstructured");
                }
                logger.error(relativePath);

                // Set or update properties
                resultNode.setProperty("pagePath", pagePath);
                resultNode.setProperty("scanResult", scanResultArray.toString());
                resultNode.setProperty("lastModified", Calendar.getInstance());
            }

            session.save();
            response.setStatus(200);
            response.getWriter().write("All scan results saved successfully.");

        } catch (LoginException e) {
            response.setStatus(500);
            response.getWriter().write("LoginException: " + e.getMessage());
        } catch (RepositoryException e) {
            response.setStatus(500);
            response.getWriter().write("RepositoryException: " + e.getMessage());
        } catch (Exception e) {
            response.setStatus(500);
            response.getWriter().write("Error: " + e.getMessage());
        }
    }

    /**
     * Creates intermediate folder nodes under /var/a11y-scans for a given relative path.
     */
    private Node createIntermediateNodes(Node baseNode, String relativePath) throws RepositoryException {
        String[] parts = relativePath.split("/");
        Node current = baseNode;
        for (String part : parts) {
            if (part.isEmpty()) continue;
            if (!current.hasNode(part)) {
                current = current.addNode(part, "nt:unstructured");
            } else {
                current = current.getNode(part);
            }
        }
        return current;
    }

    @Override
    protected void doGet(SlingHttpServletRequest request, SlingHttpServletResponse response)
            throws ServletException, IOException {
     String pagePath = request.getParameter("pagePath");
    if (pagePath == null) {
        response.setStatus(400);
        response.getWriter().write("Missing pagePath parameter");
        return;
    }

    try (ResourceResolver resolver = getServiceResourceResolver()) {
        Session session = resolver.adaptTo(Session.class);
        String relativePath = pagePath.startsWith("/") ? pagePath.substring(1) : pagePath;
        String basePath = "/var/a11y-scans/" + relativePath;

        if (!session.nodeExists(basePath)) {
            response.setStatus(404);
            response.getWriter().write("No scan data found for this page or its children.");
            return;
        }

        Node baseNode = session.getNode(basePath);
        JSONArray aggregatedResults = new JSONArray();

        collectScanResults(baseNode, aggregatedResults);

        if (aggregatedResults.length() == 0) {
            response.setStatus(404);
            response.getWriter().write("No scan results found under this path.");
            return;
        }

        response.setContentType("application/json");
        response.getWriter().write(aggregatedResults.toString());

    } catch (Exception e) {
        response.setStatus(500);
        response.getWriter().write("Error: " + e.getMessage());
    }
    }

    private ResourceResolver getServiceResourceResolver() throws LoginException {
        Map<String, Object> authParams = new HashMap<>();
        authParams.put(ResourceResolverFactory.SUBSERVICE, "serviceUserA11yAccelerator");
        return factory.getServiceResourceResolver(authParams);
    }

private void collectScanResults(Node node, JSONArray aggregatedResults) throws RepositoryException {
    if ("scanResult".equals(node.getName()) && node.hasProperty("scanResult")) {
        String resultStr = node.getProperty("scanResult").getString();
        String pagePath = node.hasProperty("pagePath") ? node.getProperty("pagePath").getString() : "";

        try {
            resultStr = resultStr.trim();
            JSONObject pageData = new JSONObject();
            pageData.put("pagePath", pagePath);

            if (resultStr.startsWith("[")) {
                // If scanResult is an array
                JSONArray arr = new JSONArray(resultStr);
                pageData.put("scanResult", arr);
            } else if (resultStr.startsWith("{")) {
                // If scanResult is a single object
                JSONObject obj = new JSONObject(resultStr);
                pageData.put("scanResult", obj);
            } else {
                // If not valid JSON, skip
                return;
            }

            aggregatedResults.put(pageData);

        } catch (Exception e) {
            System.err.println("Error parsing scanResult JSON at node " + node.getPath() + ": " + e.getMessage());
        }
    }

    // Recurse through all children
    NodeIterator children = node.getNodes();
    while (children.hasNext()) {
        collectScanResults(children.nextNode(), aggregatedResults);
    }
}
}
