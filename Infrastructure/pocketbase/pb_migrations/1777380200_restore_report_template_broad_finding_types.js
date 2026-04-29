migrate(
  (app) => {
    const mappings = [
      ["ai-chatbots-llms-not-whitelisted", "robotsTxt"],
      ["unoptimized-page-speed", "pageSpeed"],
      ["multiple-h1-tags", "h1Tags"],
      ["missing-h1-tags", "h1Tags"],
      ["missing-product-schema", "structuredData"],
      ["missing-faq-schema", "structuredData"],
      ["meta-titles-too-long-unoptimized", "metaTitles"],
      ["unoptimized-shopify-url-structure", "shopifyUrls"],
      ["duplicated-page-titles", "metaTitles"],
      ["duplicated-meta-descriptions", "metaTitles"],
      ["missing-organization-schema", "structuredData"],
      ["overly-long-meta-descriptions", "metaTitles"],
      ["images-with-missing-alt-text", "imageAltTags"],
    ];

    mappings.forEach(([templateKey, findingTypeKey]) => {
      let template;
      try {
        template = app.findFirstRecordByFilter(
          "audit_report_templates",
          `key = "${templateKey}"`,
        );
      } catch {
        return;
      }

      const findingType = app.findFirstRecordByFilter(
        "audit_finding_types",
        `key = "${findingTypeKey}"`,
      );

      template.set("audit_finding_type", findingType.id);
      template.set("enabled", true);
      app.save(template);
    });
  },
  (app) => {
    const previousMappings = [
      ["ai-chatbots-llms-not-whitelisted", "ai-chatbots-llms-not-whitelisted"],
      ["unoptimized-page-speed", "unoptimized-page-speed"],
      ["multiple-h1-tags", "multiple-h1-tags"],
      ["missing-h1-tags", "missing-h1-tags"],
      ["missing-product-schema", "missing-product-schema"],
      ["missing-faq-schema", "missing-faq-schema"],
      ["meta-titles-too-long-unoptimized", "meta-titles-too-long-unoptimized"],
      ["unoptimized-shopify-url-structure", "unoptimized-shopify-url-structure"],
      ["duplicated-page-titles", "duplicated-page-titles"],
      ["duplicated-meta-descriptions", "duplicated-meta-descriptions"],
      ["missing-organization-schema", "missing-organization-schema"],
      ["overly-long-meta-descriptions", "overly-long-meta-descriptions"],
      ["images-with-missing-alt-text", "images-with-missing-alt-text"],
    ];

    previousMappings.forEach(([templateKey, findingTypeKey]) => {
      let template;
      let findingType;

      try {
        template = app.findFirstRecordByFilter(
          "audit_report_templates",
          `key = "${templateKey}"`,
        );
        findingType = app.findFirstRecordByFilter(
          "audit_finding_types",
          `key = "${findingTypeKey}"`,
        );
      } catch {
        return;
      }

      template.set("audit_finding_type", findingType.id);
      app.save(template);
    });
  },
);
