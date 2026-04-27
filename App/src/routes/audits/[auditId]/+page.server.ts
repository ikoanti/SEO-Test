import { fail, redirect } from '@sveltejs/kit';
import { buildAuditPageData } from '$lib/server/audit-detail';
import { ensureAuditWorkflowProcessing, queueAuditWorkflow } from '$lib/server/audit-runner';
import { parsePdfMetrics } from '$lib/server/legacy-api';
import { ensureReportGenerationProcessing, queueReportGeneration } from '$lib/server/report-runner';
import {
	deleteAuditFindingsByRunId,
	deleteAuditScreenshotsByRunId,
	getAudit,
	getWorkflowByAuditId,
	listRunsByWorkflow,
	updateAuditRecord,
	updateRunRecord,
	updateWorkflowRecord
} from '$lib/server/pocketbase';

export const load = async ({ params, locals }) => {
	const payload = await buildAuditPageData(params.auditId, locals.pbToken);
	ensureAuditWorkflowProcessing(payload.workflowRecord, locals.pbToken);
	ensureReportGenerationProcessing(payload.auditRecord, locals.pbToken);
	return payload;
};

export const actions = {
	restart: async ({ params, locals }) => {
		const auditRecord = await getAudit(params.auditId, locals.pbToken);
		const workflowRecord = await getWorkflowByAuditId(params.auditId, locals.pbToken);
		const website = (auditRecord.expand as { website?: { url?: string } } | undefined)?.website;
		const queuedAt = new Date().toISOString();

		if (!website?.url) {
			return fail(500, { restartError: 'Audit website URL is missing.' });
		}

		if (['queued', 'running'].includes(String(workflowRecord.status || ''))) {
			ensureAuditWorkflowProcessing(workflowRecord, locals.pbToken);
			throw redirect(303, `/audits/${params.auditId}`);
		}

		const runs = await listRunsByWorkflow(workflowRecord.id, locals.pbToken);
		for (const run of runs) {
			await deleteAuditFindingsByRunId(run.id, locals.pbToken);
			await deleteAuditScreenshotsByRunId(run.id, locals.pbToken);
			await updateRunRecord(
				run.id,
				{
					status: 'queued',
					started_at: queuedAt,
					completed_at: null,
					error_message: '',
					run_log: `[${queuedAt}] ${
						(run.expand as { audit_finding_type?: { label?: string } } | undefined)
							?.audit_finding_type?.label || 'Audit check'
					} queued.`
				},
				locals.pbToken
			);
		}

		await updateAuditRecord(
			auditRecord.id,
			{
				status: 'queued',
				audit_json: '',
				summary_json: '',
				completed_at: null,
				report_status: 'idle',
				report_error: '',
				report_started_at: null,
				report_completed_at: null,
				report_html: '',
				ai_visibility_json: ''
			},
			locals.pbToken
		);
		await updateWorkflowRecord(
			workflowRecord.id,
			{
				status: 'queued',
				started_at: null,
				completed_at: null,
				error_message: '',
				run_log: `[${queuedAt}] Workflow queued.`
			},
			locals.pbToken
		);

		queueAuditWorkflow({
			workflowId: workflowRecord.id,
			auditId: auditRecord.id,
			url: website.url,
			token: locals.pbToken
		});

		throw redirect(303, `/audits/${params.auditId}`);
	},
	generateReport: async ({ params, locals }) => {
		const auditRecord = await getAudit(params.auditId, locals.pbToken);
		const workflowRecord = await getWorkflowByAuditId(params.auditId, locals.pbToken);

		if (String(workflowRecord.status || '') !== 'completed') {
			return fail(400, {
				reportError: 'Report generation is available only after the audit run completes.'
			});
		}

		if (['queued', 'running'].includes(String(auditRecord.report_status || ''))) {
			ensureReportGenerationProcessing(auditRecord, locals.pbToken);
			return { reportQueued: true };
		}

		await updateAuditRecord(
			auditRecord.id,
			{
				report_status: 'queued',
				report_error: '',
				report_started_at: null,
				report_completed_at: null,
				report_html: ''
			},
			locals.pbToken
		);
		queueReportGeneration(auditRecord.id, locals.pbToken);
		return { reportQueued: true };
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
