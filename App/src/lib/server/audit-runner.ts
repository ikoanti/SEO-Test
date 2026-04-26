import { runAudit } from '$lib/server/audit';
import {
	buildNormalizedAuditItems,
	getNormalizedSectionDefinitions,
	type AuditResult
} from '$lib/server/audit-normalize';
import {
	createAuditFindingRecord,
	createAuditScreenshotRecord,
	deleteAuditFindingsByRunId,
	deleteAuditScreenshotsByRunId,
	getOrCreateAuditFindingTypeRecord,
	getOrCreateRunRecord,
	getWorkflow,
	updateAuditRecord,
	updateRunRecord,
	updateWorkflowRecord
} from '$lib/server/pocketbase';

type QueuePayload = {
	workflowId: string;
	auditId: string;
	url: string;
	token?: string;
};

type AuditRunnerState = {
	activeWorkflows: Set<string>;
};

type AuditSummaryResult = AuditResult;

type ScreenshotPayload = {
	contentType?: string;
	imageBase64?: string;
};

type WorkflowRecordLike = {
	id?: string;
	status?: string;
	audit?: string;
	expand?: {
		audit?: {
			id?: string;
			expand?: {
				website?: {
					url?: string;
				};
			};
		};
	};
};

const state = ((
	globalThis as typeof globalThis & { __auditRunnerState?: AuditRunnerState }
).__auditRunnerState ??= {
	activeWorkflows: new Set<string>()
});

function timestamp() {
	return new Date().toISOString();
}

function appendLog(existing: string | undefined, message: string) {
	const line = `[${timestamp()}] ${message}`;
	return existing?.trim() ? `${existing}\n${line}` : line;
}

function buildSummary(audit: AuditSummaryResult) {
	return {
		domain: audit.domain,
		auditedAt: audit.auditedAt,
		summary: audit.summary,
		pageSpeed: audit.pageSpeed,
		openPageRank: audit.openPageRank
	};
}

function formatAuditError(error: unknown) {
	if (!(error instanceof Error)) {
		return 'Unknown audit failure.';
	}

	const response = (error as Error & { response?: unknown }).response;
	if (response && typeof response === 'object') {
		return `${error.message}: ${JSON.stringify(response)}`;
	}

	return error.message;
}

function getRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function extractScreenshotFromMeta(metaJson: string) {
	if (!metaJson) {
		return {
			meta_json: metaJson,
			screenshot: null as ScreenshotPayload | null
		};
	}

	try {
		const meta = JSON.parse(metaJson) as Record<string, unknown>;
		const directScreenshot = getRecord(meta.screenshot);
		const nestedMeta = getRecord(meta.meta);
		const nestedScreenshot = getRecord(nestedMeta?.screenshot);
		const screenshot = (directScreenshot || nestedScreenshot) as ScreenshotPayload | null;

		if (directScreenshot) {
			delete meta.screenshot;
		}

		if (nestedMeta && nestedScreenshot) {
			delete nestedMeta.screenshot;
			meta.meta = nestedMeta;
		}

		return {
			meta_json: JSON.stringify(meta),
			screenshot:
				screenshot?.contentType && screenshot?.imageBase64
					? {
							contentType: screenshot.contentType,
							imageBase64: screenshot.imageBase64
						}
					: null
		};
	} catch {
		return {
			meta_json: metaJson,
			screenshot: null as ScreenshotPayload | null
		};
	}
}

async function persistScreenshotIfPresent(
	input: {
		auditId: string;
		findingTypeId: string;
		runId: string;
		title: string;
		page_url?: string;
		screenshot: ScreenshotPayload | null;
	},
	token?: string
) {
	if (!input.screenshot?.contentType || !input.screenshot.imageBase64) return;

	await createAuditScreenshotRecord(
		{
			audit: input.auditId,
			audit_finding_type: input.findingTypeId,
			run: input.runId,
			title: input.title,
			page_url: input.page_url,
			content_type: input.screenshot.contentType,
			image_base64: input.screenshot.imageBase64
		},
		token
	);
}

