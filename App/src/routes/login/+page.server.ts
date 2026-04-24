import { fail, redirect } from '@sveltejs/kit';
import { getAuthCookieName, loginWithPassword } from '$lib/server/pocketbase';

export const load = async ({ url }) => {
	return {
		redirectTo: url.searchParams.get('redirectTo') || '/audits'
	};
};

export const actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = String(data.get('email') || '').trim();
		const password = String(data.get('password') || '');
		const redirectTo = String(data.get('redirectTo') || '/audits');

		if (!email || !password) {
			return fail(400, {
				error: 'Email and password are required.',
				email,
				redirectTo
			});
		}

		try {
			const auth = await loginWithPassword(email, password);
			cookies.set(getAuthCookieName(), auth.token, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: false,
				maxAge: 60 * 60 * 24 * 7
			});
		} catch (error) {
			return fail(401, {
				error: error instanceof Error ? error.message : 'Invalid credentials.',
				email,
				redirectTo
			});
		}

		throw redirect(302, redirectTo.startsWith('/') ? redirectTo : '/audits');
	}
};
