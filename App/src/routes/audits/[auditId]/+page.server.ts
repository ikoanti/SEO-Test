import { error, fail, redirect } from '@sveltejs/kit';
import { ensureAuditRunProcessing } from '$lib/server/audit-runner';
import { generateReportHtml, parsePdfMetrics } from '$lib/server/legacy-api';
import {
	getAudit,
	getAuditByRunId,
	getRun,
	listAuditFindings,
	listAuditItems,
	updateAuditRecord
} from '$lib/server/pocketbase';

export const load = async ({ params, locals }) => {
	try {
		const auditRecord = await getAudit(params.auditId, locals.pbToken);
		const runRecord = await getRun(auditRecord.run, locals.pbToken);

		try {
			const audit = auditRecord.audit_json ? JSON.parse(auditRecord.audit_json) : null;
			const summary = auditRecord.summary_json ? JSON.parse(auditRecord.summary_json) : null;
			const aiVisibility = auditRecord.ai_visibility_json
				? JSON.parse(auditRecord.ai_visibility_json)
				: null;
			const [auditItems, auditFindings] = await Promise.all([
				listAuditItems(auditRecord.id, locals.pbToken),
				listAuditFindings(auditRecord.id, locals.pbToken)
			]);
			const findingsByItemId = new Map<string, typeof auditFindings>();
			for (const finding of auditFindings) {
				const auditItemId = String(finding.audit_item || '');
				const current = findingsByItemId.get(auditItemId) || [];
				current.push(finding);
				findingsByItemId.set(auditItemId, current);
			}

			return {
				runRecord,
				auditRecord,
				audit,
				summary,
				reportHtml: auditRecord?.report_html || '',
				aiVisibility,
				normalizedItems: auditItems.map((item) => ({
					...item,
					stats: item.stats_json ? JSON.parse(item.stats_json) : null,
					findings: (findingsByItemId.get(item.id) || []).map((finding) => ({
						...finding,
						meta: finding.meta_json ? JSON.parse(finding.meta_json) : null
					}))
				})),
				isPendingRun: false
			};
		} catch {
			throw error(500, 'Stored audit JSON is invalid.');
		}
	} catch {
		const runRecord = await getRun(params.auditId, locals.pbToken);
		ensureAuditRunProcessing(runRecord, locals.pbToken);

		if (runRecord.status === 'completed') {
			const auditRecord = await getAuditByRunId(runRecord.id, locals.pbToken);
			throw redirect(302, `/audits/${auditRecord.id}`);
		}

		return {
			runRecord,
			auditRecord: null,
			audit: null,
			summary: null,
			reportHtml: '',
			aiVisibility: null,
			isPendingRun: true
		};
	}
};

export const actions = {
	generateReport: async ({ params, locals }) => {
		const auditRecord = await getAudit(params.auditId, locals.pbToken);
		const runRecord = await getRun(auditRecord.run, locals.pbToken);
		const audit = JSON.parse(auditRecord.audit_json || '{}');

		try {
			const reportHtml = await generateReportHtml(audit.domain || runRecord.url, audit);
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
