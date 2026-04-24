import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';

const AUTH_COOKIE = 'pb_auth';
const PB_URL = env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const AUTH_COLLECTION = env.POCKETBASE_AUTH_COLLECTION || 'app_users';
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

export async function listAudits(auditId: string, token?: string) {
	const pb = createAuthedClient(token);
	let filter = '';
	if (auditId) {
		filter = `id = "${auditId}"`;
	}
	return pb.collection(AUDITS_COLLECTION).getFullList({
		sort: '-created',
		...(filter ? { filter } : {})
	});
}

export async function getAudit(auditId: string, token?: string) {
	const pb = createAuthedClient(token);
	return pb.collection(AUDITS_COLLECTION).getOne(auditId);
}

export async function createAuditRecord(input: {
	name: string;
	url: string;
	created_by?: string;
	audit_json: string;
	summary_json: string;
	status?: string;
}, token?: string) {
	const pb = createAuthedClient(token);
	return pb.collection(AUDITS_COLLECTION).create({
		name: input.name,
		url: input.url,
		created_by: input.created_by || null,
		status: input.status || 'completed',
		audit_json: input.audit_json,
		summary_json: input.summary_json
	});
}
