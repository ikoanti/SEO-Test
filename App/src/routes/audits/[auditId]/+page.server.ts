import { error, fail } from '@sveltejs/kit';
import { ensureAuditWorkflowProcessing } from '$lib/server/audit-runner';
import { generateReportHtml, parsePdfMetrics } from '$lib/server/legacy-api';
import {
	getAudit,
	getWorkflowByAuditId,
	listAuditFindings,
	listRunsByWorkflow,
	updateAuditRecord
} from '$lib/server/pocketbase';

function getWebsite(auditRecord: Record<string, unknown>) {
	return (auditRecord.expand as { website?: { url?: string; domain?: string } } | undefined)
		?.website;
}

export const load = async ({ params, locals }) => {
	const auditRecord = await getAudit(params.auditId, locals.pbToken);
	const workflowRecord = await getWorkflowByAuditId(auditRecord.id, locals.pbToken);
	ensureAuditWorkflowProcessing(workflowRecord, locals.pbToken);

	try {
		const audit = auditRecord.audit_json ? JSON.parse(auditRecord.audit_json) : null;
		const summary = auditRecord.summary_json ? JSON.parse(auditRecord.summary_json) : null;
		const aiVisibility = auditRecord.ai_visibility_json
			? JSON.parse(auditRecord.ai_visibility_json)
			: null;
		const [runs, auditFindings] = await Promise.all([
			listRunsByWorkflow(workflowRecord.id, locals.pbToken),
			listAuditFindings(auditRecord.id, locals.pbToken)
		]);
		const findingsByRunId = new Map<string, typeof auditFindings>();
		for (const finding of auditFindings) {
			const runId = String(finding.run || '');
			const current = findingsByRunId.get(runId) || [];
			current.push(finding);
			findingsByRunId.set(runId, current);
		}

		return {
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
				const findingType = (run.expand as { audit_finding_type?: { label?: string } } | undefined)
					?.audit_finding_type;
				return {
					id: run.id,
					label: findingType?.label || 'Audit check',
					status: run.status,
					summary: run.run_log || '',
					itemRun: run,
					stats: null,
					findings: (findingsByRunId.get(run.id) || []).map((finding) => ({
						...finding,
						meta: finding.meta_json ? JSON.parse(finding.meta_json) : null
					}))
				};
			}),
			isPendingRun: ['queued', 'running'].includes(String(workflowRecord.status || ''))
		};
	} catch {
		throw error(500, 'Stored audit JSON is invalid.');
	}
};

export const actions = {
	generateReport: async ({ params, locals }) => {
		const auditRecord = await getAudit(params.auditId, locals.pbToken);
		const audit = JSON.parse(auditRecord.audit_json || '{}');
		const website = getWebsite(auditRecord);

		try {
			const reportHtml = await generateReportHtml(audit.domain || website?.url || '', audit);
			await updateAuditRecord(auditRecord.id, { report_html: reportHtml }, locals.pbToken);
			return { reportSuccess: true };
		} catch (err) {
			return fail(500, {
				reportError: err instanceof Error ? err.message : 'Failed to generate report.'
			});
		}
	},
	parsePdf: async ({ request, params, locals }) => {
		const auditRecord = await getAudit(params.auditId, locals.pbToken);
		const data = await request.formData();
		const file = data.get('pdf');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { pdfError: 'A PDF file is required.' });
		}

		try {
			const buffer = Buffer.from(await file.arrayBuffer());
			const pdfBase64 = buffer.toString('base64');
			const metrics = await parsePdfMetrics(pdfBase64);
			await updateAuditRecord(
				auditRecord.id,
				{ ai_visibility_json: JSON.stringify(metrics) },
				locals.pbToken
			);
			return { pdfSuccess: true };
		} catch (err) {
			return fail(500, {
				pdfError: err instanceof Error ? err.message : 'Failed to analyze PDF.'
			});
		}
	}
};
