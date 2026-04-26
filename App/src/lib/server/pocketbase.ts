import PocketBase, { cookieParse, getTokenPayload } from 'pocketbase';
import { env } from '$env/dynamic/private';

const AUTH_COOKIE = 'pb_auth';
const PB_URL = env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const AUTH_COLLECTION = env.POCKETBASE_AUTH_COLLECTION || 'users';
const SUPERUSER_COLLECTION = '_superusers';
const WEBSITES_COLLECTION = env.POCKETBASE_WEBSITES_COLLECTION || 'websites';
const AUDITS_COLLECTION = env.POCKETBASE_AUDITS_COLLECTION || 'audits';
const WORKFLOWS_COLLECTION = env.POCKETBASE_WORKFLOWS_COLLECTION || 'workflows';
const RUNS_COLLECTION = env.POCKETBASE_RUNS_COLLECTION || 'runs';
const AUDIT_FINDING_TYPES_COLLECTION =
	env.POCKETBASE_AUDIT_FINDING_TYPES_COLLECTION || 'audit_finding_types';
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

function escapeFilterValue(value: string) {
	return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function truncateText(value: string, maxLength: number) {
	if (value.length <= maxLength) return value;
	return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function normalizeUrl(input: string) {
	const value = input.trim();
	const url = new URL(
		value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`
	);
	url.hash = '';
	return url.href;
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
		websites: WEBSITES_COLLECTION,
		audits: AUDITS_COLLECTION,
		workflows: WORKFLOWS_COLLECTION,
		runs: RUNS_COLLECTION,
		auditFindingTypes: AUDIT_FINDING_TYPES_COLLECTION,
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

export async function getOrCreateWebsiteRecord(url: string, token?: string) {
	const pb = createAuthedClient(token);
	const normalizedUrl = normalizeUrl(url);

	try {
		return await pb
			.collection(WEBSITES_COLLECTION)
			.getFirstListItem(`url = "${escapeFilterValue(normalizedUrl)}"`);
	} catch {
		return pb.collection(WEBSITES_COLLECTION).create({
			url: normalizedUrl,
			domain: new URL(normalizedUrl).hostname
		});
	}
}

export async function createAuditRecord(
	input: {
		website: string;
		created_by?: string;
		status?: string;
		audit_json?: string;
		summary_json?: string;
		completed_at?: string;
		report_html?: string;
		ai_visibility_json?: string;
	},
	token?: string
) {
	const pb = createAuthedClient(token);
	return pb.collection(AUDITS_COLLECTION).create({
		website: input.website,
		...(input.created_by ? { created_by: input.created_by } : {}),
		status: input.status || 'queued',
		audit_json: input.audit_json || '',
		summary_json: input.summary_json || '',
		...(input.completed_at ? { completed_at: input.completed_at } : {}),
		report_html: input.report_html || '',
		ai_visibility_json: input.ai_visibility_json || ''
	});
}

export async function listAudits(searchQuery: string, token?: string) {
	const pb = createAuthedClient(token);
	const audits = await pb.collection(AUDITS_COLLECTION).getFullList({
		expand: 'website'
	});

	const query = searchQuery.trim().toLowerCase();
	if (!query) return audits;

	return audits.filter((audit) => {
		const website = (audit.expand as { website?: { url?: string; domain?: string } } | undefined)
			?.website;
		return [website?.url, website?.domain, audit.status]
			.filter(Boolean)
			.some((value) => String(value).toLowerCase().includes(query));
	});
}

export async function getAudit(auditId: string, token?: string) {
	const pb = createAuthedClient(token);
	return pb.collection(AUDITS_COLLECTION).getOne(auditId, { expand: 'website' });
}

export async function updateAuditRecord(
	auditId: string,
	input: {
		status?: string;
		audit_json?: string;
		summary_json?: string;
		completed_at?: string | null;
		report_html?: string;
		ai_visibility_json?: string;
	},
	token?: string
) {
	const pb = createAuthedClient(token);
	return pb.collection(AUDITS_COLLECTION).update(auditId, input);
}

export async function createWorkflowRecord(
	input: {
		audit: string;
		status?: string;
		queued_at?: string;
		started_at?: string;
		completed_at?: string;
		error_message?: string;
		run_log?: string;
	},
	token?: string
) {
	const pb = createAuthedClient(token);
	return pb.collection(WORKFLOWS_COLLECTION).create({
		audit: input.audit,
		status: input.status || 'queued',
		queued_at: input.queued_at || new Date().toISOString(),
		...(input.started_at ? { started_at: input.started_at } : {}),
		...(input.completed_at ? { completed_at: input.completed_at } : {}),
		error_message: input.error_message || '',
		run_log: input.run_log || ''
	});
}

export async function getWorkflow(workflowId: string, token?: string) {
	const pb = createAuthedClient(token);
	return pb.collection(WORKFLOWS_COLLECTION).getOne(workflowId);
}

export async function getWorkflowByAuditId(auditId: string, token?: string) {
	const pb = createAuthedClient(token);
	return pb.collection(WORKFLOWS_COLLECTION).getFirstListItem(`audit = "${auditId}"`, {
		expand: 'audit.website'
	});
}

export async function updateWorkflowRecord(
	workflowId: string,
	input: {
		status?: string;
		started_at?: string | null;
		completed_at?: string | null;
		error_message?: string;
		run_log?: string;
	},
	token?: string
) {
	const pb = createAuthedClient(token);
	return pb.collection(WORKFLOWS_COLLECTION).update(workflowId, input);
}

export async function getOrCreateAuditFindingTypeRecord(
	input: {
		key: string;
		label: string;
		sort_order: number;
	},
	token?: string
) {
	const pb = createAuthedClient(token);

	try {
		return await pb
			.collection(AUDIT_FINDING_TYPES_COLLECTION)
			.getFirstListItem(`key = "${escapeFilterValue(input.key)}"`);
	} catch {
		return pb.collection(AUDIT_FINDING_TYPES_COLLECTION).create({
			key: input.key,
			label: input.label,
			sort_order: Number.isFinite(input.sort_order) && input.sort_order > 0 ? input.sort_order : 1
		});
	}
}

export async function createRunRecord(
	input: {
		workflow: string;
		audit_finding_type: string;
		status: string;
		started_at: string;
		completed_at?: string;
		error_message?: string;
		run_log?: string;
		sort_order: number;
	},
	token?: string
) {
	const pb = createAuthedClient(token);
	return pb.collection(RUNS_COLLECTION).create({
		workflow: input.workflow,
		audit_finding_type: input.audit_finding_type,
		status: input.status,
		started_at: input.started_at,
		...(input.completed_at ? { completed_at: input.completed_at } : {}),
		error_message: input.error_message || '',
		run_log: input.run_log || '',
		sort_order: Number.isFinite(input.sort_order) && input.sort_order > 0 ? input.sort_order : 1
	});
}

export async function getOrCreateRunRecord(
	input: {
		workflow: string;
		audit_finding_type: string;
		status: string;
		started_at: string;
		completed_at?: string;
		error_message?: string;
		run_log?: string;
		sort_order: number;
	},
	token?: string
) {
	const pb = createAuthedClient(token);

	try {
		return await pb
			.collection(RUNS_COLLECTION)
			.getFirstListItem(
				`workflow = "${escapeFilterValue(input.workflow)}" && audit_finding_type = "${escapeFilterValue(input.audit_finding_type)}"`
			);
	} catch {
		return createRunRecord(input, token);
	}
}

export async function updateRunRecord(
	runId: string,
	input: {
		status?: string;
		started_at?: string | null;
		completed_at?: string | null;
		error_message?: string;
		run_log?: string;
		sort_order?: number;
	},
	token?: string
) {
	const pb = createAuthedClient(token);
	return pb.collection(RUNS_COLLECTION).update(runId, input);
}

export async function listRunsByWorkflow(workflowId: string, token?: string) {
	const pb = createAuthedClient(token);
	return pb.collection(RUNS_COLLECTION).getFullList({
		filter: `workflow = "${workflowId}"`,
		sort: 'sort_order',
		expand: 'audit_finding_type'
	});
}

export async function createAuditFindingRecord(
	input: {
		audit: string;
		audit_finding_type: string;
		run?: string;
		status: string;
		title: string;
		detail: string;
		page_url?: string;
		meta_json?: string;
	},
	token?: string
) {
	const pb = createAuthedClient(token);
	let pageUrl: string | undefined;

	if (input.page_url) {
		try {
			const parsedUrl = new URL(input.page_url);
			if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
				pageUrl = parsedUrl.href;
			}
		} catch {
			pageUrl = undefined;
		}
	}

	return pb.collection(AUDIT_FINDINGS_COLLECTION).create({
		audit: input.audit,
		audit_finding_type: input.audit_finding_type,
		...(input.run ? { run: input.run } : {}),
		status: input.status,
		title: truncateText(input.title || input.detail || 'Finding', 255),
		detail: input.detail,
		...(pageUrl ? { page_url: pageUrl } : {}),
		meta_json: input.meta_json || ''
	});
}

export async function listAuditFindings(auditId: string, token?: string) {
	const pb = createAuthedClient(token);
	return pb.collection(AUDIT_FINDINGS_COLLECTION).getFullList({
		filter: `audit = "${auditId}"`,
		sort: 'title',
		expand: 'audit_finding_type,run'
	});
}

export async function deleteAuditFindingsByRunId(runId: string, token?: string) {
	const pb = createAuthedClient(token);
	const findings = await pb.collection(AUDIT_FINDINGS_COLLECTION).getFullList({
		filter: `run = "${escapeFilterValue(runId)}"`
	});

	await Promise.all(
		findings.map((finding) => pb.collection(AUDIT_FINDINGS_COLLECTION).delete(finding.id))
	);
}
