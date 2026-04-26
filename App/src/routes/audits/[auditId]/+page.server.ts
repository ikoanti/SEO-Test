import { error, fail } from '@sveltejs/kit';
import { buildAuditPageData } from '$lib/server/audit-detail';
import { ensureAuditWorkflowProcessing } from '$lib/server/audit-runner';
import { generateReportHtml, parsePdfMetrics } from '$lib/server/legacy-api';
import { getAudit, updateAuditRecord } from '$lib/server/pocketbase';

export const load = async ({ params, locals }) => {
	try {
		const payload = await buildAuditPageData(params.auditId, locals.pbToken);
		ensureAuditWorkflowProcessing(payload.workflowRecord, locals.pbToken);
		return payload;
	} catch {
		throw error(500, 'Stored audit JSON is invalid.');
	}
};

export const actions = {
	generateReport: async ({ params, locals }) => {
		const auditRecord = await getAudit(params.auditId, locals.pbToken);
		const audit = JSON.parse(auditRecord.audit_json || '{}');
		const website = (auditRecord.expand as { website?: { url?: string } } | undefined)?.website;

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
