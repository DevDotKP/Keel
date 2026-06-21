import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb, getReadDb } from '$lib/server/db';
import { resolveAccountAndCadence } from '$lib/server/context';
import { getOrCreateCurrentPeriod } from '$lib/server/queries/periods';
import { listObligations } from '$lib/server/queries/obligations';
import { listCategories } from '$lib/server/queries/categories';
import { listRecurringIncome } from '$lib/server/queries/recurring-income';

export const load: PageServerLoad = async ({ platform, locals, setHeaders }) => {
	if (!locals.userId) redirect(302, '/auth');
	setHeaders({ 'cache-control': 'private, max-age=0, stale-while-revalidate=30' });
	const db = getDb(platform);
	const rdb = getReadDb(platform);
	const hid = locals.householdId ?? locals.userId!;

	const { account, cadence, harbourDay } = await resolveAccountAndCadence(rdb, locals.userId, hid);
	if (!account) return { obligations: [], categories: [], recurringIncome: [], homeState: null };

	const period = await getOrCreateCurrentPeriod(db, account.id, cadence, harbourDay);
	const [obligations, categories, recurringIncome, settingsRow] = await Promise.all([
		listObligations(rdb, locals.userId, period.id),
		listCategories(rdb, locals.userId),
		listRecurringIncome(rdb, hid),
		rdb
			.prepare('SELECT home_state FROM settings WHERE user_id = ?')
			.bind(locals.userId)
			.first<{ home_state: string | null }>()
	]);

	return { obligations, categories, recurringIncome, homeState: settingsRow?.home_state ?? null };
};
