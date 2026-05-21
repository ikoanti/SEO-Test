export const load = async ({ locals, url }) => {
	return {
		user: locals.user ?? null,
		isCaptureRoute:
			url.pathname.startsWith('/__audit-sidebar-capture') ||
			url.pathname.startsWith('/__rich-results-capture')
	};
};
