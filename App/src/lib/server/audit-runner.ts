import { runAudit } from '$lib/server/audit';
import {
	attachMetricScreenshots,
	buildNormalizedAuditItems,
	getNormalizedSectionDefinitions,
	type AuditResult
} from '$lib/server/audit-normalize';
import { runAuditCaptureRequest, type AuditCaptureRequest } from '$lib/server/audit-capture';
import {
	createAuditFindingRecord,
	createAuditScreenshotRecord,
	deleteAuditFindingsByRunId,
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

type ScreenshotJob = {
	auditId: string;
	findingTypeId: string;
	runId: string;
	title: string;
	page_url?: string;
	request: AuditCaptureRequest;
};

type ScreenshotQueueState = {
	chain: Promise<void>;
	queuedKeys: Set<string>;
	activeKeys: Set<string>;
	completedKeys: Set<string>;
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

const screenshotQueueState = ((
	globalThis as typeof globalThis & { __auditScreenshotQueueState?: ScreenshotQueueState }
).__auditScreenshotQueueState ??= {
	chain: Promise.resolve(),
	queuedKeys: new Set<string>(),
	activeKeys: new Set<string>(),
	completedKeys: new Set<string>()
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

function stripScreenshots(value: unknown): unknown {
	if (!value || typeof value !== 'object') return value;
	if (Array.isArray(value)) return value.map((item) => stripScreenshots(item));

	const source = value as Record<string, unknown>;
	const target: Record<string, unknown> = {};
	for (const [key, nestedValue] of Object.entries(source)) {
		if (key === 'screenshot' || key === 'screenshotRequest') continue;
		target[key] = stripScreenshots(nestedValue);
	}
	return target;
}

function auditJson(audit: AuditSummaryResult) {
	return JSON.stringify(stripScreenshots(audit));
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

function formatPocketBaseError(error: unknown) {
	if (!(error instanceof Error)) return String(error);
	const response = (error as Error & { response?: unknown }).response;
	return response ? `${error.message}: ${JSON.stringify(response)}` : error.message;
}

function isUniqueConstraintError(error: unknown) {
	const response = (error as { response?: { status?: number; data?: unknown } })?.response;
	if (response?.status !== 400) return false;
	return JSON.stringify(response.data || '').includes('validation_not_unique');
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
			screenshot: null as ScreenshotPayload | null,
			screenshotRequest: null as AuditCaptureRequest | null
		};
	}

	try {
		const meta = JSON.parse(metaJson) as Record<string, unknown>;
		const nestedMeta = getRecord(meta.meta);
		const directScreenshot = getRecord(meta.screenshot);
		const nestedScreenshot = getRecord(nestedMeta?.screenshot);
		const directScreenshotRequest = getRecord(meta.screenshotRequest);
		const nestedScreenshotRequest = getRecord(nestedMeta?.screenshotRequest);
		const screenshotSource = directScreenshot || nestedScreenshot;
		const screenshotRequestSource = directScreenshotRequest || nestedScreenshotRequest;
		const screenshot = screenshotSource as ScreenshotPayload | null;
		const screenshotRequest = screenshotRequestSource as AuditCaptureRequest | null;

		if (directScreenshot) {
			delete meta.screenshot;
		}
		if (nestedScreenshot && nestedMeta) {
			delete nestedMeta.screenshot;
			meta.meta = nestedMeta;
		}

		if (directScreenshotRequest) {
			delete meta.screenshotRequest;
		}
		if (nestedScreenshotRequest && nestedMeta) {
			delete nestedMeta.screenshotRequest;
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
					: null,
			screenshotRequest: screenshotRequest?.kind ? screenshotRequest : null
		};
	} catch {
		return {
			meta_json: metaJson,
			screenshot: null as ScreenshotPayload | null,
			screenshotRequest: null as AuditCaptureRequest | null
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
	if (!input.screenshot?.contentType || !input.screenshot.imageBase64) return false;

	try {
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
		return true;
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			return true;
		}

		console.warn(
			`[audit-runner] screenshot persistence skipped for ${input.title} (${input.screenshot.imageBase64.length} base64 chars): ${formatPocketBaseError(error)}`
		);
		return false;
	}
}

function screenshotJobKey(input: Pick<ScreenshotJob, 'auditId' | 'findingTypeId' | 'runId'>) {
	return `${input.auditId}:${input.findingTypeId}:${input.runId}`;
}

async function processScreenshotJob(input: ScreenshotJob, token?: string) {
	const key = screenshotJobKey(input);
	if (
		screenshotQueueState.queuedKeys.has(key) ||
		screenshotQueueState.activeKeys.has(key) ||
		screenshotQueueState.completedKeys.has(key)
	) {
		return;
	}

	screenshotQueueState.activeKeys.add(key);
	try {
		const screenshot = await runAuditCaptureRequest(input.request);
		const persisted = await persistScreenshotIfPresent(
			{
				auditId: input.auditId,
				findingTypeId: input.findingTypeId,
				runId: input.runId,
				title: input.title,
				page_url: input.page_url,
				screenshot
			},
			token
		);
		if (persisted) {
			screenshotQueueState.completedKeys.add(key);
		}
	} catch (error) {
		console.warn(
			`[audit-runner] screenshot job failed for ${input.title}: ${formatPocketBaseError(error)}`
		);
	} finally {
		screenshotQueueState.activeKeys.delete(key);
	}
}

export function hasPendingScreenshotJobs(auditId?: string) {
	const matchesAudit = (key: string) => !auditId || key.startsWith(`${auditId}:`);
	for (const key of screenshotQueueState.queuedKeys) {
		if (matchesAudit(key)) return true;
	}
	for (const key of screenshotQueueState.activeKeys) {
		if (matchesAudit(key)) return true;
	}
	return false;
}

export function clearScreenshotQueueStateForAudit(auditId: string) {
	const matchesAudit = (key: string) => key.startsWith(`${auditId}:`);
	for (const key of screenshotQueueState.queuedKeys) {
		if (matchesAudit(key)) screenshotQueueState.queuedKeys.delete(key);
	}
	for (const key of screenshotQueueState.completedKeys) {
		if (matchesAudit(key)) screenshotQueueState.completedKeys.delete(key);
	}
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
	url: string,
	partialAudit: AuditSummaryResult,
	runRegistry: RunRegistry,
	keysToSync?: Iterable<string>,
	token?: string
) {
	const keySet = keysToSync ? new Set(keysToSync) : null;
	attachMetricScreenshots(partialAudit, url, keySet || ['pageSpeed', 'openPageRank']);
	const normalizedItems = buildNormalizedAuditItems(partialAudit).filter(
		(item) => !keySet || keySet.has(item.key)
	);
	for (const item of normalizedItems) {
		const run = runRegistry.get(item.key);
		if (!run) continue;

		await deleteAuditFindingsByRunId(run.runId, token);

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
			audit_json: auditJson(partialAudit),
			summary_json: JSON.stringify(buildSummary(partialAudit))
		},
		token
	);
}

function collectScreenshotJobs(
	auditId: string,
	url: string,
	audit: AuditSummaryResult,
	runRegistry: RunRegistry
) {
	attachMetricScreenshots(audit, url, ['pageSpeed', 'openPageRank']);

	const jobs: ScreenshotJob[] = [];
	const seen = new Set<string>();
	const normalizedItems = buildNormalizedAuditItems(audit);

	for (const item of normalizedItems) {
		const run = runRegistry.get(item.key);
		if (!run) continue;

		const addJob = (request: AuditCaptureRequest | null, title: string, page_url?: string) => {
			if (!request) return;
			const key = screenshotJobKey({
				auditId,
				findingTypeId: run.findingTypeId,
				runId: run.runId
			});
			if (seen.has(key)) return;
			seen.add(key);
			jobs.push({
				auditId,
				findingTypeId: run.findingTypeId,
				runId: run.runId,
				title,
				page_url,
				request
			});
		};

		if (item.findings.length === 0) {
			const { screenshotRequest } = extractScreenshotFromMeta(item.stats_json);
			addJob(screenshotRequest, item.label);
			continue;
		}

		for (const finding of item.findings) {
			const { screenshotRequest } = extractScreenshotFromMeta(finding.meta_json);
			addJob(screenshotRequest, finding.detail || finding.title || item.label, finding.page_url);
		}
	}

	return jobs;
}

async function processAuditScreenshots(
	auditId: string,
	url: string,
	audit: AuditSummaryResult,
	runRegistry: RunRegistry,
	token?: string
) {
	const jobs = collectScreenshotJobs(auditId, url, audit, runRegistry);
	for (const job of jobs) {
		await processScreenshotJob(job, token);
	}
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
				await syncProgressSnapshot(
					auditId,
					url,
					partialAudit,
					runRegistry,
					STEP_KEYS[stepLabel] || [],
					token
				);
			}
		});
		runLog = appendLog(runLog, 'Audit engine completed successfully.');
		const completedAt = timestamp();
		await syncProgressSnapshot(auditId, url, audit, runRegistry, undefined, token);
		await finalizeUnsyncedRuns(runRegistry, audit, token);
		runLog = appendLog(runLog, 'Screenshot generation started.');
		await updateWorkflowRecord(workflowId, { run_log: runLog }, token);
		await processAuditScreenshots(auditId, url, audit, runRegistry, token);
		runLog = appendLog(runLog, 'Screenshot generation completed.');

		await updateAuditRecord(
			auditId,
			{
				status: 'completed',
				audit_json: auditJson(audit),
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
