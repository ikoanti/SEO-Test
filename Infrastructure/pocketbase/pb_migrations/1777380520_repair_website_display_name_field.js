migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("websites");
    let hasDisplayName = true;

    try {
      collection.fields.getByName("display_name");
    } catch {
      hasDisplayName = false;
    }

    if (!hasDisplayName) {
      collection.fields.add(
        new TextField({
          name: "display_name",
          required: false,
          max: 255,
          presentable: true,
        }),
      );
      app.save(collection);
    }
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("websites");
    try {
      collection.fields.removeByName("display_name");
      app.save(collection);
    } catch {}
  },
);
