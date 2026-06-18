import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!locals.userId) redirect(302, '/auth');
	const db = getDb(platform);
	void db;

	// TODO(sonnet): load in parallel:
	// - getAccountSummary(db, account_id, cadence)
	// - listTransactions(db, { account_id, limit: 20 })
	// - listCategories(db, locals.userId)
	// Return { summary, transactions, categories }.
	return {
		summary: null,
		transactions: [],
		categories: []
	};
};
