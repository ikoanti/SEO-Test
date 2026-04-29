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
      `{{domain}} is currently missing the FAQ Schema on {{count}} pages that contain question-and-answer style content. This structured data code tells Google and AI Chatbots exactly what questions your pages answer.

Without it, competitors who have implemented FAQ Schema are more likely to be featured when potential customers ask relevant questions in Google or AI tools like ChatGPT, Gemini, Claude, and others.

By adding FAQ Schema to the right pages, we'll ensure both Google and AI Chatbots can properly read and feature your content, putting your brand in front of customers at the exact moment they're searching.

The pages that are currently losing the most potential visibility are:`,
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
