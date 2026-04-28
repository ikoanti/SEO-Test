import { redirect, type Handle } from '@sveltejs/kit';
import {
	authenticateToken,
	exportAuthCookie,
	failInterruptedAuditWork,
	readAuthTokenFromCookie
} from '$lib/server/pocketbase';

const PROTECTED_PREFIXES = ['/audits'];

const startupReconciliation = failInterruptedAuditWork()
	.then((result) => {
		if (result.audits || result.workflows || result.runs) {
			console.info(
				`[startup] failed interrupted audit work: ${result.audits} audit(s), ${result.workflows} workflow(s), ${result.runs} run(s).`
			);
		}
	})
	.catch((error) => {
		console.warn(
			'[startup] failed to reconcile interrupted audit work:',
			error instanceof Error ? error.message : error
		);
	});

export const handle: Handle = async ({ event, resolve }) => {
	await startupReconciliation;

	const token = readAuthTokenFromCookie(event.request.headers.get('cookie'));
	let authCookieHeader: string | null = null;

	if (token) {
		try {
			const auth = await authenticateToken(token);
			event.locals.user = auth.user;
			event.locals.pbToken = auth.token;
			authCookieHeader = exportAuthCookie(auth.token, auth.user as Record<string, unknown>);
		} catch {
			event.locals.user = null;
			event.locals.pbToken = undefined;
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

	const response = await resolve(event);

	if (authCookieHeader && !response.headers.has('set-cookie')) {
		response.headers.append('set-cookie', authCookieHeader);
	}

	return response;
};