const STEP_KEYS: Record<string, string[]> = {
	crawl: [],
	homepage: [
		'structuredData',
		'webIcons',
		'ssl',
		'mobileUsability',
		'flash',
		'charset',
		'loremIpsum',
		'openGraph',
		'internationalDomains',
		'trustSignals',
		'lazyLoadImages'
	],
	robots: ['robotsTxt'],
	sitemap: ['sitemap'],
	'page-analysis': [
		'h1Tags',
		'metaTitles',
		'imageAltTags',
		'canonicalUrls',
		'internalLinks',
		'contentQuality',
		'shopifyUrls'
	],
	pagespeed: ['pageSpeed'],
	openpagerank: ['openPageRank']
};

type RunRegistry = Map<
	string,
	{
		runId: string;
		findingTypeId: string;
		label: string;
		sortOrder: number;
	}
>;

async function bootstrapRuns(workflowId: string, token?: string) {
	const registry: RunRegistry = new Map();

	for (const definition of getNormalizedSectionDefinitions()) {
		const findingType = await getOrCreateAuditFindingTypeRecord(definition, token);
		const run = await getOrCreateRunRecord(
			{
				workflow: workflowId,
				audit_finding_type: findingType.id,
				status: 'queued',
				started_at: timestamp(),
				run_log: appendLog('', `${definition.label} queued.`),
				sort_order: definition.sort_order
			},
			token
		);
		registry.set(definition.key, {
			runId: run.id,
			findingTypeId: findingType.id,
			label: definition.label,
			sortOrder: definition.sort_order
		});
	}

	return registry;
}

async function markStepRunning(runRegistry: RunRegistry, stepLabel: string, token?: string) {
	for (const key of STEP_KEYS[stepLabel] || []) {
		const entry = runRegistry.get(key);
		if (!entry) continue;
		await updateRunRecord(
			entry.runId,
			{
				status: 'running',
				started_at: timestamp(),
				error_message: '',
				run_log: appendLog('', `${entry.label} running.`)
			},
			token
		);
	}
}

async function syncProgressSnapshot(
	auditId: string,
	partialAudit: AuditSummaryResult,
	runRegistry: RunRegistry,
	token?: string
) {
	const normalizedItems = buildNormalizedAuditItems(partialAudit);
	for (const item of normalizedItems) {
		const run = runRegistry.get(item.key);
		if (!run) continue;

		await deleteAuditFindingsByRunId(run.runId, token);
		await deleteAuditScreenshotsByRunId(run.runId, token);

		if (item.findings.length === 0) {
			const { meta_json, screenshot } = extractScreenshotFromMeta(item.stats_json);
			await persistScreenshotIfPresent(
				{
					auditId,
					findingTypeId: run.findingTypeId,
					runId: run.runId,
					title: item.label,
					screenshot
				},
				token
			);
			await createAuditFindingRecord(
				{
					audit: auditId,
					audit_finding_type: run.findingTypeId,
					run: run.runId,
					status: item.status,
					title: item.label,
					detail: item.summary,
					meta_json
				},
				token
			);
		} else {
			for (const finding of item.findings) {
				const { meta_json, screenshot } = extractScreenshotFromMeta(finding.meta_json);
				await persistScreenshotIfPresent(
					{
						auditId,
						findingTypeId: run.findingTypeId,
						runId: run.runId,
						title: finding.detail || finding.title || item.label,
						page_url: finding.page_url,
						screenshot
					},
					token
				);
				await createAuditFindingRecord(
					{
						audit: auditId,
						audit_finding_type: run.findingTypeId,
						run: run.runId,
						status: finding.status,
						title: finding.title,
						detail: finding.detail,
						page_url: finding.page_url,
						meta_json
					},
					token
				);
			}
		}

		await updateRunRecord(
			run.runId,
			{
				status: 'completed',
				completed_at: timestamp(),
				error_message: '',
				run_log: item.summary
			},
			token
		);
	}

	await updateAuditRecord(
		auditId,
		{
			audit_json: JSON.stringify(partialAudit),
			summary_json: JSON.stringify(buildSummary(partialAudit))
		},
		token
	);
}

