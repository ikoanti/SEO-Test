migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("workflows");

    ensureTextField(collection, "dataforseo_task_id", 255);
    ensureDateField(collection, "dataforseo_task_queued_at");
    ensureDateField(collection, "dataforseo_task_ready_at");
    ensureDateField(collection, "dataforseo_last_checked_at");

    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("workflows");

    removeField(collection, "dataforseo_task_id");
    removeField(collection, "dataforseo_task_queued_at");
    removeField(collection, "dataforseo_task_ready_at");
    removeField(collection, "dataforseo_last_checked_at");

    app.save(collection);
  },
);

function ensureTextField(collection, name, max) {
  try {
    collection.fields.getByName(name);
  } catch {
    collection.fields.add(
      new TextField({
        name,
        required: false,
        max,
      }),
    );
  }
}

function ensureDateField(collection, name) {
  try {
    collection.fields.getByName(name);
  } catch {
    collection.fields.add(new DateField({ name, required: false }));
  }
}

function removeField(collection, name) {
  try {
    collection.fields.removeByName(name);
  } catch {}
}
