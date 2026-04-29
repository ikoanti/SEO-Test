migrate(
  (app) => {
    try {
      const mobileUsability = app.findFirstRecordByFilter(
        "audit_finding_types",
        'key = "mobileUsability"',
      );
      mobileUsability.set("key", "viewportMetaTag");
      mobileUsability.set("label", "Viewport Meta Tag");
      app.save(mobileUsability);
    } catch {
      try {
        const findingTypesCollection = app.findCollectionByNameOrId(
          "audit_finding_types",
        );
        const viewportMetaTag = new Record(findingTypesCollection);
        viewportMetaTag.set("key", "viewportMetaTag");
        viewportMetaTag.set("label", "Viewport Meta Tag");
        viewportMetaTag.set("sort_order", 20);
        app.save(viewportMetaTag);
      } catch {
        // No-op: collection may not exist in partially migrated local DBs.
      }
    }

    try {
      const structuredData = app.findFirstRecordByFilter(
        "audit_finding_types",
        'key = "structuredData"',
      );
      app.delete(structuredData);
    } catch {
      // Already removed or never created.
    }
  },
  (app) => {
    try {
      const viewportMetaTag = app.findFirstRecordByFilter(
        "audit_finding_types",
        'key = "viewportMetaTag"',
      );
      viewportMetaTag.set("key", "mobileUsability");
      viewportMetaTag.set("label", "Mobile Usability");
      app.save(viewportMetaTag);
    } catch {
      // Already reverted or missing.
    }
  },
);
