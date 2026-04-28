import { fail, redirect } from '@sveltejs/kit';
import { buildAuditPageData } from '$lib/server/audit-detail';
import {
	clearScreenshotQueueStateForAudit,
	ensureAuditWorkflowProcessing,
	queueAuditWorkflow
} from '$lib/server/audit-runner';
import { parsePdfMetrics } from '$lib/server/legacy-api';
import {
	createWorkflowRecord,
	deleteAuditDerivedRecords,
	getAudit,
	getWorkflowByAuditId,
	updateAuditRecord
} from '$lib/server/pocketbase';

export const load = async ({ params, locals }) => {
	const payload = await buildAuditPageData(params.auditId, locals.pbToken);
	ensureAuditWorkflowProcessing(payload.workflowRecord, locals.pbToken);
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

		clearScreenshotQueueStateForAudit(auditRecord.id);
		await deleteAuditDerivedRecords(auditRecord.id, workflowRecord.id, locals.pbToken);

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
				report_docx: null,
				selected_report_template_keys_json: '',
				ai_visibility_json: ''
			},
			locals.pbToken
		);
		const nextWorkflow = await createWorkflowRecord(
			{
				audit: auditRecord.id,
				status: 'queued',
				queued_at: queuedAt,
				run_log: `[${queuedAt}] Workflow queued.`
			},
			locals.pbToken
		);

		queueAuditWorkflow({
			workflowId: nextWorkflow.id,
			auditId: auditRecord.id,
			url: website.url,
			token: locals.pbToken
		});

		throw redirect(303, `/audits/${params.auditId}`);
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
