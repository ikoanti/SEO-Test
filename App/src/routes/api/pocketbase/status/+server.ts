import { json } from '@sveltejs/kit';
import { getPocketBaseStatus } from '$lib/server/legacy-api';

export function GET() {
	return json(getPocketBaseStatus());
}
