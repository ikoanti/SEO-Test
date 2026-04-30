import PocketBase, { cookieParse, getTokenPayload } from 'pocketbase';
import { env } from '$env/dynamic/private';

const AUTH_COOKIE = 'pb_auth';
const PB_URL = env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const PB_PUBLIC_URL = env.POCKETBASE_PUBLIC_URL || env.PUBLIC_POCKETBASE_URL || PB_URL;
const AUTH_COLLECTION = env.POCKETBASE_AUTH_COLLECTION || 'users';
const SUPERUSER_COLLECTION = '_superusers';
const WEBSITES_COLLECTION = env.POCKETBASE_WEBSITES_COLLECTION || 'websites';
const AUDITS_COLLECTION = env.POCKETBASE_AUDITS_COLLECTION || 'audits';
const WORKFLOWS_COLLECTION = env.POCKETBASE_WORKFLOWS_COLLECTION || 'workflows';
const RUNS_COLLECTION = env.POCKETBASE_RUNS_COLLECTION || 'runs';
const AUDIT_FINDING_TYPES_COLLECTION =
	env.POCKETBASE_AUDIT_FINDING_TYPES_COLLECTION || 'audit_finding_types';
const AUDIT_FINDINGS_COLLECTION = env.POCKETBASE_AUDIT_FINDINGS_COLLECTION || 'audit_findings';
const AUDIT_SCREENSHOTS_COLLECTION =
	env.POCKETBASE_AUDIT_SCREENSHOTS_COLLECTION || 'audit_screenshots';
const AUDIT_REPORT_TEMPLATES_COLLECTION =
	env.POCKETBASE_AUDIT_REPORT_TEMPLATES_COLLECTION || 'audit_report_templates';
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

async function createConfiguredSuperuserClient() {
	const email = env.POCKETBASE_SUPERUSER_EMAIL || env.POCKETBASE_ADMIN_EMAIL;
	const password = env.POCKETBASE_SUPERUSER_PASSWORD || env.POCKETBASE_ADMIN_PASSWORD;
	if (!email || !password) {
		throw new Error('PocketBase superuser credentials are not configured.');
	}

	const pb = createClient();
	await pb.collection(SUPERUSER_COLLECTION).authWithPassword(email, password);
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
	const value = input.trim().replace(/\s+/g, '');
	if (!value) throw new Error('Website URL is required.');

	const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
	const url = new URL(normalized);
	if (!['http:', 'https:'].includes(url.protocol)) {
		throw new Error('Website URL must use HTTP or HTTPS.');
	}

	url.hash = '';
	return url.href;
}

function normalizedDomainFromUrl(input: string) {
	const url = new URL(normalizeUrl(input));
	return url.hostname.replace(/^www\./i, '').toLowerCase();
}

function suggestedWebsiteDisplayName(domain: string) {
	const [name = '', ...suffixParts] = domain.split('.');
	const suffix = suffixParts.join('.');
	const displayName = name
		.split(/[-_]+/)
		.filter(Boolean)
		.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
		.join('');
	return suffix ? `${displayName || name}.${suffix}` : displayName || domain;
}

