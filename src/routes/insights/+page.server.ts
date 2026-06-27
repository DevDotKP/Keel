import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb, getReadDb } from '$lib/server/db';
import { resolveAccountAndCadence } from '$lib/server/context';
import { getInsightsData } from '$lib/server/queries/insights';

export const load: PageServerLoad = async ({ platform, locals, setHeaders }) => {
	if (!locals.userId) redirect(302, '/auth');
	setHeaders({ 'cache-control': 'private, no-cache' });
	const db = getDb(platform);
	const rdb = getReadDb(platform);

	const { account, cadence, harbourDay } = await resolveAccountAndCadence(rdb, locals.userId, locals.householdId ?? locals.userId!);
	if (!account) return { insights: null };

	return {
		insights: getInsightsData(db, account.id, locals.userId, cadence, harbourDay, rdb)
	};
};
