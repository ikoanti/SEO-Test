import { redirect } from '@sveltejs/kit';
import { getAuthCookieName } from '$lib/server/pocketbase';

export const POST = async ({ cookies }) => {
	cookies.delete(getAuthCookieName(), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false
	});

	throw redirect(302, '/login');
};
