migrate(
  (app) => {
    try {
      const template = app.findFirstRecordByFilter(
        "audit_report_templates",
        'key = "open-page-rank"',
      );
      app.delete(template);
    } catch {
      // Already removed or never created.
    }

    try {
      const findingType = app.findFirstRecordByFilter(
        "audit_finding_types",
        'key = "openPageRank"',
      );
      app.delete(findingType);
    } catch {
      // Already removed or never created.
    }
  },
  (app) => {
    try {
      app.findFirstRecordByFilter(
        "audit_finding_types",
        'key = "openPageRank"',
      );
    } catch {
      const findingTypesCollection = app.findCollectionByNameOrId(
        "audit_finding_types",
      );
      const findingType = new Record(findingTypesCollection);
      findingType.set("key", "openPageRank");
      findingType.set("label", "Open PageRank");
      findingType.set("sort_order", 2);
      app.save(findingType);
    }
  },
);
