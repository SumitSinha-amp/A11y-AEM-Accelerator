package com.example.aem.a11yaccelerator.core.utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.script.*;
import java.io.InputStream;
import java.io.InputStreamReader;

public class AxeCoreRunner {
    private static final Logger log = LoggerFactory.getLogger(AxeCoreRunner.class);

    private final ScriptEngine engine;

    public AxeCoreRunner() throws ScriptException {
        ScriptEngineManager manager = new ScriptEngineManager();
        engine = manager.getEngineByName("nashorn"); // Or "graal.js" if using GraalVM
        if (engine == null) {
            throw new ScriptException("No JS engine found (Nashorn removed in Java 15+, use GraalVM)");
        }

        // Load axe-core into the engine
        try (InputStream is = getClass().getResourceAsStream("/axe/axe.min.js")) {
            if (is != null) {
                engine.eval(new InputStreamReader(is));
            } else {
                log.error("axe.min.js not found in resources!");
            }
        } catch (Exception e) {
            log.error("Error loading axe-core", e);
        }
    }

    public String runAccessibilityScan(String html) {
        try {
            engine.put("pageHtml", html);

            String script =
                "var dom = new DOMParser().parseFromString(pageHtml, 'text/html');" +
                "var results;" +
                "axe.run(dom, {}, function (err, res) { " +
                "   if (err) { results = JSON.stringify({ error: err.toString() }); } " +
                "   else { results = JSON.stringify(res); }" +
                "}); results;";

            Object result = engine.eval(script);
            return (result != null) ? result.toString() : "{}";
        } catch (Exception e) {
            log.error("Failed to run axe-core scan", e);
            return "{}";
        }
    }
}