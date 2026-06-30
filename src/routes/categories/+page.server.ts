import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getReadDb } from '$lib/server/db';
import { listCategories, listCategoryTree } from '$lib/server/queries/categories';

export const load: PageServerLoad = async ({ platform, locals, setHeaders }) => {
	if (!locals.userId) redirect(302, '/auth');
	setHeaders({ 'cache-control': 'private, no-cache' });
	const rdb = getReadDb(platform);
	const hid = locals.householdId ?? locals.userId!;
	const [tree, categories, settingsRow, incomeRow] = await Promise.all([
		listCategoryTree(rdb, hid),
		listCategories(rdb, hid),
		rdb
			.prepare('SELECT cycle_budget_paise FROM settings WHERE user_id = ?')
			.bind(locals.userId)
			.first<{ cycle_budget_paise: number | null }>(),
		rdb
			.prepare(
				`SELECT COALESCE(SUM(amount_paise), 0) AS total
				 FROM recurring_income
				 WHERE household_id = ? AND deleted_at IS NULL AND is_active = 1`
			)
			.bind(hid)
			.first<{ total: number }>()
	]);
	const parents = categories.filter((c) => !c.parent_id && !c.is_system && c.kind === 'expense');
	return {
		tree,
		parents,
		cycleBudgetPaise: settingsRow?.cycle_budget_paise ?? 0,
		recurringIncomeTotalPaise: incomeRow?.total ?? 0
	};
};
