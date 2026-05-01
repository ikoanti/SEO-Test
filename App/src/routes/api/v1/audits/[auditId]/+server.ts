import { error, json } from '@sveltejs/kit';
import { ensureAuditWorkflowProcessing } from '$lib/server/audit-runner';
import { externalApiPocketBaseToken } from '$lib/server/external-api';
import { getAudit, getWorkflowByAuditId } from '$lib/server/pocketbase';

function websiteRecord(audit: Record<string, unknown>) {
	return (
		audit.expand as
			| { website?: { id?: string; url?: string; domain?: string; display_name?: string } }
			| undefined
	)?.website;
}

export const GET = async ({ request, params, url }) => {
	const token = await externalApiPocketBaseToken(request);
	const audit = await getAudit(params.auditId, token);

	if (!audit?.id) {
		throw error(404, 'Audit not found.');
	}

	const workflow = await getWorkflowByAuditId(params.auditId, token);
	ensureAuditWorkflowProcessing(workflow, token);
	const website = websiteRecord(audit);
	const status = String(workflow.status || audit.status || 'unknown');
	const basePath = `${url.origin}/api/v1/audits/${encodeURIComponent(params.auditId)}`;

	return json({
		auditId: audit.id,
		workflowId: workflow.id,
		status,
		website: website
			? {
					id: website.id,
					url: website.url,
					domain: website.domain,
					displayDomain: website.display_name
				}
			: null,
		queuedAt: workflow.queued_at || null,
		startedAt: workflow.started_at || null,
		completedAt: workflow.completed_at || audit.completed_at || null,
		error: workflow.error_message || null,
		googleDoc: audit.google_doc_url
			? {
					id: audit.google_doc_id,
					name: audit.google_doc_name,
					url: audit.google_doc_url,
					exportedAt: audit.google_doc_exported_at
				}
			: null,
		resultUrl: `${basePath}/result`,
		googleDocExportUrl: `${basePath}/export/google-doc`
	});
};
