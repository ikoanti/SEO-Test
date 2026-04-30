migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("websites");

    addTextField(collection, "google_drive_folder_id", 255);
    addTextField(collection, "google_drive_folder_name", 255);
    addTextField(collection, "google_doc_id", 255);
    addTextField(collection, "google_doc_name", 255);
    addTextField(collection, "google_doc_url", 1000);
    addDateField(collection, "google_doc_exported_at");

    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("websites");

    removeField(collection, "google_drive_folder_id");
    removeField(collection, "google_drive_folder_name");
    removeField(collection, "google_doc_id");
    removeField(collection, "google_doc_name");
    removeField(collection, "google_doc_url");
    removeField(collection, "google_doc_exported_at");

    app.save(collection);
  },
);

function addTextField(collection, name, max) {
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

function addDateField(collection, name) {
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
