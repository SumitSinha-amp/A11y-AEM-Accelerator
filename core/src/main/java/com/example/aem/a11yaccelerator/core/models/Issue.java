package com.example.aem.a11yaccelerator.core.models;



public class Issue {
    private String id;
    private String pagePath;
    private String componentPath;
    private String componentType;
    private String issueType;
    private String wcagLevel;
    private String remediation;
    private String recommendationLink;
    private String description;
   


    public String getId() {
        return id;
    }
    public String getPagePath() {
        return pagePath;
    }
    public String getIssueType() {
        return issueType;
    }
    public String getDescription() {
        return description;
    }

    public String getComponentPath() {
        return componentPath;
    }
    public String getComponentType() {
        return componentType;
    }
    public String getWcagLevel() {
        return wcagLevel;
    }
    public String getRemediation() {
        return remediation;
    }
    public String getRecommendationLink() {
        return recommendationLink;
    }
}
