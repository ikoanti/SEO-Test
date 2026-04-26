import { isRedirect, redirect } from '@sveltejs/kit';
import {
	getAuthCookieExpires,
	getAuthCookieName,
	getAuthCookieValue,
	loginWithPassword
} from '$lib/server/pocketbase';

const LOGIN_PAGE = '/login';

function buildLoginRedirect(params: { error?: string; email?: string; redirectTo?: string }) {
	const search = new URLSearchParams();

	if (params.error) search.set('error', params.error);
	if (params.email) search.set('email', params.email);
	if (params.redirectTo) search.set('redirectTo', params.redirectTo);

	return search.size ? `${LOGIN_PAGE}?${search.toString()}` : LOGIN_PAGE;
}

export const POST = async ({ request, cookies }) => {
	const data = await request.formData();
	const email = String(data.get('email') || '').trim();
	const password = String(data.get('password') || '');
	const redirectTo = String(data.get('redirectTo') || '/audits');
	const safeRedirectTo = redirectTo.startsWith('/') ? redirectTo : '/audits';

	if (!email || !password) {
		throw redirect(
			302,
			buildLoginRedirect({
				error: 'Email and password are required.',
				email,
				redirectTo: safeRedirectTo
			})
		);
	}

	try {
		const auth = await loginWithPassword(email, password);

		cookies.set(
			getAuthCookieName(),
			getAuthCookieValue(auth.token, auth.user as Record<string, unknown>),
			{
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: false,
				expires: getAuthCookieExpires(auth.token)
			}
		);

		throw redirect(302, safeRedirectTo);
	} catch (error) {
		if (isRedirect(error)) {
			throw error;
		}

		const message = error instanceof Error ? error.message : 'Invalid credentials.';
		throw redirect(
			302,
			buildLoginRedirect({
				error: message,
				email,
				redirectTo: safeRedirectTo
			})
		);
	}
};
