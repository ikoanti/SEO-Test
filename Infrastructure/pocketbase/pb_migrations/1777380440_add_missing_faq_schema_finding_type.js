migrate(
  (app) => {
    const findingTypesCollection = app.findCollectionByNameOrId(
      "audit_finding_types",
    );
    let findingType;

    try {
      findingType = app.findFirstRecordByFilter(
        "audit_finding_types",
        'key = "missing-faq-schema"',
      );
    } catch {
      findingType = new Record(findingTypesCollection);
      findingType.set("key", "missing-faq-schema");
    }

    findingType.set("label", "Missing FAQ Schema");
    findingType.set("sort_order", 6);
    app.save(findingType);

    const reportTemplatesCollection = app.findCollectionByNameOrId(
      "audit_report_templates",
    );
    let template;

    try {
      template = app.findFirstRecordByFilter(
        "audit_report_templates",
        'key = "missing-faq-schema"',
      );
    } catch {
      template = new Record(reportTemplatesCollection);
      template.set("key", "missing-faq-schema");
    }

    template.set("audit_finding_type", findingType.id);
    template.set("title", "Missing FAQ Schema");
    template.set("priority", "High");
    template.set("match_pattern", "Missing FAQ Schema");
    template.set(
      "template_body",
      `FAQ Schema helps search engines understand question-and-answer content on your site and can make FAQ pages easier for search engines and AI systems to interpret.

During our review of {{domain}}, we found FAQ-style pages that do not include FAQPage structured data.

Adding FAQ Schema to these pages is a quick technical SEO improvement that gives crawlers cleaner context about common customer questions, answers, policies, and purchase concerns.`,
    );
    template.set("sort_order", 6);
    template.set("enabled", true);
    app.save(template);
  },
  (app) => {
    let findingType;
    let template;

    try {
      findingType = app.findFirstRecordByFilter(
        "audit_finding_types",
        'key = "missing-faq-schema"',
      );
    } catch {
      findingType = null;
    }

    try {
      template = app.findFirstRecordByFilter(
        "audit_report_templates",
        'key = "missing-faq-schema"',
      );
    } catch {
      template = null;
    }

    if (template) {
      app.delete(template);
    }

    if (findingType) {
      app.delete(findingType);
    }
  },
);
