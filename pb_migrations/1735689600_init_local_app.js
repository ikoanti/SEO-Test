migrate(
	(app) => {
		const AUTH_COLLECTION = 'users';
		const RUNS_COLLECTION = 'runs';
		const AUDITS_COLLECTION = 'audits';
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
				listRule: 'created_by = @request.auth.id',
				viewRule: 'created_by = @request.auth.id',
				createRule: '@request.auth.id != ""',
				updateRule: 'created_by = @request.auth.id',
				deleteRule: 'created_by = @request.auth.id',
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
				listRule: 'created_by = @request.auth.id',
				viewRule: 'created_by = @request.auth.id',
				createRule: '@request.auth.id != ""',
				updateRule: 'created_by = @request.auth.id',
				deleteRule: 'created_by = @request.auth.id',
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
