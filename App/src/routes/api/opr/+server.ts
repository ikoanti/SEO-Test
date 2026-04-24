import { error, json } from '@sveltejs/kit';
import { fetchOpenPageRank } from '$lib/server/legacy-api';

export async function GET({ url, locals }) {
	if (!locals.user) {
		throw error(401, 'Authentication required.');
	}

	const domain = url.searchParams.get('domain')?.trim();
	if (!domain) {
		throw error(400, 'Target domain is required');
	}

	try {
		return json(await fetchOpenPageRank(domain));
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : 'Open Page Rank request failed.');
	}
}
