migrate((app) => {
    for (const collectionName of ['runs', 'audits']) {
        const collection = app.findCollectionByNameOrId(collectionName)
        const field = collection.fields.getByName('created_by')

        field.required = false
        app.save(collection)
    }
}, () => {})
