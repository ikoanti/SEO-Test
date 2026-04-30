migrate(
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
  () => {},
);

function removeField(collection, name) {
  try {
    collection.fields.removeByName(name);
  } catch {}
}
