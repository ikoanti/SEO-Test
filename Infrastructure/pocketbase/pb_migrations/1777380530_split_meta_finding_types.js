migrate(
  (app) => {
    const findingTypesCollection = app.findCollectionByNameOrId(
      "audit_finding_types",
    );
    const definitions = [
      [
        "meta-titles-too-long-unoptimized",
        "Meta Titles Are Too Long & Unoptimized",
        8,
      ],
      ["duplicated-page-titles", "Duplicated Page Titles", 9],
      ["duplicated-meta-descriptions", "Duplicated Meta Descriptions", 10],
      ["overly-long-meta-descriptions", "Overly Long Meta Descriptions", 11],
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
      ["meta-titles-too-long-unoptimized", "meta-titles-too-long-unoptimized"],
      ["duplicated-page-titles", "duplicated-page-titles"],
      ["duplicated-meta-descriptions", "duplicated-meta-descriptions"],
      ["overly-long-meta-descriptions", "overly-long-meta-descriptions"],
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
    let metaTitles;

    try {
      metaTitles = app.findFirstRecordByFilter(
        "audit_finding_types",
        'key = "metaTitles"',
      );
    } catch {
      return;
    }

    [
      "meta-titles-too-long-unoptimized",
      "duplicated-page-titles",
      "duplicated-meta-descriptions",
      "overly-long-meta-descriptions",
    ].forEach((templateKey) => {
      let template;

      try {
        template = app.findFirstRecordByFilter(
          "audit_report_templates",
          `key = "${templateKey}"`,
        );
      } catch {
        return;
      }

      template.set("audit_finding_type", metaTitles.id);
      app.save(template);
    });
  },
);
