migrate(
  (app) => {
    const findingTypeKeys = [
      "sitemap",
      "canonicalUrls",
      "internalLinks",
      "contentQuality",
      "webIcons",
      "ssl",
      "viewportMetaTag",
      "flash",
      "charset",
      "loremIpsum",
      "openGraph",
      "trustSignals",
      "lazyLoadImages",
    ];

    const templateKeys = [
      "sitemap-not-found-or-corrupt",
      "canonicals",
      "internal-links",
      "content-quality",
      "web-icons-missing",
      "ssl-missing",
      "viewport-meta-tag-not-set",
      "flash-is-used",
      "character-encoding-not-utf-8",
      "lorem-ipsum-placeholders-found",
      "open-graph",
      "contact-and-trust-signals-missing",
      "lazy-loading",
    ];

    const deleteRecords = (collectionName, filter) => {
      let records = [];
      try {
        records = app.findRecordsByFilter(collectionName, filter, "", 0, 0);
      } catch {
        return;
      }

      records.forEach((record) => {
        app.delete(record);
      });
    };

    templateKeys.forEach((key) => {
      deleteRecords("audit_report_templates", `key = "${key}"`);
    });

    findingTypeKeys.forEach((key) => {
      let findingType;
      try {
        findingType = app.findFirstRecordByFilter(
          "audit_finding_types",
          `key = "${key}"`,
        );
      } catch {
        return;
      }

      deleteRecords(
        "audit_screenshots",
        `audit_finding_type = "${findingType.id}"`,
      );
      deleteRecords(
        "audit_findings",
        `audit_finding_type = "${findingType.id}"`,
      );
      deleteRecords("runs", `audit_finding_type = "${findingType.id}"`);
      deleteRecords(
        "audit_report_templates",
        `audit_finding_type = "${findingType.id}"`,
      );

      app.delete(findingType);
    });
  },
  (app) => {
    const findingTypes = [
      ["sitemap", "Sitemap"],
      ["canonicalUrls", "Canonical URLs"],
      ["internalLinks", "Internal Links"],
      ["contentQuality", "Content Quality"],
      ["webIcons", "Web Icons"],
      ["ssl", "SSL"],
      ["viewportMetaTag", "Viewport Meta Tag"],
      ["flash", "Flash"],
      ["charset", "Charset"],
      ["loremIpsum", "Lorem Ipsum"],
      ["openGraph", "Open Graph"],
      ["trustSignals", "Trust Signals"],
      ["lazyLoadImages", "Lazy Load Images"],
    ];

    const collection = app.findCollectionByNameOrId("audit_finding_types");
    findingTypes.forEach(([key, label], index) => {
      try {
        app.findFirstRecordByFilter("audit_finding_types", `key = "${key}"`);
      } catch {
        const record = new Record(collection);
        record.set("key", key);
        record.set("label", label);
        record.set("sort_order", 100 + index);
        app.save(record);
      }
    });
  },
);
