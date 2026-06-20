import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb, getReadDb } from '$lib/server/db';
import { resolveAccountAndCadence } from '$lib/server/context';
import { getBudgetOverview } from '$lib/server/queries/budgets';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!locals.userId) redirect(302, '/auth');
	const db = getDb(platform);
	const rdb = getReadDb(platform);

	const { account, cadence } = await resolveAccountAndCadence(rdb, locals.userId);
	if (!account) return { overview: null };

	const overview = await getBudgetOverview(db, account.id, locals.userId, cadence, rdb);
	return { overview };
};
