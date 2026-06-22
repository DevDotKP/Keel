import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb, getReadDb } from '$lib/server/db';
import { getAccountSummary, getRunway } from '$lib/server/queries/periods';
import { listTransactions } from '$lib/server/queries/transactions';
import { listCategories } from '$lib/server/queries/categories';
import { getDefaultAccount } from '$lib/server/queries/accounts';
import type { HarbourCadence } from '$lib/types';

export const load: PageServerLoad = async ({ platform, locals, setHeaders }) => {
	if (!locals.userId) redirect(302, '/auth');
	setHeaders({ 'cache-control': 'private, max-age=0, stale-while-revalidate=30' });
	const db = getDb(platform);
	const rdb = getReadDb(platform);
	const hid = locals.householdId ?? locals.userId!;

	// Read account + cadence + harbourDay + household members in one batch.
	const [accountRes, settingsRes, membersRes] = await rdb.batch<
		{ id: string; balance_paise: number } | { harbour_cadence: HarbourCadence; harbour_day: string } | { id: string; email: string }
	>([
		rdb
			.prepare(
				'SELECT * FROM accounts WHERE household_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1'
			)
			.bind(hid),
		rdb
			.prepare('SELECT harbour_cadence, harbour_day FROM settings WHERE user_id = ?')
			.bind(locals.userId),
		rdb
			.prepare(
				`SELECT u.id, u.email, u.display_name FROM household_members hm
				 JOIN users u ON u.id = hm.user_id
				 WHERE hm.household_id = ?`
			)
			.bind(hid)
	]);

	const account = (accountRes.results?.[0] as { id: string } & Record<string, unknown>) ?? null;
	if (!account) return {
		summary: null,
		transactions: Promise.resolve([]),
		categories: Promise.resolve([]),
		runway: Promise.resolve(null),
		currentUserId: locals.userId,
		memberEmails: {} as Record<string, string>,
		memberNames: {} as Record<string, string>
	};

	const settingsRow = settingsRes.results?.[0] as
		| { harbour_cadence: HarbourCadence; harbour_day: string }
		| undefined;
	const cadence = settingsRow?.harbour_cadence ?? 'monthly';
	const harbourDay = settingsRow?.harbour_day ?? 'sunday';

	const memberEmails: Record<string, string> = {};
	const memberNames: Record<string, string> = {};
	for (const m of (membersRes.results ?? []) as Array<{ id: string; email: string; display_name: string | null }>) {
		memberEmails[m.id] = m.email;
		if (m.display_name) memberNames[m.id] = m.display_name;
	}

	// Return promises — the page shell renders immediately while D1 responds.
	return {
		summary: getAccountSummary(db, account.id as string, cadence, harbourDay, rdb),
		transactions: listTransactions(rdb, { account_id: account.id as string, limit: 20 }),
		categories: listCategories(rdb, hid),
		runway: getRunway(rdb, account.id as string),
		currentUserId: locals.userId,
		memberEmails,
		memberNames
	};
};
