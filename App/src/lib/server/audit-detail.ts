import {
	getAudit,
	getWorkflowByAuditId,
	listAuditFindings,
	listRunsByWorkflow
} from '$lib/server/pocketbase';

function getWebsite(auditRecord: Record<string, unknown>) {
	return (auditRecord.expand as { website?: { url?: string; domain?: string } } | undefined)
		?.website;
}

export async function buildAuditPageData(auditId: string, token?: string) {
	const auditRecord = await getAudit(auditId, token);
	const workflowRecord = await getWorkflowByAuditId(auditRecord.id, token);

	const audit = auditRecord.audit_json ? JSON.parse(auditRecord.audit_json) : null;
	const summary = auditRecord.summary_json ? JSON.parse(auditRecord.summary_json) : null;
	const aiVisibility = auditRecord.ai_visibility_json
		? JSON.parse(auditRecord.ai_visibility_json)
		: null;
	const [runs, auditFindings] = await Promise.all([
		listRunsByWorkflow(workflowRecord.id, token),
		listAuditFindings(auditRecord.id, token)
	]);
	const findingsByRunId = new Map<string, typeof auditFindings>();
	for (const finding of auditFindings) {
		const runId = String(finding.run || '');
		const current = findingsByRunId.get(runId) || [];
		current.push(finding);
		findingsByRunId.set(runId, current);
	}

	return {
		auditId: auditRecord.id,
		workflowRecord,
		runRecord: {
			status: workflowRecord.status,
			url: getWebsite(auditRecord)?.url,
			name: getWebsite(auditRecord)?.domain || getWebsite(auditRecord)?.url,
			error_message: workflowRecord.error_message,
			run_log: workflowRecord.run_log
		},
		auditRecord: {
			...auditRecord,
			url: getWebsite(auditRecord)?.url,
			name: getWebsite(auditRecord)?.domain || getWebsite(auditRecord)?.url
		},
		audit,
		summary,
		reportHtml: auditRecord?.report_html || '',
		aiVisibility,
		normalizedItems: runs.map((run) => {
			const findingType = (
				run.expand as
					| {
							audit_finding_type?: {
								key?: string;
								label?: string;
								sort_order?: number;
							};
					  }
					| undefined
			)?.audit_finding_type;
			const findings = (findingsByRunId.get(run.id) || []).map((finding) => ({
				...finding,
				meta: finding.meta_json ? JSON.parse(finding.meta_json) : null
			})) as Array<Record<string, unknown> & { status?: string }>;
			const status = findings.some((finding) => finding.status === 'err')
				? 'err'
				: findings.some((finding) => finding.status === 'warn')
					? 'warn'
					: findings.some((finding) => finding.status === 'ok')
						? 'ok'
						: 'info';
			return {
				id: run.id,
				key: findingType?.key || run.id,
				label: findingType?.label || 'Audit check',
				status,
				runStatus: run.status,
				summary: run.run_log || '',
				itemRun: run,
				sortOrder: findingType?.sort_order || run.sort_order || 999,
				stats: run.run_log ? { stats: run.run_log, count: findings.length } : null,
				findings
			};
		}),
		isPendingRun: ['queued', 'running'].includes(String(workflowRecord.status || ''))
	};
}
