import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { listCategories, listCategoryTree } from '$lib/server/queries/categories';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!locals.userId) redirect(302, '/auth');
	const db = getDb(platform);
	const [tree, categories] = await Promise.all([
		listCategoryTree(db, locals.userId),
		listCategories(db, locals.userId)
	]);
	// Top-level, non-system spending categories can be parents for new subcategories.
	const parents = categories.filter((c) => !c.parent_id && !c.is_system && c.kind === 'expense');
	return { tree, parents };
};
