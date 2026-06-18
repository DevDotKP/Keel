import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { softDeleteTransaction } from '$lib/server/queries/transactions';

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	void db;
	// TODO(sonnet): resolve account_id from userId, call softDeleteTransaction.
	throw error(501, 'Not implemented');
};
