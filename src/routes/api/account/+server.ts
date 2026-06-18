import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getAccountSummary } from '$lib/server/queries/periods';

export const GET: RequestHandler = async ({ platform, locals }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	void db;
	// TODO(sonnet): resolve account_id and cadence from locals.userId,
	// call getAccountSummary, return json.
	throw error(501, 'Not implemented');
};
