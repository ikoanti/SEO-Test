import { runAudit } from '$lib/server/audit';
import { buildNormalizedAuditItems } from '$lib/server/audit-normalize';
import {
	createAuditFindingRecord,
	createAuditItemRunRecord,
	createAuditItemRecord,
	createAuditRecord,
	getRun,
	updateRunRecord
} from '$lib/server/pocketbase';

type QueuePayload = {
	runId: string;
	url: string;
	name?: string;
	createdBy?: string;
	token?: string;
};

type AuditRunnerState = {
	activeRuns: Set<string>;
};

type AuditSummaryResult = {
	domain?: string;
	auditedAt?: string;
	summary?: unknown;
	pageSpeed?: unknown;
	openPageRank?: unknown;
};

type RunRecordLike = {
	id?: string;
	url?: string;
	status?: string;
	name?: string;
	created_by?: string;
};

const state = ((
	globalThis as typeof globalThis & { __auditRunnerState?: AuditRunnerState }
).__auditRunnerState ??= {
	activeRuns: new Set<string>()
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

async function processAuditRun({ runId, url, name, createdBy, token }: QueuePayload) {
	const existingRecord = await getRun(runId, token);
	let runLog = appendLog(existingRecord.run_log, 'Run started.');

	await updateRunRecord(
		runId,
		{
			status: 'running',
			started_at: timestamp(),
			error_message: '',
			run_log: runLog
		},
		token
	);

	try {
		const audit = await runAudit(url);
		runLog = appendLog(runLog, 'Run completed successfully.');
		const completedAt = timestamp();

		await createAuditRecord(
			{
				run: runId,
				name: name || existingRecord.name || existingRecord.url,
				url,
				created_by: createdBy || existingRecord.created_by,
				audit_json: JSON.stringify(audit),
				summary_json: JSON.stringify(buildSummary(audit)),
				completed_at: completedAt
			},
			token
		).then(async (auditRecord) => {
			const normalizedItems = buildNormalizedAuditItems(audit);

			for (const item of normalizedItems) {
				const itemStartedAt = timestamp();
				const itemCompletedAt = timestamp();
				const itemRunRecord = await createAuditItemRunRecord(
					{
						audit: auditRecord.id,
						run: runId,
						key: item.key,
						label: item.label,
						status: 'completed',
						started_at: itemStartedAt,
						completed_at: itemCompletedAt,
						run_log: appendLog('', `${item.label} item run completed.`),
						sort_order: item.sort_order
					},
					token
				);

				const auditItemRecord = await createAuditItemRecord(
					{
						audit: auditRecord.id,
						item_run: itemRunRecord.id,
						key: item.key,
						label: item.label,
						status: item.status,
						summary: item.summary,
						stats_json: item.stats_json,
						sort_order: item.sort_order
					},
					token
				);

				for (const finding of item.findings) {
					await createAuditFindingRecord(
						{
							audit: auditRecord.id,
							audit_item: auditItemRecord.id,
							status: finding.status,
							title: finding.title,
							detail: finding.detail,
							page_url: finding.page_url,
							meta_json: finding.meta_json
						},
						token
					);
				}
			}
		});

		await updateRunRecord(
			runId,
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
		runLog = appendLog(runLog, `Run failed: ${message}`);

		await updateRunRecord(
			runId,
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

export function queueAuditRun(payload: QueuePayload) {
	if (state.activeRuns.has(payload.runId)) {
		return;
	}

	state.activeRuns.add(payload.runId);

	void processAuditRun(payload)
		.catch((error) => {
			console.error(
				`[audit-runner] ${payload.runId} failed:`,
				error instanceof Error ? error.message : error
			);
		})
		.finally(() => {
			state.activeRuns.delete(payload.runId);
		});
}

export function ensureAuditRunProcessing(record: RunRecordLike, token?: string) {
	if (!record?.id || !record?.url) {
		return;
	}

	if (!['queued', 'running'].includes(String(record.status || ''))) {
		return;
	}

	queueAuditRun({
		runId: record.id,
		url: record.url,
		name: record.name,
		createdBy: record.created_by,
		token
	});
}
