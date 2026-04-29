migrate(
  (app) => {
    const collectionNames = [
      "audit_screenshots",
      "audit_findings",
      "runs",
      "workflows",
      "audit_reports",
      "audits",
    ];

    collectionNames.forEach((collectionName) => {
      let records = [];
      try {
        records = app.findRecordsByFilter(collectionName, "", "", 0, 0);
      } catch {
        return;
      }

      records.forEach((record) => {
        app.delete(record);
      });
    });
  },
  () => {},
);
