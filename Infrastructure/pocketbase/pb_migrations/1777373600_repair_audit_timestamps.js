migrate(
  (app) => {
    const audits = app.findCollectionByNameOrId("audits");

    audits.indexes = audits.indexes.filter(
      (index) =>
        !String(index).includes("idx_audits_created_at") &&
        !String(index).includes("idx_audits_updated_at"),
    );

    try {
      audits.fields.getByName("created_at");
    } catch {
      audits.fields.add(new DateField({ name: "created_at", required: false }));
    }

    try {
      audits.fields.getByName("updated_at");
    } catch {
      audits.fields.add(new DateField({ name: "updated_at", required: false }));
    }

    app.save(audits);

    const rows = app.findRecordsByFilter("audits", "", "", 0, 0);
    rows.forEach((record) => {
      let timestamp = record.getString("created_at");

      if (!timestamp) {
        try {
          const workflow = app.findFirstRecordByFilter(
            "workflows",
            `audit = "${record.id}"`,
          );
          timestamp = workflow.getString("queued_at");
        } catch {
          timestamp = new Date().toISOString();
        }
      }

      record.set("created_at", timestamp);
      record.set("updated_at", record.getString("updated_at") || timestamp);
      app.save(record);
    });
  },
  (app) => {
    const audits = app.findCollectionByNameOrId("audits");

    try {
      audits.fields.removeByName("created_at");
    } catch {}

    try {
      audits.fields.removeByName("updated_at");
    } catch {}

    audits.indexes = audits.indexes.filter(
      (index) =>
        !String(index).includes("idx_audits_created_at") &&
        !String(index).includes("idx_audits_updated_at"),
    );
    app.save(audits);
  },
);