function normalizeOptionalUrl(input?: string) {
	const value = String(input || '').trim();
	if (!value) return undefined;

	try {
		const url = new URL(value);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;

		url.hash = '';
		const href = url.href;
		if (href.length > 2000) return undefined;
		if (
			[...href].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
		) {
			return undefined;
		}
		if (/[\s<>"`{}|\\^]/.test(href)) return undefined;
		return href;
	} catch {
		return undefined;
	}
}

function hasFieldValidationError(error: unknown, field: string) {
	const response = (error as { response?: { data?: Record<string, unknown> } }).response;
	return Boolean(response?.data && field in response.data);
}

function publicPocketBaseFileUrl(
	pb: PocketBase,
	record: Record<string, unknown>,
	filename: string
) {
	const internalUrl = pb.files.getURL(record, filename);
	const internalOrigin = PB_URL.replace(/\/$/, '');
	const publicOrigin = PB_PUBLIC_URL.replace(/\/$/, '');
	return internalUrl.startsWith(internalOrigin)
		? `${publicOrigin}${internalUrl.slice(internalOrigin.length)}`
		: internalUrl;
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
		auditFindings: AUDIT_FINDINGS_COLLECTION,
		auditScreenshots: AUDIT_SCREENSHOTS_COLLECTION,
		auditReportTemplates: AUDIT_REPORT_TEMPLATES_COLLECTION
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

export async function failInterruptedAuditWork() {
	const pb = await createConfiguredSuperuserClient();
	const failedAt = new Date().toISOString();
	const message = 'Interrupted by app service reload.';
	const staleStatusFilter = 'status = "queued" || status = "running"';

	const [audits, workflows, runs] = await Promise.all([
		pb.collection(AUDITS_COLLECTION).getFullList({ filter: staleStatusFilter }),
		pb.collection(WORKFLOWS_COLLECTION).getFullList({ filter: staleStatusFilter }),
		pb.collection(RUNS_COLLECTION).getFullList({ filter: staleStatusFilter })
	]);

	await Promise.all([
		...audits.map((audit) =>
			pb.collection(AUDITS_COLLECTION).update(audit.id, {
				status: 'failed',
				updated_at: failedAt
			})
		),
		...workflows.map((workflow) =>
			pb.collection(WORKFLOWS_COLLECTION).update(workflow.id, {
				status: 'failed',
				completed_at: failedAt,
				error_message: message,
				run_log: workflow.run_log
					? `${workflow.run_log}\n[${failedAt}] ${message}`
					: `[${failedAt}] ${message}`
			})
		),
		...runs.map((run) =>
			pb.collection(RUNS_COLLECTION).update(run.id, {
				status: 'failed',
				completed_at: failedAt,
				error_message: message,
				run_log: run.run_log ? `${run.run_log}\n[${failedAt}] ${message}` : message
			})
		)
	]);

	return {
		audits: audits.length,
		workflows: workflows.length,
		runs: runs.length
	};
}

export async function getOrCreateWebsiteRecord(url: string, token?: string) {
	const pb = createAuthedClient(token);
	const normalizedUrl = normalizeUrl(url);
	const domain = normalizedDomainFromUrl(normalizedUrl);
	const displayName = suggestedWebsiteDisplayName(domain);

	try {
		return await pb
			.collection(WEBSITES_COLLECTION)
			.getFirstListItem(`domain = "${escapeFilterValue(domain)}"`);
	} catch (error) {
		const response = (error as { response?: { status?: number } }).response;
		if (response?.status && response.status !== 404) throw error;

		return pb.collection(WEBSITES_COLLECTION).create({
			url: normalizedUrl,
			domain,
			display_name: displayName
		});
	}
}

export async function getOrCreateWebsiteForAudit(
	input: { domain: string; display_name?: string },
	token?: string
) {
	const pb = createAuthedClient(token);
	const normalizedUrl = normalizeUrl(input.domain);
	const domain = normalizedDomainFromUrl(normalizedUrl);
	const displayName = input.display_name?.trim() || suggestedWebsiteDisplayName(domain);

	try {
		const website = await pb
			.collection(WEBSITES_COLLECTION)
			.getFirstListItem(`domain = "${escapeFilterValue(domain)}"`);
		if (input.display_name?.trim() && website.display_name !== displayName) {
			return pb.collection(WEBSITES_COLLECTION).update(website.id, {
				display_name: displayName
			});
		}
		return website;
	} catch (error) {
		const response = (error as { response?: { status?: number } }).response;
		if (response?.status && response.status !== 404) throw error;

		return pb.collection(WEBSITES_COLLECTION).create({
			url: normalizedUrl,
			domain,
			display_name: displayName
		});
	}
}

export async function updateWebsiteRecord(
	websiteId: string,
	input: { display_name?: string },
	token?: string
) {
	const pb = createAuthedClient(token);
	return pb.collection(WEBSITES_COLLECTION).update(websiteId, {
		...(input.display_name !== undefined ? { display_name: input.display_name.trim() } : {})
	});
}

export async function createAuditRecord(
	input: {
		website: string;
		created_by?: string;
		status?: string;
		audit_json?: string;
		summary_json?: string;
		completed_at?: string;
		report_status?: string;
		report_error?: string;
		report_started_at?: string;
		report_completed_at?: string;
		report_docx?: null;
		selected_report_template_keys_json?: string;
		ai_visibility_json?: string;
		created_at?: string;
		updated_at?: string;
	},
	token?: string
) {
	const pb = createAuthedClient(token);
	const timestamp = new Date().toISOString();
	return pb.collection(AUDITS_COLLECTION).create({
		website: input.website,
		...(input.created_by ? { created_by: input.created_by } : {}),
		status: input.status || 'queued',
		created_at: input.created_at || timestamp,
		updated_at: input.updated_at || timestamp,
		audit_json: input.audit_json || '',
		summary_json: input.summary_json || '',
		...(input.completed_at ? { completed_at: input.completed_at } : {}),
		report_status: input.report_status || 'idle',
		report_error: input.report_error || '',
		...(input.report_started_at ? { report_started_at: input.report_started_at } : {}),
		...(input.report_completed_at ? { report_completed_at: input.report_completed_at } : {}),
		selected_report_template_keys_json: input.selected_report_template_keys_json || '',
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
		const website = (
			audit.expand as
				| { website?: { url?: string; domain?: string; display_name?: string } }
				| undefined
		)?.website;
		return [website?.url, website?.domain, website?.display_name, audit.status]
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
		report_status?: string;
		report_error?: string;
		report_started_at?: string | null;
		report_completed_at?: string | null;
		report_docx?: null;
		selected_report_template_keys_json?: string;
		ai_visibility_json?: string;
		updated_at?: string;
	},
	token?: string
) {
	const pb = createAuthedClient(token);
	return pb.collection(AUDITS_COLLECTION).update(auditId, {
		...input,
		updated_at: input.updated_at || new Date().toISOString()
	});
}

export async function saveAuditReportDocx(
	auditId: string,
	input: {
		filename: string;
		body: Uint8Array | ArrayBuffer | Buffer;
		report_completed_at: string;
	},
	token?: string
) {
	const pb = createAuthedClient(token);
	const body = input.body instanceof ArrayBuffer ? input.body : new Uint8Array(input.body).buffer;
	const docxBlob = new Blob([body], {
		type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	});
	const formData = new FormData();
	formData.set('report_status', 'completed');
	formData.set('report_error', '');
	formData.set('report_completed_at', input.report_completed_at);
	formData.set('updated_at', new Date().toISOString());
	formData.set('report_docx', docxBlob, input.filename);

	return pb.collection(AUDITS_COLLECTION).update(auditId, formData);
}

export async function getAuditReportDocxFile(auditId: string, token?: string) {
	const pb = createAuthedClient(token);
	const audit = (await pb
		.collection(AUDITS_COLLECTION)
		.getOne(auditId, { expand: 'website' })) as Record<string, unknown>;
	const filename = typeof audit.report_docx === 'string' ? audit.report_docx : '';

	if (!filename) {
		throw new Error('Report document is missing.');
	}

	const fileUrl = pb.files.getURL(audit, filename);
	const response = await fetch(fileUrl, {
		headers: token ? { Authorization: `Bearer ${token}` } : undefined
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch report document: ${response.status}`);
	}

	return {
		filename,
		contentType:
			response.headers.get('content-type') ||
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		body: await response.arrayBuffer()
	};
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

async function deleteRecordsByFilter(collection: string, filter: string, token?: string) {
	const pb = createAuthedClient(token);
	const records = await pb.collection(collection).getFullList({ filter });
	await Promise.all(records.map((record) => pb.collection(collection).delete(record.id)));
}

export async function deleteAuditDerivedRecords(
	auditId: string,
	workflowId: string | undefined,
	token?: string
) {
	const escapedAuditId = escapeFilterValue(auditId);
	await deleteRecordsByFilter(AUDIT_FINDINGS_COLLECTION, `audit = "${escapedAuditId}"`, token);
	await deleteRecordsByFilter(AUDIT_SCREENSHOTS_COLLECTION, `audit = "${escapedAuditId}"`, token);

	if (!workflowId) return;

	const escapedWorkflowId = escapeFilterValue(workflowId);
	await deleteRecordsByFilter(RUNS_COLLECTION, `workflow = "${escapedWorkflowId}"`, token);
	await deleteRecordsByFilter(WORKFLOWS_COLLECTION, `id = "${escapedWorkflowId}"`, token);
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

export type AuditReportTemplateRecord = {
	id: string;
	key: string;
	audit_finding_type?: string;
	title: string;
	priority: 'Urgent' | 'High' | 'Medium';
	match_pattern?: string;
	template_body: string;
	sort_order: number;
	enabled?: boolean;
	expand?: {
		audit_finding_type?: {
			key?: string;
			label?: string;
		};
	};
};

export async function listAuditReportTemplates(token?: string) {
	const pb = createAuthedClient(token);

	try {
		return (await pb.collection(AUDIT_REPORT_TEMPLATES_COLLECTION).getFullList({
			filter: 'enabled = true',
			sort: 'sort_order',
			expand: 'audit_finding_type'
		})) as unknown as AuditReportTemplateRecord[];
	} catch (error) {
		const response = (error as { response?: { status?: number } }).response;
		if (response?.status === 400 || response?.status === 404) return [];
		throw error;
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

export async function listAuditFindingTypes(token?: string) {
	const pb = createAuthedClient(token);
	return pb.collection(AUDIT_FINDING_TYPES_COLLECTION).getFullList({
		sort: 'sort_order'
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
	const pageUrl = normalizeOptionalUrl(input.page_url);
	const payload = {
		audit: input.audit,
		audit_finding_type: input.audit_finding_type,
		...(input.run ? { run: input.run } : {}),
		status: input.status,
		title: truncateText(input.title || input.detail || 'Finding', 255),
		detail: input.detail,
		...(pageUrl ? { page_url: pageUrl } : {}),
		meta_json: input.meta_json || ''
	};

	try {
		return await pb.collection(AUDIT_FINDINGS_COLLECTION).create(payload);
	} catch (error) {
		if (!pageUrl || !hasFieldValidationError(error, 'page_url')) throw error;

		const fallbackPayload = { ...payload };
		delete (fallbackPayload as { page_url?: string }).page_url;
		return pb.collection(AUDIT_FINDINGS_COLLECTION).create(fallbackPayload);
	}
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

export async function createAuditScreenshotRecord(
	input: {
		audit: string;
		audit_finding_type: string;
		run?: string;
		report_template_key?: string;
		title: string;
		page_url?: string;
		content_type: string;
		image_base64: string;
	},
	token?: string
) {
	const pb = createAuthedClient(token);
	const pageUrl = normalizeOptionalUrl(input.page_url);

	const imageBuffer = Buffer.from(input.image_base64, 'base64');
	const imageBlob = new Blob([imageBuffer], { type: input.content_type || 'image/png' });
	const buildFormData = (includePageUrl: boolean) => {
		const formData = new FormData();
		formData.set('audit', input.audit);
		formData.set('audit_finding_type', input.audit_finding_type);
		if (input.run) formData.set('run', input.run);
		if (input.report_template_key) formData.set('report_template_key', input.report_template_key);
		formData.set('title', truncateText(input.title || 'Audit screenshot', 255));
		if (includePageUrl && pageUrl) formData.set('page_url', pageUrl);
		formData.set('image', imageBlob, 'audit-screenshot.png');
		return formData;
	};

	try {
		return await pb.collection(AUDIT_SCREENSHOTS_COLLECTION).create(buildFormData(true));
	} catch (error) {
		if (!pageUrl || !hasFieldValidationError(error, 'page_url')) throw error;
		return pb.collection(AUDIT_SCREENSHOTS_COLLECTION).create(buildFormData(false));
	}
}

export async function listAuditScreenshots(auditId: string, token?: string) {
	const pb = createAuthedClient(token);
	let screenshots;
	try {
		screenshots = await pb.collection(AUDIT_SCREENSHOTS_COLLECTION).getFullList({
			filter: `audit = "${escapeFilterValue(auditId)}"`,
			expand: 'audit_finding_type,run'
		});
	} catch (error) {
		const response = (error as { response?: { status?: number } }).response;
		if (response?.status === 400 || response?.status === 404) return [];
		throw error;
	}

	return screenshots.map((screenshot) => ({
		...(screenshot as Record<string, unknown>),
		image_url:
			typeof screenshot.image === 'string' && screenshot.image
				? publicPocketBaseFileUrl(pb, screenshot as Record<string, unknown>, screenshot.image)
				: ''
	}));
}

export async function getAuditScreenshotFile(
	auditId: string,
	screenshotId: string,
	token?: string
) {
	const pb = createAuthedClient(token);
	const screenshot = (await pb
		.collection(AUDIT_SCREENSHOTS_COLLECTION)
		.getOne(screenshotId)) as Record<string, unknown>;

	if (String(screenshot.audit || '') !== auditId) {
		throw new Error('Screenshot does not belong to this audit.');
	}

	const filename = typeof screenshot.image === 'string' ? screenshot.image : '';
	if (!filename) {
		throw new Error('Screenshot image is missing.');
	}

	const fileUrl = pb.files.getURL(screenshot, filename);
	const response = await fetch(fileUrl, {
		headers: token ? { Authorization: `Bearer ${token}` } : undefined
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch screenshot image: ${response.status}`);
	}

	return {
		filename,
		contentType: response.headers.get('content-type') || 'image/png',
		body: await response.arrayBuffer()
	};
}

export async function deleteAuditScreenshotsByRunId(runId: string, token?: string) {
	const pb = createAuthedClient(token);
	let screenshots;
	try {
		screenshots = await pb.collection(AUDIT_SCREENSHOTS_COLLECTION).getFullList({
			filter: `run = "${escapeFilterValue(runId)}"`
		});
	} catch (error) {
		const response = (error as { response?: { status?: number } }).response;
		if (response?.status === 400 || response?.status === 404) return;
		throw error;
	}

	await Promise.all(
		screenshots.map((screenshot) =>
			pb.collection(AUDIT_SCREENSHOTS_COLLECTION).delete(screenshot.id)
		)
	);
}
