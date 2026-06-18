import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';

export const GET: RequestHandler = async ({ platform, locals, url }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const format = url.searchParams.get('format') ?? 'csv'; // 'csv' | 'json'
	void db; void format;
	// TODO(sonnet): query all non-deleted transactions for this user,
	// join categories, format as CSV or JSON per ?format= param,
	// return with appropriate Content-Disposition: attachment; filename="keel-export.csv"
	throw error(501, 'Not implemented');
};
