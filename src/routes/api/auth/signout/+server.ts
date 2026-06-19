import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { clearSession } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	await clearSession(db, event);
	throw redirect(302, '/auth');
};
