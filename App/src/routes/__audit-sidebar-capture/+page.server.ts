import { error } from '@sveltejs/kit';
import { getSidebarRenderData } from '$lib/server/audit-capture/sidebar-store';

export const load = async ({ url }) => {
	const id = url.searchParams.get('id');
	if (!id) {
		error(400, 'Missing sidebar render id.');
	}

	const sidebarData = getSidebarRenderData(id);
	if (!sidebarData) {
		error(404, 'Sidebar render data not found.');
	}

	return { sidebarData };
};
