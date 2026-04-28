migrate(
  (app) => {
    const deleteAll = (collectionName) => {
      const records = app.findRecordsByFilter(collectionName, "", "", 0, 0);
      records.forEach((record) => app.delete(record));
    };

    deleteAll("audit_reports");
    deleteAll("audits");
  },
  () => {},
);
