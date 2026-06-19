import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { resolveAccountAndCadence } from '$lib/server/context';
import { getAccountSummary } from '$lib/server/queries/periods';
import { listTransactions } from '$lib/server/queries/transactions';
import { listCategories } from '$lib/server/queries/categories';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!locals.userId) redirect(302, '/auth');
	const db = getDb(platform);

	const { account, cadence } = await resolveAccountAndCadence(db, locals.userId);
	if (!account) {
		return { period: null, estimatePaise: 0, transactions: [], categories: [], openPeriods: 0 };
	}

	const summary = await getAccountSummary(db, account.id, cadence);
	const period = summary.current_period;

	// Exclusive upper bound: day after period_end.
	const to = new Date(`${period.period_end}T00:00:00`);
	to.setDate(to.getDate() + 1);
	const toStr = to.toISOString().slice(0, 10);

	const [transactions, categories] = await Promise.all([
		listTransactions(db, {
			account_id: account.id,
			from: period.period_start,
			to: toStr,
			limit: 200
		}),
		listCategories(db, locals.userId)
	]);

	return {
		period,
		estimatePaise: summary.remaining_paise,
		transactions,
		categories,
		openPeriods: summary.open_periods
	};
};
