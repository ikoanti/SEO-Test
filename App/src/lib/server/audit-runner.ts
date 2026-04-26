import { runAudit } from '$lib/server/audit';
import { buildNormalizedAuditItems } from '$lib/server/audit-normalize';
import {
	createAuditFindingRecord,
	createRunRecord,
	getOrCreateAuditFindingTypeRecord,
	getWorkflow,
	updateAuditRecord,
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

type AuditSummaryResult = {
	domain?: string;
	auditedAt?: string;
	summary?: unknown;
	pageSpeed?: unknown;
	openPageRank?: unknown;
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

async function processAuditWorkflow({ workflowId, auditId, url, token }: QueuePayload) {
	const workflowRecord = await getWorkflow(workflowId, token);
	let runLog = appendLog(workflowRecord.run_log, 'Workflow started.');

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
		const audit = await runAudit(url);
		runLog = appendLog(runLog, 'Audit engine completed successfully.');
		const completedAt = timestamp();
		const normalizedItems = buildNormalizedAuditItems(audit);

		for (const item of normalizedItems) {
			const findingType = await getOrCreateAuditFindingTypeRecord(
				{
					key: item.key,
					label: item.label,
					sort_order: item.sort_order
				},
				token
			);
			const itemRunStartedAt = timestamp();
			const itemRun = await createRunRecord(
				{
					workflow: workflowId,
					audit_finding_type: findingType.id,
					status: 'completed',
					started_at: itemRunStartedAt,
					completed_at: timestamp(),
					run_log: appendLog('', `${item.label} run completed.`),
					sort_order: item.sort_order
				},
				token
			);

			if (item.findings.length === 0) {
				await createAuditFindingRecord(
					{
						audit: auditId,
						audit_finding_type: findingType.id,
						run: itemRun.id,
						status: item.status,
						title: item.label,
						detail: item.summary,
						meta_json: item.stats_json
					},
					token
				);
			}

			for (const finding of item.findings) {
				await createAuditFindingRecord(
					{
						audit: auditId,
						audit_finding_type: findingType.id,
						run: itemRun.id,
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
