import { error, json } from '@sveltejs/kit';
import { checkRedirect } from '$lib/server/legacy-api';

export async function GET({ url, locals }) {
	if (!locals.user) {
		throw error(401, 'Authentication required.');
	}

	const targetUrl = url.searchParams.get('url')?.trim();
	if (!targetUrl) {
		throw error(400, 'URL is required');
	}

	try {
		return json(await checkRedirect(targetUrl));
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : 'Redirect check failed.');
	}
}
