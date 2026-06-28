import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getReadDb } from '$lib/server/db';
import { listCategories, listCategoryTree } from '$lib/server/queries/categories';

export const load: PageServerLoad = async ({ platform, locals, setHeaders }) => {
	if (!locals.userId) redirect(302, '/auth');
	setHeaders({ 'cache-control': 'private, no-cache' });
	const rdb = getReadDb(platform);
	const hid = locals.householdId ?? locals.userId!;
	const [tree, categories] = await Promise.all([
		listCategoryTree(rdb, hid),
		listCategories(rdb, hid)
	]);
	// Top-level, non-system spending categories can be parents for new subcategories.
	const parents = categories.filter((c) => !c.parent_id && !c.is_system && c.kind === 'expense');
	return { tree, parents };
};
