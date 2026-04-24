import { redirect, type Handle } from '@sveltejs/kit';
import { authenticateToken, getAuthCookieName } from '$lib/server/pocketbase';

const PROTECTED_PREFIXES = ['/audits'];

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(getAuthCookieName());

	if (token) {
		try {
			const auth = await authenticateToken(token);
			event.locals.user = auth.user;
			event.locals.pbToken = auth.token;
			event.cookies.set(getAuthCookieName(), auth.token, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: false,
				maxAge: 60 * 60 * 24 * 7
			});
		} catch {
			event.cookies.delete(getAuthCookieName(), { path: '/' });
		}
	}

	const isProtected = PROTECTED_PREFIXES.some((prefix) => event.url.pathname.startsWith(prefix));

	if (isProtected && !event.locals.user) {
		throw redirect(302, `/login?redirectTo=${encodeURIComponent(event.url.pathname)}`);
	}

	if (event.url.pathname === '/login' && event.locals.user) {
		throw redirect(302, '/audits');
	}

	if (event.url.pathname === '/' && event.locals.user) {
		throw redirect(302, '/audits');
	}

	if (event.url.pathname === '/' && !event.locals.user) {
		throw redirect(302, '/login');
	}

	return resolve(event);
};
