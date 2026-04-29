migrate(
  (app) => {
    let findingType;

    try {
      findingType = app.findFirstRecordByFilter(
        "audit_finding_types",
        'key = "pageSpeed"',
      );
    } catch {
      return;
    }

    findingType.set("label", "Unoptimized page speed");
    app.save(findingType);
  },
  (app) => {
    let findingType;

    try {
      findingType = app.findFirstRecordByFilter(
        "audit_finding_types",
        'key = "pageSpeed"',
      );
    } catch {
      return;
    }

    findingType.set("label", "Page Speed");
    app.save(findingType);
  },
);
