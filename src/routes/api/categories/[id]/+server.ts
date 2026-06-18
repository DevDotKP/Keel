import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { deleteCategory } from '$lib/server/queries/categories';

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	void db;
	// TODO(sonnet): call deleteCategory(db, params.id, locals.userId).
	// Returns 403 if system category, 404 if not found.
	throw error(501, 'Not implemented');
};
