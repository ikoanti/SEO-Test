migrate(
	(app) => {
		const AUTHENTICATED_RULE = '@request.auth.id != ""';
		const AUTH_COLLECTION = 'users';
		const RUNS_COLLECTION = 'runs';
		const AUDITS_COLLECTION = 'audits';
		const AUDIT_ITEMS_COLLECTION = 'audit_items';
		const AUDIT_FINDINGS_COLLECTION = 'audit_findings';
		const APP_USER_EMAIL = 'demo@local.test';
		const APP_USER_PASSWORD = 'DemoUser123!';
		const APP_USER_NAME = 'Demo User';
		const SUPERUSER_EMAIL = 'admin@local.test';
		const SUPERUSER_PASSWORD = 'LocalAdmin123!';

		let usersCollection;

		try {
			usersCollection = app.findCollectionByNameOrId(AUTH_COLLECTION);
		} catch {
			usersCollection = new Collection({
				type: 'auth',
				name: AUTH_COLLECTION,
				listRule: 'id = @request.auth.id',
				viewRule: 'id = @request.auth.id',
				updateRule: 'id = @request.auth.id',
				deleteRule: 'id = @request.auth.id',
				manageRule: 'id = @request.auth.id',
				authRule: '',
				fields: [
					{
						name: 'name',
						type: 'text',
						required: true,
						max: 120
					}
				]
			});

			app.save(usersCollection);
		}

		try {
			app.findCollectionByNameOrId(RUNS_COLLECTION);
		} catch {
			const runs = new Collection({
				type: 'base',
				name: RUNS_COLLECTION,
				listRule: AUTHENTICATED_RULE,
				viewRule: AUTHENTICATED_RULE,
				createRule: AUTHENTICATED_RULE,
				updateRule: AUTHENTICATED_RULE,
				deleteRule: AUTHENTICATED_RULE,
				fields: [
					{
						name: 'name',
						type: 'text',
						required: true,
						max: 160
					},
					{
						name: 'url',
						type: 'url',
						required: true
					},
					{
						name: 'created_by',
						type: 'relation',
						required: true,
						maxSelect: 1,
						collectionId: usersCollection.id,
						cascadeDelete: true
					},
					{
						name: 'status',
						type: 'text',
						required: true,
						max: 40
					},
					{
						name: 'queued_at',
						type: 'date',
						required: true
					},
					{
						name: 'started_at',
						type: 'date',
						required: false
					},
					{
						name: 'completed_at',
						type: 'date',
						required: false
					},
					{
						name: 'error_message',
						type: 'editor',
						required: false
					},
					{
						name: 'run_log',
						type: 'editor',
						required: false
					}
				],
				indexes: [
					'CREATE INDEX idx_runs_created_by ON runs (created_by)',
					'CREATE INDEX idx_runs_status ON runs (status)'
				]
			});

			app.save(runs);
		}

		try {
			app.findCollectionByNameOrId(AUDITS_COLLECTION);
		} catch {
			const audits = new Collection({
				type: 'base',
				name: AUDITS_COLLECTION,
				listRule: AUTHENTICATED_RULE,
				viewRule: AUTHENTICATED_RULE,
				createRule: AUTHENTICATED_RULE,
				updateRule: AUTHENTICATED_RULE,
				deleteRule: AUTHENTICATED_RULE,
				fields: [
					{
						name: 'run',
						type: 'relation',
						required: true,
						maxSelect: 1,
						collectionId: app.findCollectionByNameOrId(RUNS_COLLECTION).id,
						cascadeDelete: true
					},
					{
						name: 'name',
						type: 'text',
						required: true,
						max: 160
					},
					{
						name: 'url',
						type: 'url',
						required: true
					},
					{
						name: 'created_by',
						type: 'relation',
						required: true,
						maxSelect: 1,
						collectionId: usersCollection.id,
						cascadeDelete: true
					},
					{
						name: 'completed_at',
						type: 'date',
						required: true
					},
						{
							name: 'summary_json',
							type: 'editor',
							required: true
						},
						{
							name: 'report_html',
							type: 'editor',
							required: false
						},
						{
							name: 'ai_visibility_json',
							type: 'editor',
							required: false
						},
						{
							name: 'audit_json',
							type: 'editor',
						required: true
					}
				],
				indexes: [
					'CREATE UNIQUE INDEX idx_audits_run ON audits (run)',
					'CREATE INDEX idx_audits_created_by ON audits (created_by)'
				]
			});

			app.save(audits);
		}

		try {
			app.findCollectionByNameOrId(AUDIT_ITEMS_COLLECTION);
		} catch {
				const auditItems = new Collection({
					type: 'base',
					name: AUDIT_ITEMS_COLLECTION,
					listRule: AUTHENTICATED_RULE,
					viewRule: AUTHENTICATED_RULE,
					createRule: AUTHENTICATED_RULE,
					updateRule: AUTHENTICATED_RULE,
					deleteRule: AUTHENTICATED_RULE,
				fields: [
					{
						name: 'audit',
						type: 'relation',
						required: true,
						maxSelect: 1,
						collectionId: app.findCollectionByNameOrId(AUDITS_COLLECTION).id,
						cascadeDelete: true
					},
					{ name: 'key', type: 'text', required: true, max: 120 },
					{ name: 'label', type: 'text', required: true, max: 160 },
					{ name: 'status', type: 'text', required: true, max: 40 },
					{ name: 'summary', type: 'editor', required: false },
					{ name: 'stats_json', type: 'editor', required: false },
					{ name: 'sort_order', type: 'number', required: true, onlyInt: true, min: 0 }
				],
				indexes: [
					'CREATE INDEX idx_audit_items_audit ON audit_items (audit)',
					'CREATE UNIQUE INDEX idx_audit_items_audit_key ON audit_items (audit, key)'
				]
			});

			app.save(auditItems);
		}

		try {
			app.findCollectionByNameOrId(AUDIT_FINDINGS_COLLECTION);
		} catch {
				const auditFindings = new Collection({
					type: 'base',
					name: AUDIT_FINDINGS_COLLECTION,
					listRule: AUTHENTICATED_RULE,
					viewRule: AUTHENTICATED_RULE,
					createRule: AUTHENTICATED_RULE,
					updateRule: AUTHENTICATED_RULE,
					deleteRule: AUTHENTICATED_RULE,
				fields: [
					{
						name: 'audit',
						type: 'relation',
						required: true,
						maxSelect: 1,
						collectionId: app.findCollectionByNameOrId(AUDITS_COLLECTION).id,
						cascadeDelete: true
					},
					{
						name: 'audit_item',
						type: 'relation',
						required: true,
						maxSelect: 1,
						collectionId: app.findCollectionByNameOrId(AUDIT_ITEMS_COLLECTION).id,
						cascadeDelete: true
					},
					{ name: 'status', type: 'text', required: true, max: 40 },
					{ name: 'title', type: 'text', required: true, max: 255 },
					{ name: 'detail', type: 'editor', required: false },
					{ name: 'page_url', type: 'url', required: false },
					{ name: 'meta_json', type: 'editor', required: false }
				],
				indexes: [
					'CREATE INDEX idx_audit_findings_audit ON audit_findings (audit)',
					'CREATE INDEX idx_audit_findings_item ON audit_findings (audit_item)'
				]
			});

			app.save(auditFindings);
		}

		try {
			app.findAuthRecordByEmail(AUTH_COLLECTION, APP_USER_EMAIL);
		} catch {
			const demoUser = new Record(usersCollection);
			demoUser.set('email', APP_USER_EMAIL);
			demoUser.set('password', APP_USER_PASSWORD);
			demoUser.set('name', APP_USER_NAME);
			app.save(demoUser);
		}

		try {
			app.findAuthRecordByEmail('_superusers', SUPERUSER_EMAIL);
		} catch {
			const superusers = app.findCollectionByNameOrId('_superusers');
			const superuser = new Record(superusers);
			superuser.set('email', SUPERUSER_EMAIL);
			superuser.set('password', SUPERUSER_PASSWORD);
			app.save(superuser);
		}
	},
		(app) => {
			try {
				const auditFindings = app.findCollectionByNameOrId('audit_findings');
				app.delete(auditFindings);
			} catch {}

			try {
				const auditItems = app.findCollectionByNameOrId('audit_items');
				app.delete(auditItems);
			} catch {}

			try {
				const audits = app.findCollectionByNameOrId('audits');
				app.delete(audits);
			} catch {}

			try {
				const runs = app.findCollectionByNameOrId('runs');
				app.delete(runs);
			} catch {}

			try {
				const usersCollection = app.findCollectionByNameOrId('users');
				app.delete(usersCollection);
			} catch {}

			try {
				const superuser = app.findAuthRecordByEmail('_superusers', 'admin@local.test');
				app.delete(superuser);
			} catch {}
	}
);
