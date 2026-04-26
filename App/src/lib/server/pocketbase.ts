import PocketBase, { cookieParse, getTokenPayload } from 'pocketbase';
import { env } from '$env/dynamic/private';

const AUTH_COOKIE = 'pb_auth';
const PB_URL = env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const AUTH_COLLECTION = env.POCKETBASE_AUTH_COLLECTION || 'users';
const SUPERUSER_COLLECTION = '_superusers';
const RUNS_COLLECTION = env.POCKETBASE_RUNS_COLLECTION || 'runs';
const AUDITS_COLLECTION = env.POCKETBASE_AUDITS_COLLECTION || 'audits';
const AUDIT_ITEMS_COLLECTION = env.POCKETBASE_AUDIT_ITEMS_COLLECTION || 'audit_items';
const AUDIT_FINDINGS_COLLECTION = env.POCKETBASE_AUDIT_FINDINGS_COLLECTION || 'audit_findings';
const AUTH_COOKIE_OPTIONS = {
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: false,
	path: '/'
};

export type AppUser = {
	id: string;
	email?: string;
	name?: string;
	collectionName?: string;
	isSuperuser?: boolean;
	[key: string]: unknown;
};

function createClient() {
	const pb = new PocketBase(PB_URL);
	pb.autoCancellation(false);
	return pb;
}

function createAuthedClient(token?: string) {
	const pb = createClient();
	if (token) {
		pb.authStore.save(token);
	}
	return pb;
}

export function getAuthCookieName() {
	return AUTH_COOKIE;
}

export function readAuthTokenFromCookie(cookieHeader?: string | null) {
	const pb = createClient();
	pb.authStore.loadFromCookie(cookieHeader || '', AUTH_COOKIE);
	return pb.authStore.token;
}

export function exportAuthCookie(token: string, record?: Record<string, unknown> | null) {
	const pb = createClient();
	pb.authStore.save(token, (record as never) || null);
	return pb.authStore.exportToCookie(AUTH_COOKIE_OPTIONS, AUTH_COOKIE);
}

export function clearAuthCookieHeader() {
	const pb = createClient();
	pb.authStore.clear();
	return pb.authStore.exportToCookie(AUTH_COOKIE_OPTIONS, AUTH_COOKIE);
}

export function getAuthCookieValue(token: string, record?: Record<string, unknown> | null) {
	return cookieParse(exportAuthCookie(token, record))[AUTH_COOKIE] || '';
}

export function getAuthCookieExpires(token: string) {
	const payload = getTokenPayload(token);
	return payload.exp ? new Date(payload.exp * 1000) : undefined;
}

export function getCollectionNames() {
	return {
		auth: AUTH_COLLECTION,
		superusers: SUPERUSER_COLLECTION,
		runs: RUNS_COLLECTION,
		audits: AUDITS_COLLECTION,
		auditItems: AUDIT_ITEMS_COLLECTION,
		auditFindings: AUDIT_FINDINGS_COLLECTION
	};
}

function normalizeAuthRecord(
	record: Record<string, unknown>,
	collectionName: string,
	token: string
): { token: string; user: AppUser } {
	return {
		token,
		user: {
			...(record as AppUser),
			name:
				typeof record.name === 'string' && record.name.trim()
					? record.name
					: typeof record.email === 'string'
						? record.email
						: 'PocketBase User',
			collectionName,
			isSuperuser: collectionName === SUPERUSER_COLLECTION
		}
	};
}

export async function loginWithPassword(email: string, password: string) {
	const pb = createClient();
	try {
		const auth = await pb.collection(AUTH_COLLECTION).authWithPassword(email, password);
		return normalizeAuthRecord(auth.record as Record<string, unknown>, AUTH_COLLECTION, auth.token);
	} catch {
		const auth = await pb.collection(SUPERUSER_COLLECTION).authWithPassword(email, password);
		return normalizeAuthRecord(
			auth.record as Record<string, unknown>,
			SUPERUSER_COLLECTION,
			auth.token
		);
	}
}

export async function authenticateToken(token: string) {
	const pb = createClient();
	pb.authStore.save(token);
	try {
		const auth = await pb.collection(AUTH_COLLECTION).authRefresh();
		return normalizeAuthRecord(auth.record as Record<string, unknown>, AUTH_COLLECTION, auth.token);
	} catch {
		const auth = await pb.collection(SUPERUSER_COLLECTION).authRefresh();
		return normalizeAuthRecord(
			auth.record as Record<string, unknown>,
			SUPERUSER_COLLECTION,
			auth.token
		);
	}
}

