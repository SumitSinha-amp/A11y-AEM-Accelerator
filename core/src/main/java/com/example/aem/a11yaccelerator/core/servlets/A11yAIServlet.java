package com.example.aem.a11yaccelerator.core.servlets;

//import com.adobe.forms.foundation.transfer.AssetScanInfo.Issue;
//import com.day.cq.wcm.api.Page;
//import com.day.cq.wcm.api.PageManager;
import com.example.aem.a11yaccelerator.core.services.RulesEngineService;
//import com.google.gson.Gson;

import com.example.aem.a11yaccelerator.core.utils.HtmlSnapshotFetcher;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.example.aem.a11yaccelerator.core.utils.AxeCoreRunner;

import org.apache.http.HttpEntity;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
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
import java.nio.charset.StandardCharsets;

import javax.servlet.Servlet;
import javax.servlet.ServletException;

@Component(
    service = {Servlet.class},
    property = {
        Constants.SERVICE_DESCRIPTION + "=Accessibility Scan AI Suggestion Servlet",
        "sling.servlet.paths=/bin/a11yaccelerator/a11y-ai-suggestions",
        "sling.servlet.methods=POST"
        
    }
)
public class A11yAIServlet extends SlingAllMethodsServlet {

    private static final String OPENAI_URL = "https://api.sambanova.ai/v1/chat/completions";
    private static final String API_KEY = "b5fa2619-d601-46d2-8726-f35b2efdb89f";

    private final Gson gson = new Gson();

    @Override
    protected void doPost(final SlingHttpServletRequest request, final SlingHttpServletResponse response)
            throws IOException {

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        try {
            // Step 1: Parse incoming JSON
            String body = request.getReader().lines().reduce("", (acc, x) -> acc + x);
            JsonObject input = gson.fromJson(body, JsonObject.class);

            String ruleId = input.has("ruleId") ? input.get("ruleId").getAsString() : "";
            String snippet = input.has("snippet") ? input.get("snippet").getAsString() : "";
            String help= input.has("help") ? input.get("help").getAsString() : "";

            // Step 2: Build ChatGPT prompt
            String prompt = "Accessibility issue (" + ruleId + "): Suggest a fix for this HTML snippet:\n" + snippet +
                "\nReference: " + help +
                    "\nExplain briefly why this fix improves accessibility.";

            // Step 3: Build OpenAI request JSON
            JsonArray messages = new JsonArray();

            JsonObject sysMsg = new JsonObject();
            sysMsg.addProperty("role", "system");
            sysMsg.addProperty("content", "You are an accessibility expert specializing in WCAG compliance.");
            messages.add(sysMsg);

            JsonObject userMsg = new JsonObject();
            userMsg.addProperty("role", "user");
            userMsg.addProperty("content", prompt);
            messages.add(userMsg);

            JsonObject openAiReq = new JsonObject();
            openAiReq.addProperty("model", "Meta-Llama-3.3-70B-Instruct");
            openAiReq.add("messages", messages);
           // openAiReq.addProperty("temperature", 0.3);

            // Step 4: Call OpenAI API via Apache HttpClient
            try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
                HttpPost post = new HttpPost(OPENAI_URL);
                post.setHeader("Authorization", "Bearer " + API_KEY);
                post.setHeader("Content-Type", "application/json");
                post.setEntity(new StringEntity(gson.toJson(openAiReq), StandardCharsets.UTF_8));

                try (CloseableHttpResponse apiResponse = httpClient.execute(post)) {
                    int status = apiResponse.getStatusLine().getStatusCode();
                    String apiResult = EntityUtils.toString(apiResponse.getEntity(), StandardCharsets.UTF_8);

                    if (status >= 200 && status < 300) {
                        JsonObject apiJson = gson.fromJson(apiResult, JsonObject.class);

                        String suggestion = apiJson.getAsJsonArray("choices")
                                .get(0).getAsJsonObject()
                                .getAsJsonObject("message")
                                .get("content").getAsString();

                        JsonObject output = new JsonObject();
                        output.addProperty("ruleId", ruleId);
                        output.addProperty("suggestion", suggestion);

                        response.getWriter().write(gson.toJson(output));
                    } else {
                        JsonObject err = new JsonObject();
                        err.addProperty("error", "OpenAI API returned status " + status);
                        err.addProperty("response", apiResult);
                        response.setStatus(status);
                        response.getWriter().write(gson.toJson(err));
                    }
                }
            }

        } catch (Exception e) {
            JsonObject error = new JsonObject();
            error.addProperty("error", "Exception while calling OpenAI API");
            error.addProperty("message", e.getMessage());
            response.setStatus(500);
            response.getWriter().write(gson.toJson(error));
        }
    }
    
}
