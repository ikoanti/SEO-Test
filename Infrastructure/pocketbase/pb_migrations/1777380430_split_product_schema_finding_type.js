migrate(
  (app) => {
    const findingTypesCollection = app.findCollectionByNameOrId(
      "audit_finding_types",
    );
    let findingType;

    try {
      findingType = app.findFirstRecordByFilter(
        "audit_finding_types",
        'key = "missing-product-schema"',
      );
    } catch {
      findingType = new Record(findingTypesCollection);
      findingType.set("key", "missing-product-schema");
    }

    findingType.set("label", "Missing product schema");
    findingType.set("sort_order", 5);
    app.save(findingType);

    let template;
    try {
      template = app.findFirstRecordByFilter(
        "audit_report_templates",
        'key = "missing-product-schema"',
      );
    } catch {
      return;
    }

    template.set("audit_finding_type", findingType.id);
    template.set("match_pattern", "Missing product schema");
    app.save(template);
  },
  (app) => {
    let structuredData;
    let template;

    try {
      structuredData = app.findFirstRecordByFilter(
        "audit_finding_types",
        'key = "structuredData"',
      );
      template = app.findFirstRecordByFilter(
        "audit_report_templates",
        'key = "missing-product-schema"',
      );
    } catch {
      return;
    }

    template.set("audit_finding_type", structuredData.id);
    template.set("match_pattern", "No JSON-LD Found");
    app.save(template);
  },
);
