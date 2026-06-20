import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb, getReadDb } from '$lib/server/db';
import { getAccountSummary } from '$lib/server/queries/periods';
import { listTransactions } from '$lib/server/queries/transactions';
import { listCategories } from '$lib/server/queries/categories';
import type { Account, HarbourCadence } from '$lib/types';

export const load: PageServerLoad = async ({ platform, locals, setHeaders }) => {
	if (!locals.userId) redirect(302, '/auth');
	setHeaders({ 'cache-control': 'private, max-age=0, stale-while-revalidate=30' });
	const db = getDb(platform);
	const rdb = getReadDb(platform);

	// Read account + cadence from replica in one batch.
	const [accountRes, settingsRes] = await rdb.batch<Account | { harbour_cadence: HarbourCadence }>([
		db
			.prepare(
				'SELECT * FROM accounts WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1'
			)
			.bind(locals.userId),
		db.prepare('SELECT harbour_cadence FROM settings WHERE user_id = ?').bind(locals.userId)
	]);

	const account = (accountRes.results?.[0] as Account) ?? null;
	if (!account) return { summary: null, transactions: Promise.resolve([]), categories: Promise.resolve([]) };
	const cadence =
		((settingsRes.results?.[0] as { harbour_cadence: HarbourCadence })?.harbour_cadence) ??
		'monthly';

	// Return promises — the page shell renders immediately while D1 responds.
	return {
		summary: getAccountSummary(db, account.id, cadence, rdb),
		transactions: listTransactions(rdb, { account_id: account.id, limit: 20 }),
		categories: listCategories(rdb, locals.userId)
	};
};