async function finalizeUnsyncedRuns(
	runRegistry: RunRegistry,
	partialAudit: AuditSummaryResult,
	token?: string
) {
	const completedKeys = new Set(buildNormalizedAuditItems(partialAudit).map((item) => item.key));
	for (const [key, run] of runRegistry.entries()) {
		if (completedKeys.has(key)) continue;
		await updateRunRecord(
			run.runId,
			{
				status: 'completed',
				completed_at: timestamp(),
				error_message: '',
				run_log: `${run.label} did not produce persisted results in the current engine.`
			},
			token
		);
	}
}

async function processAuditWorkflow({ workflowId, auditId, url, token }: QueuePayload) {
	const workflowRecord = await getWorkflow(workflowId, token);
	let runLog = appendLog(workflowRecord.run_log, 'Workflow started.');
	const runRegistry = await bootstrapRuns(workflowId, token);

	await updateWorkflowRecord(
		workflowId,
		{
			status: 'running',
			started_at: timestamp(),
			error_message: '',
			run_log: runLog
		},
		token
	);
	await updateAuditRecord(auditId, { status: 'running' }, token);

	try {
		const audit = await runAudit(url, {
			onStepStart: async (stepLabel: string) => {
				runLog = appendLog(runLog, `${stepLabel} started.`);
				await updateWorkflowRecord(workflowId, { run_log: runLog }, token);
				await markStepRunning(runRegistry, stepLabel, token);
			},
			onStepComplete: async (stepLabel: string, partialAudit: AuditSummaryResult) => {
				runLog = appendLog(runLog, `${stepLabel} completed.`);
				await updateWorkflowRecord(workflowId, { run_log: runLog }, token);
				await syncProgressSnapshot(auditId, partialAudit, runRegistry, token);
			}
		});
		runLog = appendLog(runLog, 'Audit engine completed successfully.');
		const completedAt = timestamp();
		await syncProgressSnapshot(auditId, audit, runRegistry, token);
		await finalizeUnsyncedRuns(runRegistry, audit, token);

		await updateAuditRecord(
			auditId,
			{
				status: 'completed',
				audit_json: JSON.stringify(audit),
				summary_json: JSON.stringify(buildSummary(audit)),
				completed_at: completedAt
			},
			token
		);
		await updateWorkflowRecord(
			workflowId,
			{
				status: 'completed',
				completed_at: completedAt,
				run_log: runLog,
				error_message: ''
			},
			token
		);
	} catch (error) {
		const message = formatAuditError(error);
		runLog = appendLog(runLog, `Workflow failed: ${message}`);

		await updateAuditRecord(auditId, { status: 'failed' }, token);
		await updateWorkflowRecord(
			workflowId,
			{
				status: 'failed',
				completed_at: timestamp(),
				error_message: message,
				run_log: runLog
			},
			token
		);
	}
}

export function queueAuditWorkflow(payload: QueuePayload) {
	if (state.activeWorkflows.has(payload.workflowId)) {
		return;
	}

	state.activeWorkflows.add(payload.workflowId);

	void processAuditWorkflow(payload)
		.catch((error) => {
			console.error(
				`[audit-runner] ${payload.workflowId} failed:`,
				error instanceof Error ? error.message : error
			);
		})
		.finally(() => {
			state.activeWorkflows.delete(payload.workflowId);
		});
}

export function ensureAuditWorkflowProcessing(record: WorkflowRecordLike, token?: string) {
	if (!record?.id || !['queued', 'running'].includes(String(record.status || ''))) {
		return;
	}

	const auditId = record.audit || record.expand?.audit?.id;
	const url = record.expand?.audit?.expand?.website?.url;
	if (!auditId || !url) {
		return;
	}

	queueAuditWorkflow({
		workflowId: record.id,
		auditId,
		url,
		token
	});
}
