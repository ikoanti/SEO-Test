import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { getSidebarRenderData } from '$lib/server/audit-capture/sidebar-store';

export const load = async ({ url }) => {
	if (dev && url.searchParams.has('demo')) {
		return {
			richResultsData: {
				pageUrl: 'https://lilianashjewellery.com/',
				title: 'Rich Results Test',
				pageTitle: 'Liliana SH Jewellery',
				checkedAt: new Date().toISOString(),
				validCount: 2,
				jsonLdScriptCount: 2,
				allTypes: ['LocalBusiness', 'Organization'],
				targetType: '',
				sourceLabel: 'GoldenWeb structured data validation',
				items: [
					{
						type: 'LocalBusiness',
						label: 'Local businesses',
						status: 'valid',
						issues: ['Non-critical issues detected']
					},
					{
						type: 'Organization',
						label: 'Organization',
						status: 'valid',
						issues: []
					}
				],
				fetchError: '',
				jsonLdParseErrors: []
			}
		};
	}

	const id = url.searchParams.get('id');
	if (!id) {
		error(400, 'Missing rich results render id.');
	}

	const richResultsData = getSidebarRenderData(id);
	if (!richResultsData) {
		error(404, 'Rich results render data not found.');
	}

	return { richResultsData };
};
