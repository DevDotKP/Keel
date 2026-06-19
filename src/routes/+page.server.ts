import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getDefaultAccount } from '$lib/server/queries/accounts';
import { getAccountSummary } from '$lib/server/queries/periods';
import { listTransactions } from '$lib/server/queries/transactions';
import { listCategories } from '$lib/server/queries/categories';
import type { HarbourCadence } from '$lib/types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!locals.userId) redirect(302, '/auth');
	const db = getDb(platform);

	const account = await getDefaultAccount(db, locals.userId);
	if (!account) return { summary: null, transactions: [], categories: [] };

	const settings = await db
		.prepare('SELECT harbour_cadence FROM settings WHERE user_id = ?')
		.bind(locals.userId)
		.first<{ harbour_cadence: HarbourCadence }>();
	const cadence = settings?.harbour_cadence ?? 'weekly';

	const [summary, transactions, categories] = await Promise.all([
		getAccountSummary(db, account.id, cadence),
		listTransactions(db, { account_id: account.id, limit: 20 }),
		listCategories(db, locals.userId)
	]);

	return { summary, transactions, categories };
};
