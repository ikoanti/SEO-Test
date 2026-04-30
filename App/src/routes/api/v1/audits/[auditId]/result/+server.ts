import { error, json } from '@sveltejs/kit';
import { buildAuditPageData } from '$lib/server/audit-detail';
import { ensureAuditWorkflowProcessing } from '$lib/server/audit-runner';
import { externalApiPocketBaseToken } from '$lib/server/external-api';

export const GET = async ({ request, params }) => {
	const token = await externalApiPocketBaseToken(request);
	const pageData = await buildAuditPageData(params.auditId, token, {
		includeReportHtml: false,
		includeReportPreview: true
	});
	ensureAuditWorkflowProcessing(pageData.workflowRecord, token);

	if (String(pageData.runRecord.status || '') !== 'completed') {
		throw error(409, 'Audit is not completed yet.');
	}

	return json({
		auditId: pageData.auditId,
		status: pageData.runRecord.status,
		website: pageData.website,
		summary: pageData.summary,
		aiVisibility: pageData.aiVisibility,
		findings: pageData.findingDisplayItems,
		reportPreviewItems: pageData.reportPreviewItems,
		googleDoc: pageData.auditRecord?.google_doc_url
			? {
					id: pageData.auditRecord.google_doc_id,
					name: pageData.auditRecord.google_doc_name,
					url: pageData.auditRecord.google_doc_url,
					exportedAt: pageData.auditRecord.google_doc_exported_at
				}
			: null
	});
};
