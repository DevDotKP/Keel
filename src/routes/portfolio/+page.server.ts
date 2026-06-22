import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getReadDb } from '$lib/server/db';
import { listHoldings, listSnapshots } from '$lib/server/queries/portfolio';

export const load: PageServerLoad = async ({ platform, locals, setHeaders }) => {
	if (!locals.userId) redirect(302, '/auth');
	setHeaders({ 'cache-control': 'private, max-age=0, stale-while-revalidate=30' });
	const rdb = getReadDb(platform);
	const hid = locals.householdId ?? locals.userId;
	const [holdings, snapshots] = await Promise.all([listHoldings(rdb, hid), listSnapshots(rdb, hid)]);
	const total_paise = holdings.reduce((s, h) => s + h.value_paise, 0);
	return { holdings, snapshots, total_paise };
};
