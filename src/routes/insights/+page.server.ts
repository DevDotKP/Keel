import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!locals.userId) redirect(302, '/auth');
	const db = getDb(platform);
	void db;
	// TODO(sonnet): load category totals for current period, period-over-period
	// totals for last 6 periods, uncategorized ratio, drift points series.
	return { categoryTotals: [], periodTrend: [], driftPoints: [] };
};
