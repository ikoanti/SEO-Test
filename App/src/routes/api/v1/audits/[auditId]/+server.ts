import { error, json } from '@sveltejs/kit';
import { buildAuditPageData, buildExternalAuditResult } from '$lib/server/audit-detail';
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
	const completed = status === 'completed';
	const result = completed
		? buildExternalAuditResult(
				await buildAuditPageData(params.auditId, token, {
					includeReportHtml: false,
					includeReportPreview: true
				})
			)
		: null;

	return json({
		id: audit.id,
		status,
		url: `${url.origin}/api/v1/audits/${encodeURIComponent(params.auditId)}`,
		website: website
			? {
					id: website.id,
					url: website.url,
					domain: website.domain,
					displayName: website.display_name
				}
			: null,
		createdAt: audit.created || null,
		updatedAt: audit.updated || null,
		queuedAt: workflow.queued_at || null,
		startedAt: workflow.started_at || null,
		completedAt: workflow.completed_at || audit.completed_at || null,
		error: workflow.error_message ? { message: workflow.error_message } : null,
		result
	});
};
