import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';

const AUTH_COOKIE = 'pb_auth';
const PB_URL = env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const AUTH_COLLECTION = env.POCKETBASE_AUTH_COLLECTION || 'users';
const RUNS_COLLECTION = env.POCKETBASE_RUNS_COLLECTION || 'runs';
const AUDITS_COLLECTION = env.POCKETBASE_AUDITS_COLLECTION || 'audits';

export type AppUser = {
	id: string;
	email?: string;
	name?: string;
	collectionName?: string;
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

export function getCollectionNames() {
	return {
		auth: AUTH_COLLECTION,
		runs: RUNS_COLLECTION,
		audits: AUDITS_COLLECTION
	};
}

export async function loginWithPassword(email: string, password: string) {
	const pb = createClient();
	const auth = await pb.collection(AUTH_COLLECTION).authWithPassword(email, password);
	return {
		token: auth.token,
		user: auth.record as AppUser
	};
}

export async function authenticateToken(token: string) {
	const pb = createClient();
	pb.authStore.save(token);
	const auth = await pb.collection(AUTH_COLLECTION).authRefresh();
	return {
		token: auth.token,
		user: auth.record as AppUser
	};
}

export async function listRuns(runId: string, token?: string) {
	const pb = createAuthedClient(token);
	let filter = '';
	if (runId) {
		filter = `id = "${runId}"`;
	}
	return pb.collection(RUNS_COLLECTION).getFullList({
		sort: '-created',
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
