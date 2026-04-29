import { redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
	authenticateToken,
	exportAuthCookie,
	failInterruptedAuditWork,
	readAuthTokenFromCookie
} from '$lib/server/pocketbase';

const PROTECTED_PREFIXES = ['/audits'];

function positiveNumber(value: string | undefined, fallback: number) {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const STARTUP_RECONCILE_ATTEMPTS = positiveNumber(env.STARTUP_RECONCILE_ATTEMPTS, 30);
const STARTUP_RECONCILE_DELAY_MS = positiveNumber(env.STARTUP_RECONCILE_DELAY_MS, 2000);

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

async function reconcileInterruptedAuditWork() {
	for (let attempt = 1; attempt <= STARTUP_RECONCILE_ATTEMPTS; attempt += 1) {
		try {
			const result = await failInterruptedAuditWork();
			console.info(
				`[startup] reconciled interrupted audit work: ${result.audits} audit(s), ${result.workflows} workflow(s), ${result.runs} run(s).`
			);
			return;
		} catch (error) {
			const isFinalAttempt = attempt >= STARTUP_RECONCILE_ATTEMPTS;
			console.warn(
				`[startup] failed to reconcile interrupted audit work${
					isFinalAttempt ? '' : `, retrying (${attempt}/${STARTUP_RECONCILE_ATTEMPTS})`
				}: ${errorMessage(error)}`
			);
			if (isFinalAttempt) return;
			await delay(STARTUP_RECONCILE_DELAY_MS);
		}
	}
}

const startupReconciliation = reconcileInterruptedAuditWork();

function shouldWaitForStartupReconciliation(pathname: string) {
	return pathname !== '/api/health';
}

export const handle: Handle = async ({ event, resolve }) => {
	if (shouldWaitForStartupReconciliation(event.url.pathname)) {
		await startupReconciliation;
	}

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
