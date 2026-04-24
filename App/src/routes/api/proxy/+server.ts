import { error, text } from '@sveltejs/kit';
import { fetchProxyText } from '$lib/server/legacy-api';

export async function GET({ url, locals }) {
	if (!locals.user) {
		throw error(401, 'Authentication required.');
	}

	const targetUrl = url.searchParams.get('url')?.trim();
	if (!targetUrl) {
		throw error(400, 'URL is required');
	}

	try {
		const payload = await fetchProxyText(targetUrl);
		return text(typeof payload === 'string' ? payload : JSON.stringify(payload));
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : 'Proxy request failed.');
	}
}
