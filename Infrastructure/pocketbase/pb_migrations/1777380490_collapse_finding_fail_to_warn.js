migrate(
  (app) => {
    const findings = app.findRecordsByFilter(
      "audit_findings",
      'status = "fail"',
      "",
      0,
      0,
    );
    findings.forEach((record) => {
      record.set("status", "warn");
      app.save(record);
    });

    const collection = app.findCollectionByNameOrId("audit_findings");
    const statusField = collection.fields.getByName("status");
    statusField.values = ["pass", "warn", "info"];
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("audit_findings");
    const statusField = collection.fields.getByName("status");
    statusField.values = ["pass", "warn", "fail", "info"];
    app.save(collection);
  },
);
