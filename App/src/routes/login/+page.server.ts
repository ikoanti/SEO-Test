export const load = async ({ url }) => {
	return {
		redirectTo: url.searchParams.get('redirectTo') || '/audits',
		email: url.searchParams.get('email') || '',
		error: url.searchParams.get('error') || ''
	};
};
