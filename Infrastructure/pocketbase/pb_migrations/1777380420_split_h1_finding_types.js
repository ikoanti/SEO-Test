migrate(
  (app) => {
    const findingTypesCollection = app.findCollectionByNameOrId(
      "audit_finding_types",
    );
    const definitions = [
      ["missing-h1-tags", "Missing H1 tags", 3],
      ["multiple-h1-tags", "Multiple H1 tags", 4],
    ];

    definitions.forEach(([key, label, sortOrder]) => {
      let record;
      try {
        record = app.findFirstRecordByFilter(
          "audit_finding_types",
          `key = "${key}"`,
        );
      } catch {
        record = new Record(findingTypesCollection);
        record.set("key", key);
      }

      record.set("label", label);
      record.set("sort_order", sortOrder);
      app.save(record);
    });

    const mappings = [
      ["missing-h1-tags", "missing-h1-tags"],
      ["multiple-h1-tags", "multiple-h1-tags"],
    ];

    mappings.forEach(([templateKey, findingTypeKey]) => {
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
  (app) => {
    let h1FindingType;

    try {
      h1FindingType = app.findFirstRecordByFilter(
        "audit_finding_types",
        'key = "h1Tags"',
      );
    } catch {
      return;
    }

    ["missing-h1-tags", "multiple-h1-tags"].forEach((templateKey) => {
      let template;

      try {
        template = app.findFirstRecordByFilter(
          "audit_report_templates",
          `key = "${templateKey}"`,
        );
      } catch {
        return;
      }

      template.set("audit_finding_type", h1FindingType.id);
      app.save(template);
    });
  },
);
