migrate(
  (app) => {
    const findingTypesCollection = app.findCollectionByNameOrId(
      "audit_finding_types",
    );
    let findingType;

    try {
      findingType = app.findFirstRecordByFilter(
        "audit_finding_types",
        'key = "unlinked-blog"',
      );
    } catch {
      findingType = new Record(findingTypesCollection);
      findingType.set("key", "unlinked-blog");
    }

    findingType.set("label", "Unlinked Blog");
    findingType.set("sort_order", 8);
    app.save(findingType);

    const reportTemplatesCollection = app.findCollectionByNameOrId(
      "audit_report_templates",
    );
    let template;

    try {
      template = app.findFirstRecordByFilter(
        "audit_report_templates",
        'key = "unlinked-blog"',
      );
    } catch {
      template = new Record(reportTemplatesCollection);
      template.set("key", "unlinked-blog");
    }

    template.set("audit_finding_type", findingType.id);
    template.set("title", "Unlinked Blog");
    template.set("priority", "High");
    template.set("match_pattern", "Unlinked Blog");
    template.set(
      "template_body",
      `A well-connected blog can drive significant traffic and improve user engagement. If your blog page isn’t linked from the main menu or footer, it’s missing out on potential visitors who might benefit from your content.

For instance, during our review of {{domain}}, we noticed that the blog page is not linked to the menu or footer sections. Adding these links can enhance your blog's visibility, leading to increased traffic and better user engagement. This simple adjustment can help users quickly access your content and improve overall site navigation.`,
    );
    template.set("sort_order", 8);
    template.set("enabled", true);
    app.save(template);
  },
  (app) => {
    let findingType;
    let template;

    try {
      findingType = app.findFirstRecordByFilter(
        "audit_finding_types",
        'key = "unlinked-blog"',
      );
    } catch {
      findingType = null;
    }

    try {
      template = app.findFirstRecordByFilter(
        "audit_report_templates",
        'key = "unlinked-blog"',
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
