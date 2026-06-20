import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getAccountSummary } from '$lib/server/queries/periods';
import { listTransactions } from '$lib/server/queries/transactions';
import { listCategories } from '$lib/server/queries/categories';
import type { Account, HarbourCadence } from '$lib/types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!locals.userId) redirect(302, '/auth');
	const db = getDb(platform);

	// One batch round trip for both account and cadence — eliminates a sequential waterfall.
	const [accountRes, settingsRes] = await db.batch<Account | { harbour_cadence: HarbourCadence }>([
		db
			.prepare(
				'SELECT * FROM accounts WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1'
			)
			.bind(locals.userId),
		db.prepare('SELECT harbour_cadence FROM settings WHERE user_id = ?').bind(locals.userId)
	]);

	const account = (accountRes.results?.[0] as Account) ?? null;
	if (!account) return { summary: null, transactions: [], categories: [] };
	const cadence =
		((settingsRes.results?.[0] as { harbour_cadence: HarbourCadence })?.harbour_cadence) ??
		'monthly';

	const [summary, transactions, categories] = await Promise.all([
		getAccountSummary(db, account.id, cadence),
		listTransactions(db, { account_id: account.id, limit: 20 }),
		listCategories(db, locals.userId)
	]);

	return { summary, transactions, categories };
};
