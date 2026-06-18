import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!locals.userId) redirect(302, '/auth');
	const db = getDb(platform);
	void db;
	// TODO(sonnet): call listCategories(db, locals.userId).
	return { categories: [] as import('$lib/types').Category[] };
};
