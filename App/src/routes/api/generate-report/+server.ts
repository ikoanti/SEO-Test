import { error, json } from '@sveltejs/kit';
import { generateReportHtml } from '$lib/server/legacy-api';

export async function POST({ request, locals }) {
	if (!locals.user) {
		throw error(401, 'Authentication required.');
	}

	const { domain, auditData } = await request.json();
	if (!domain || !auditData) {
		throw error(400, 'domain and auditData are required.');
	}

	try {
		const report = await generateReportHtml(String(domain), auditData);
		return json({ report });
	} catch (err) {
		throw error(
			500,
			err instanceof Error
				? `Failed to generate report: ${err.message}`
				: 'Failed to generate report.'
		);
	}
}
