import { error, json } from '@sveltejs/kit';
import { submitAudit } from '$lib/server/audit-submit';
import { externalApiPocketBaseToken, readJsonBody } from '$lib/server/external-api';

export const POST = async ({ request, url }) => {
	const token = await externalApiPocketBaseToken(request);
	const body = await readJsonBody(request);
	const domain = String(body.domain || body.url || '').trim();
	const displayDomain = String(body.displayDomain || body.displayName || body.display_name || '').trim();

	if (!domain) {
		throw error(400, 'Website domain is required.');
	}

	const { website, audit, workflow } = await submitAudit({
		domain,
		displayDomain,
		token
	});
	const basePath = `${url.origin}/api/v1/audits/${encodeURIComponent(audit.id)}`;

	return json(
		{
			auditId: audit.id,
			workflowId: workflow.id,
			websiteId: website.id,
			status: workflow.status || audit.status || 'queued',
			website: {
				id: website.id,
				url: website.url,
				domain: website.domain,
				displayDomain: website.display_name
			},
			statusUrl: basePath,
			resultUrl: `${basePath}/result`,
			googleDocExportUrl: `${basePath}/export/google-doc`
		},
		{ status: 202 }
	);
};