function escapeFilterValue(value: string) {
	return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

export async function listRuns(searchQuery: string, token?: string) {
	const pb = createAuthedClient(token);
	let filter = '';
	if (searchQuery.trim()) {
		const escaped = escapeFilterValue(searchQuery.trim());
		filter = `url ~ "${escaped}" || name ~ "${escaped}" || status ~ "${escaped}"`;
	}
	return pb.collection(RUNS_COLLECTION).getFullList({
		sort: '-queued_at',
		...(filter ? { filter } : {})
	});
}

export async function getRun(runId: string, token?: string) {
	const pb = createAuthedClient(token);
	return pb.collection(RUNS_COLLECTION).getOne(runId);
}

export async function createRunRecord(
	input: {
		name: string;
		url: string;
		created_by?: string;
		status?: string;
		error_message?: string;
		run_log?: string;
		queued_at?: string;
		started_at?: string;
		completed_at?: string;
	},
	token?: string
) {
	const pb = createAuthedClient(token);
	return pb.collection(RUNS_COLLECTION).create({
		name: input.name,
		url: input.url,
		created_by: input.created_by || null,
		status: input.status || 'queued',
		error_message: input.error_message || '',
		run_log: input.run_log || '',
		queued_at: input.queued_at || new Date().toISOString(),
		...(input.started_at ? { started_at: input.started_at } : {}),
		...(input.completed_at ? { completed_at: input.completed_at } : {})
	});
}

export async function updateRunRecord(
	runId: string,
	input: {
		status?: string;
		error_message?: string;
		run_log?: string;
		started_at?: string;
		completed_at?: string;
	},
	token?: string
) {
	const pb = createAuthedClient(token);
	return pb.collection(RUNS_COLLECTION).update(runId, input);
}

export async function createAuditRecord(
	input: {
		run: string;
		name: string;
		url: string;
		created_by?: string;
		audit_json: string;
		summary_json: string;
		completed_at?: string;
		report_html?: string;
		ai_visibility_json?: string;
	},
	token?: string
) {
	const pb = createAuthedClient(token);
	return pb.collection(AUDITS_COLLECTION).create({
		run: input.run,
		name: input.name,
		url: input.url,
		created_by: input.created_by || null,
		audit_json: input.audit_json,
		summary_json: input.summary_json,
		completed_at: input.completed_at || new Date().toISOString(),
		report_html: input.report_html || '',
		ai_visibility_json: input.ai_visibility_json || ''
	});
}

export async function getAuditByRunId(runId: string, token?: string) {
	const pb = createAuthedClient(token);
	return pb.collection(AUDITS_COLLECTION).getFirstListItem(`run = "${runId}"`);
}

export async function getAudit(auditId: string, token?: string) {
	const pb = createAuthedClient(token);
	return pb.collection(AUDITS_COLLECTION).getOne(auditId);
}

export async function updateAuditRecord(
	auditId: string,
	input: {
		report_html?: string;
		ai_visibility_json?: string;
	},
	token?: string
) {
	const pb = createAuthedClient(token);
	return pb.collection(AUDITS_COLLECTION).update(auditId, input);
}

export async function createAuditItemRecord(
	input: {
		audit: string;
		key: string;
		label: string;
		status: string;
		summary: string;
		stats_json?: string;
		sort_order: number;
	},
	token?: string
) {
	const pb = createAuthedClient(token);
	return pb.collection(AUDIT_ITEMS_COLLECTION).create({
		audit: input.audit,
		key: input.key,
		label: input.label,
		status: input.status,
		summary: input.summary,
		stats_json: input.stats_json || '',
		sort_order: input.sort_order
	});
}

export async function createAuditFindingRecord(
	input: {
		audit: string;
		audit_item: string;
		status: string;
		title: string;
		detail: string;
		page_url?: string;
		meta_json?: string;
	},
	token?: string
) {
	const pb = createAuthedClient(token);
	return pb.collection(AUDIT_FINDINGS_COLLECTION).create({
		audit: input.audit,
		audit_item: input.audit_item,
		status: input.status,
		title: input.title,
		detail: input.detail,
		page_url: input.page_url || '',
		meta_json: input.meta_json || ''
	});
}

export async function listAuditItems(auditId: string, token?: string) {
	const pb = createAuthedClient(token);
	return pb.collection(AUDIT_ITEMS_COLLECTION).getFullList({
		filter: `audit = "${auditId}"`,
		sort: 'sort_order'
	});
}

export async function listAuditFindings(auditId: string, token?: string) {
	const pb = createAuthedClient(token);
	return pb.collection(AUDIT_FINDINGS_COLLECTION).getFullList({
		filter: `audit = "${auditId}"`,
		sort: 'title'
	});
}
