import { error, json } from '@sveltejs/kit';
import { submitAudit } from '$lib/server/audit-submit';
import { externalApiPocketBaseToken, readJsonBody } from '$lib/server/external-api';

export const POST = async ({ request, url }) => {
	const token = await externalApiPocketBaseToken(request);
	const body = await readJsonBody(request);
	const domain = String(body.domain || body.url || '').trim();
	const displayDomain = String(
		body.displayDomain || body.displayName || body.display_name || ''
	).trim();

	if (!domain) {
		throw error(400, 'Website domain is required.');
	}

	const { website, audit, workflow } = await submitAudit({
		domain,
		displayDomain,
		token
	});

	return json(
		{
			id: audit.id,
			status: workflow.status || audit.status || 'queued',
			url: `${url.origin}/api/v1/audits/${encodeURIComponent(audit.id)}`,
			website: {
				id: website.id,
				url: website.url,
				domain: website.domain,
				displayName: website.display_name
			}
		},
		{ status: 202 }
	);
};
