import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!locals.userId) redirect(302, '/auth');
	const db = getDb(platform);
	void db;

	// TODO(sonnet): load in parallel:
	// - getOrCreateCurrentPeriod(db, account_id, cadence)
	// - listTransactions for the period
	// - listCategories(db, locals.userId)
	// - count of open (unharboured) periods for amnesty detection
	// Return { period, summary, categories, openPeriods }.
	return {
		period: null,
		summary: null,
		categories: [],
		openPeriods: 0
	};
};
