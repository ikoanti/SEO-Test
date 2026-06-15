migrate(
  (app) => {
    const findingType = app.findFirstRecordByFilter(
      "audit_finding_types",
      'key = "llmsTxt"',
    );

    const reportTemplatesCollection = app.findCollectionByNameOrId(
      "audit_report_templates",
    );
    let template;

    try {
      template = app.findFirstRecordByFilter(
        "audit_report_templates",
        'key = "missing-llms-txt"',
      );
    } catch {
      template = new Record(reportTemplatesCollection);
      template.set("key", "missing-llms-txt");
    }

    template.set("audit_finding_type", findingType.id);
    template.set("title", "Missing LLMs.txt");
    template.set("priority", "Medium");
    template.set("match_pattern", "LLMs\\.txt not found");
    template.set(
      "template_body",
      `LLMs.txt is becoming a useful way to give AI crawlers a clear, curated entry point into {{domain}}.

Right now we could not find an LLMs.txt file at the standard locations. That means AI systems have less guidance on which pages, products, and content should be understood and referenced.

Adding this file is a small technical task, but it helps improve how AI discovery tools interpret the site as AI-driven search becomes more important.`,
    );
    template.set("sort_order", 13);
    template.set("enabled", true);
    app.save(template);
  },
  (app) => {
    let template;

    try {
      template = app.findFirstRecordByFilter(
        "audit_report_templates",
        'key = "missing-llms-txt"',
      );
    } catch {
      template = null;
    }

    if (template) {
      app.delete(template);
    }
  },
);
