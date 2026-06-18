import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { verifyMagicLink } from '$lib/server/auth';

export const GET: RequestHandler = async ({ platform, url }) => {
	const token = url.searchParams.get('token');
	if (!token) throw error(400, 'Token missing');
	const db = getDb(platform);
	void db;
	// TODO(sonnet): call verifyMagicLink(db, event, token).
	// On success: redirect to '/'. On failure: redirect to '/auth?error=invalid'.
	throw error(501, 'Not implemented');
};
