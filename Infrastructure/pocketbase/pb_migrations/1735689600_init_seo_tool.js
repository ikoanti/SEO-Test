migrate((app) => {
    const superuserEmail = $os.getenv('POCKETBASE_SUPERUSER_EMAIL')
    const superuserPassword = $os.getenv('POCKETBASE_SUPERUSER_PASSWORD')

    if (superuserEmail && superuserPassword) {
        try {
            app.findAuthRecordByEmail('_superusers', superuserEmail)
        } catch {
            const superusers = app.findCollectionByNameOrId('_superusers')
            const record = new Record(superusers)
            record.set('email', superuserEmail)
            record.set('password', superuserPassword)
            app.save(record)
        }
    }

    const authCollectionName = $os.getenv('POCKETBASE_AUTH_COLLECTION') || 'users'
    let authCollection

    try {
        authCollection = app.findCollectionByNameOrId(authCollectionName)
    } catch {
        authCollection = new Collection({
            type: 'auth',
            name: authCollectionName,
            listRule: 'id = @request.auth.id',
            viewRule: 'id = @request.auth.id',
            createRule: null,
            updateRule: 'id = @request.auth.id',
            deleteRule: null,
            authRule: '',
            passwordAuth: {
                enabled: true,
                identityFields: ['email']
            },
            fields: [
                { name: 'name', type: 'text', required: true, max: 120 }
            ],
            indexes: [
                `CREATE UNIQUE INDEX idx_${authCollectionName}_email ON ${authCollectionName} (email)`
            ]
        })
        app.save(authCollection)
    }

    try {
        app.findCollectionByNameOrId('runs')
    } catch {
        app.save(new Collection({
            type: 'base',
            name: 'runs',
            listRule: 'created_by = @request.auth.id',
            viewRule: 'created_by = @request.auth.id',
            createRule: '@request.auth.id != ""',
            updateRule: 'created_by = @request.auth.id',
            deleteRule: 'created_by = @request.auth.id',
            fields: [
                { name: 'name', type: 'text', required: true, max: 160 },
                { name: 'url', type: 'url', required: true, presentable: true },
                { name: 'created_by', type: 'relation', required: true, maxSelect: 1, collectionId: authCollection.id, cascadeDelete: true },
                { name: 'status', type: 'text', required: true, max: 40 },
                { name: 'queued_at', type: 'date', required: true },
                { name: 'started_at', type: 'date', required: false },
                { name: 'completed_at', type: 'date', required: false },
                { name: 'error_message', type: 'editor', required: false },
                { name: 'run_log', type: 'editor', required: false },
            ],
            indexes: [
                'CREATE INDEX idx_runs_created_by ON runs (created_by)',
                'CREATE INDEX idx_runs_status ON runs (status)'
            ]
        }))
    }

    try {
        app.findCollectionByNameOrId('audits')
    } catch {
        app.save(new Collection({
            type: 'base',
            name: 'audits',
            listRule: 'created_by = @request.auth.id',
            viewRule: 'created_by = @request.auth.id',
            createRule: '@request.auth.id != ""',
            updateRule: 'created_by = @request.auth.id',
            deleteRule: 'created_by = @request.auth.id',
            fields: [
                { name: 'run', type: 'relation', required: true, maxSelect: 1, collectionId: app.findCollectionByNameOrId('runs').id, cascadeDelete: true },
                { name: 'name', type: 'text', required: true, max: 160 },
                { name: 'url', type: 'url', required: true, presentable: true },
                { name: 'created_by', type: 'relation', required: true, maxSelect: 1, collectionId: authCollection.id, cascadeDelete: true },
                { name: 'completed_at', type: 'date', required: true },
                { name: 'summary_json', type: 'editor', required: true },
                { name: 'report_html', type: 'editor', required: false },
                { name: 'ai_visibility_json', type: 'editor', required: false },
                { name: 'audit_json', type: 'editor', required: true }
            ],
            indexes: [
                'CREATE UNIQUE INDEX idx_audits_run ON audits (run)',
                'CREATE INDEX idx_audits_created_by ON audits (created_by)'
            ]
        }))
    }

    try {
        app.findCollectionByNameOrId('audit_reports')
    } catch {
        app.save(new Collection({
            type: 'base',
            name: 'audit_reports',
            listRule: null,
            viewRule: null,
            createRule: null,
            updateRule: null,
            deleteRule: null,
            fields: [
                { name: 'target_url', type: 'url', required: true, presentable: true },
                { name: 'domain', type: 'text', required: true, max: 255 },
                { name: 'generated_at', type: 'date', required: true },
                { name: 'passed_count', type: 'number', required: false, onlyInt: true, min: 0 },
                { name: 'warning_count', type: 'number', required: false, onlyInt: true, min: 0 },
                { name: 'failed_count', type: 'number', required: false, onlyInt: true, min: 0 },
                { name: 'audit_json', type: 'editor', required: true },
                { name: 'report_html', type: 'editor', required: true }
            ],
            indexes: [
                'CREATE INDEX idx_audit_reports_domain ON audit_reports (domain)',
                'CREATE INDEX idx_audit_reports_generated_at ON audit_reports (generated_at)'
            ]
        }))
    }

    const appAuthEmail = $os.getenv('APP_AUTH_EMAIL')
    const appAuthPassword = $os.getenv('APP_AUTH_PASSWORD')
    const appAuthName = $os.getenv('APP_AUTH_NAME') || 'App User'

    if (appAuthEmail && appAuthPassword) {
        try {
            app.findAuthRecordByEmail(authCollectionName, appAuthEmail)
        } catch {
            const authCollection = app.findCollectionByNameOrId(authCollectionName)
            const authRecord = new Record(authCollection)
            authRecord.set('email', appAuthEmail)
            authRecord.set('password', appAuthPassword)
            authRecord.set('passwordConfirm', appAuthPassword)
            authRecord.set('name', appAuthName)
            authRecord.set('verified', true)
            app.save(authRecord)
        }
    }
}, (app) => {
    try {
        app.delete(app.findCollectionByNameOrId('audit_reports'))
    } catch {}

    try {
        app.delete(app.findCollectionByNameOrId('audits'))
    } catch {}

    try {
        app.delete(app.findCollectionByNameOrId('runs'))
    } catch {}

    const authCollectionName = $os.getenv('POCKETBASE_AUTH_COLLECTION') || 'users'
    const appAuthEmail = $os.getenv('APP_AUTH_EMAIL')

    if (appAuthEmail) {
        try {
            app.delete(app.findAuthRecordByEmail(authCollectionName, appAuthEmail))
        } catch {}
    }

    try {
        app.delete(app.findCollectionByNameOrId(authCollectionName))
    } catch {}

    const superuserEmail = $os.getenv('POCKETBASE_SUPERUSER_EMAIL')
    if (superuserEmail) {
        try {
            app.delete(app.findAuthRecordByEmail('_superusers', superuserEmail))
        } catch {}
    }
})
