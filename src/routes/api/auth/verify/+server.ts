import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { verifyMagicLink } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
	const token = event.url.searchParams.get('token');
	if (!token) throw error(400, 'Token missing');

	const db = getDb(event.platform);
	const user = await verifyMagicLink(db, event, token);

	if (!user) {
		throw redirect(302, '/auth?error=invalid');
	}

	throw redirect(302, '/');
};
