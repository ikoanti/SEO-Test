import { timingSafeEqual } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getConfiguredSuperuserToken } from '$lib/server/pocketbase';

function bearerToken(request: Request) {
	const authorization = request.headers.get('authorization') || '';
	const match = authorization.match(/^Bearer\s+(.+)$/i);
	return match?.[1]?.trim() || request.headers.get('x-api-key')?.trim() || '';
}

function constantTimeEquals(left: string, right: string) {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);
	return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireExternalApiKey(request: Request) {
	const configuredKeys = String(env.EXTERNAL_AUDIT_API_KEY || '')
		.split(',')
		.map((key) => key.trim())
		.filter(Boolean);

	if (!configuredKeys.length) {
		throw error(503, 'External audit API is not configured.');
	}

	const submittedKey = bearerToken(request);
	if (!submittedKey || !configuredKeys.some((key) => constantTimeEquals(submittedKey, key))) {
		throw error(401, 'Invalid API key.');
	}
}

export async function externalApiPocketBaseToken(request: Request) {
	requireExternalApiKey(request);
	return getConfiguredSuperuserToken();
}

export async function readJsonBody(request: Request) {
	const contentType = request.headers.get('content-type') || '';
	if (!contentType.toLowerCase().includes('application/json')) {
		const text = await request.text();
		if (!text.trim()) return {};
		throw error(415, 'Request body must be application/json.');
	}

	try {
		const body = await request.json();
		return body && typeof body === 'object' && !Array.isArray(body)
			? (body as Record<string, unknown>)
			: {};
	} catch {
		throw error(400, 'Invalid JSON request body.');
	}
}
