migrate((app) => {
    const authenticatedRule = '@request.auth.id != ""'
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
        app.findCollectionByNameOrId('websites')
    } catch {
        app.save(new Collection({
            type: 'base',
            name: 'websites',
            listRule: authenticatedRule,
            viewRule: authenticatedRule,
            createRule: authenticatedRule,
            updateRule: authenticatedRule,
            deleteRule: authenticatedRule,
            fields: [
                { name: 'url', type: 'url', required: true, presentable: true },
                { name: 'domain', type: 'text', required: true, max: 255 }
            ],
            indexes: [
                'CREATE UNIQUE INDEX idx_websites_url ON websites (url)',
                'CREATE INDEX idx_websites_domain ON websites (domain)'
            ]
        }))
    }

    try {
        app.findCollectionByNameOrId('audit_finding_types')
    } catch {
        app.save(new Collection({
            type: 'base',
            name: 'audit_finding_types',
            listRule: authenticatedRule,
            viewRule: authenticatedRule,
            createRule: authenticatedRule,
            updateRule: authenticatedRule,
            deleteRule: authenticatedRule,
            fields: [
                { name: 'key', type: 'text', required: true, max: 120, presentable: true },
                { name: 'label', type: 'text', required: true, max: 160 },
                { name: 'sort_order', type: 'number', required: true, onlyInt: true, min: 1 }
            ],
            indexes: [
                'CREATE UNIQUE INDEX idx_audit_finding_types_key ON audit_finding_types (key)',
                'CREATE INDEX idx_audit_finding_types_sort ON audit_finding_types (sort_order)'
            ]
        }))
    }

    const findingTypesCollection = app.findCollectionByNameOrId('audit_finding_types')
    const findingTypes = [
        ['pageSpeed', 'Page Speed'],
        ['openPageRank', 'Open PageRank'],
        ['h1Tags', 'H1 Tags'],
        ['metaTitles', 'Meta Titles'],
        ['imageAltTags', 'Image Alt Tags'],
        ['canonicalUrls', 'Canonical URLs'],
        ['internalLinks', 'Internal Links'],
        ['sitemap', 'Sitemap'],
        ['robotsTxt', 'Robots.txt'],
        ['llmsTxt', 'LLMs.txt'],
        ['structuredData', 'Structured Data'],
        ['security', 'Security'],
        ['mixedContent', 'Mixed Content'],
        ['contentQuality', 'Content Quality'],
        ['webIcons', 'Web Icons'],
        ['ssl', 'SSL'],
        ['mobileUsability', 'Mobile Usability'],
        ['flash', 'Flash'],
        ['iframes', 'Iframes'],
        ['charset', 'Charset'],
        ['loremIpsum', 'Lorem Ipsum'],
        ['openGraph', 'Open Graph'],
        ['shopifyUrls', 'Shopify URLs'],
        ['internationalDomains', 'International Domains'],
        ['trailingSlash', 'Trailing Slash'],
        ['wwwResolve', 'WWW Resolve'],
        ['trustSignals', 'Trust Signals'],
        ['tapTargets', 'Tap Targets'],
        ['lazyLoadImages', 'Lazy Load Images'],
        ['aiVisibility', 'AI Visibility']
    ]

    findingTypes.forEach(([key, label], index) => {
        try {
            app.findFirstRecordByFilter('audit_finding_types', `key = "${key}"`)
        } catch {
            const record = new Record(findingTypesCollection)
            record.set('key', key)
            record.set('label', label)
            record.set('sort_order', index + 1)
            app.save(record)
        }
    })

    try {
        app.findCollectionByNameOrId('audits')
    } catch {
        app.save(new Collection({
            type: 'base',
            name: 'audits',
            listRule: authenticatedRule,
            viewRule: authenticatedRule,
            createRule: authenticatedRule,
            updateRule: authenticatedRule,
            deleteRule: authenticatedRule,
            fields: [
                { name: 'website', type: 'relation', required: true, maxSelect: 1, collectionId: app.findCollectionByNameOrId('websites').id, cascadeDelete: true },
                { name: 'created_by', type: 'relation', required: false, maxSelect: 1, collectionId: authCollection.id, cascadeDelete: true },
                { name: 'status', type: 'select', required: true, maxSelect: 1, values: ['queued', 'running', 'completed', 'failed'] },
                { name: 'completed_at', type: 'date', required: false },
                { name: 'summary_json', type: 'editor', required: false },
                { name: 'report_status', type: 'select', required: false, maxSelect: 1, values: ['idle', 'queued', 'running', 'completed', 'failed'] },
                { name: 'report_error', type: 'editor', required: false },
                { name: 'report_started_at', type: 'date', required: false },
                { name: 'report_completed_at', type: 'date', required: false },
                { name: 'report_html', type: 'editor', required: false },
                { name: 'ai_visibility_json', type: 'editor', required: false },
                { name: 'audit_json', type: 'editor', required: false }
            ],
            indexes: [
                'CREATE INDEX idx_audits_website ON audits (website)',
                'CREATE INDEX idx_audits_created_by ON audits (created_by)',
                'CREATE INDEX idx_audits_status ON audits (status)'
            ]
        }))
    }

    try {
        app.findCollectionByNameOrId('workflows')
    } catch {
        app.save(new Collection({
            type: 'base',
            name: 'workflows',
            listRule: authenticatedRule,
            viewRule: authenticatedRule,
            createRule: authenticatedRule,
            updateRule: authenticatedRule,
            deleteRule: authenticatedRule,
            fields: [
                { name: 'audit', type: 'relation', required: true, maxSelect: 1, collectionId: app.findCollectionByNameOrId('audits').id, cascadeDelete: true },
                { name: 'status', type: 'select', required: true, maxSelect: 1, values: ['queued', 'running', 'completed', 'failed'] },
                { name: 'queued_at', type: 'date', required: true },
                { name: 'started_at', type: 'date', required: false },
                { name: 'completed_at', type: 'date', required: false },
                { name: 'error_message', type: 'editor', required: false },
                { name: 'run_log', type: 'editor', required: false }
            ],
            indexes: [
                'CREATE UNIQUE INDEX idx_workflows_audit ON workflows (audit)',
                'CREATE INDEX idx_workflows_status ON workflows (status)'
            ]
        }))
    }

    try {
        app.findCollectionByNameOrId('runs')
    } catch {
        app.save(new Collection({
            type: 'base',
            name: 'runs',
            listRule: authenticatedRule,
            viewRule: authenticatedRule,
            createRule: authenticatedRule,
            updateRule: authenticatedRule,
            deleteRule: authenticatedRule,
            fields: [
                { name: 'workflow', type: 'relation', required: true, maxSelect: 1, collectionId: app.findCollectionByNameOrId('workflows').id, cascadeDelete: true },
                { name: 'audit_finding_type', type: 'relation', required: true, maxSelect: 1, collectionId: app.findCollectionByNameOrId('audit_finding_types').id, cascadeDelete: true },
                { name: 'status', type: 'select', required: true, maxSelect: 1, values: ['queued', 'running', 'completed', 'failed'] },
                { name: 'started_at', type: 'date', required: true },
                { name: 'completed_at', type: 'date', required: false },
                { name: 'error_message', type: 'editor', required: false },
                { name: 'run_log', type: 'editor', required: false },
                { name: 'sort_order', type: 'number', required: true, onlyInt: true, min: 1 }
            ],
            indexes: [
                'CREATE INDEX idx_runs_workflow ON runs (workflow)',
                'CREATE INDEX idx_runs_finding_type ON runs (audit_finding_type)',
                'CREATE UNIQUE INDEX idx_runs_workflow_finding_type ON runs (workflow, audit_finding_type)'
            ]
        }))
    }

    try {
        app.findCollectionByNameOrId('audit_findings')
    } catch {
        app.save(new Collection({
            type: 'base',
            name: 'audit_findings',
            listRule: authenticatedRule,
            viewRule: authenticatedRule,
            createRule: authenticatedRule,
            updateRule: authenticatedRule,
            deleteRule: authenticatedRule,
            fields: [
                { name: 'audit', type: 'relation', required: true, maxSelect: 1, collectionId: app.findCollectionByNameOrId('audits').id, cascadeDelete: true },
                { name: 'audit_finding_type', type: 'relation', required: true, maxSelect: 1, collectionId: app.findCollectionByNameOrId('audit_finding_types').id, cascadeDelete: true },
                { name: 'run', type: 'relation', required: false, maxSelect: 1, collectionId: app.findCollectionByNameOrId('runs').id, cascadeDelete: true },
                { name: 'status', type: 'select', required: true, maxSelect: 1, values: ['pass', 'warn', 'fail', 'info'] },
                { name: 'title', type: 'text', required: true, max: 255 },
                { name: 'detail', type: 'editor', required: false },
                { name: 'page_url', type: 'url', required: false },
                { name: 'meta_json', type: 'editor', required: false }
            ],
            indexes: [
                'CREATE INDEX idx_audit_findings_audit ON audit_findings (audit)',
                'CREATE INDEX idx_audit_findings_type ON audit_findings (audit_finding_type)',
                'CREATE INDEX idx_audit_findings_run ON audit_findings (run)'
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
    for (const collectionName of [
        'audit_findings',
        'runs',
        'workflows',
        'audit_reports',
        'audits',
        'audit_finding_types',
        'websites'
    ]) {
        try {
            app.delete(app.findCollectionByNameOrId(collectionName))
        } catch {}
    }

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
