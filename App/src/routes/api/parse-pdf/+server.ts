import { error, json } from '@sveltejs/kit';
import { parsePdfMetrics } from '$lib/server/legacy-api';

export async function POST({ request, locals }) {
	if (!locals.user) {
		throw error(401, 'Authentication required.');
	}

	const { pdfBase64 } = await request.json();
	if (!pdfBase64) {
		throw error(400, 'pdfBase64 is required.');
	}

	try {
		return json(await parsePdfMetrics(String(pdfBase64)));
	} catch (err) {
		throw error(
			500,
			err instanceof Error ? `Failed to analyze PDF: ${err.message}` : 'Failed to analyze PDF.'
		);
	}
}
