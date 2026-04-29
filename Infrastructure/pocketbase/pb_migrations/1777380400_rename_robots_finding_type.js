migrate(
  (app) => {
    let findingType;

    try {
      findingType = app.findFirstRecordByFilter(
        "audit_finding_types",
        'key = "robotsTxt"',
      );
    } catch {
      return;
    }

    findingType.set("label", "AI Chatbots/LLMs Not Whitelisted");
    app.save(findingType);
  },
  (app) => {
    let findingType;

    try {
      findingType = app.findFirstRecordByFilter(
        "audit_finding_types",
        'key = "robotsTxt"',
      );
    } catch {
      return;
    }

    findingType.set("label", "Robots.txt");
    app.save(findingType);
  },
);
