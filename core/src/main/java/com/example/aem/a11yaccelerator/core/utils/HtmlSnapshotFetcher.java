package com.example.aem.a11yaccelerator.core.utils;

import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;

/**
 * Utility class to fetch the rendered HTML of an AEM page
 * for accessibility scanning (axe-core integration).
 */
public class HtmlSnapshotFetcher {

    private static final Logger log = LoggerFactory.getLogger(HtmlSnapshotFetcher.class);

    /**
     * Fetches the rendered HTML of a page at the given path.
     *
     * @param baseUrl e.g. http://localhost:4502
     * @param pagePath e.g. /content/my-site/en
     * @return HTML string or null if error
     */
    public static String fetchHtml(String baseUrl, String pagePath) {
        String url = baseUrl + pagePath + ".html";
        try (CloseableHttpClient client = HttpClients.createDefault()) {
            HttpGet get = new HttpGet(url);
            try (CloseableHttpResponse response = client.execute(get)) {
                if (response.getStatusLine().getStatusCode() == 200) {
                    return EntityUtils.toString(response.getEntity());
                } else {
                    log.error("Failed to fetch HTML snapshot for {} : {}",
                            url, response.getStatusLine());
                }
            }
        } catch (IOException e) {
            log.error("IOException while fetching HTML snapshot for {}", url, e);
        }
        return null;
    }
}
