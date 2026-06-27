import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb, getReadDb } from '$lib/server/db';
import { listTransactions } from '$lib/server/queries/transactions';
import { listCategories } from '$lib/server/queries/categories';
import { getDefaultAccount } from '$lib/server/queries/accounts';

const PAGE_SIZE = 30;

export const load: PageServerLoad = async ({ platform, locals, url, setHeaders }) => {
	if (!locals.userId) redirect(302, '/auth');
	setHeaders({ 'cache-control': 'private, no-cache' });
	const rdb = getReadDb(platform);
	const db = getDb(platform);
	const hid = locals.householdId ?? locals.userId!;

	const account = await getDefaultAccount(rdb, hid);
	if (!account) return { transactions: [], categories: [], total: 0, page: 1, pageSize: PAGE_SIZE, categoryId: '', currentUserId: locals.userId, memberEmails: {} as Record<string, string>, memberNames: {} as Record<string, string>, memberAvatars: {} as Record<string, string> };

	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
	const categoryId = url.searchParams.get('category') ?? '';
	const offset = (page - 1) * PAGE_SIZE;

	const [transactions, categories, countRow, membersRes] = await Promise.all([
		listTransactions(rdb, {
			account_id: account.id,
			limit: PAGE_SIZE,
			offset,
			...(categoryId ? { category_id: categoryId } : {})
		}),
		listCategories(rdb, hid),
		rdb
			.prepare(
				categoryId
					? 'SELECT COUNT(*) AS n FROM transactions WHERE account_id = ? AND category_id = ? AND deleted_at IS NULL'
					: 'SELECT COUNT(*) AS n FROM transactions WHERE account_id = ? AND deleted_at IS NULL'
			)
			.bind(...(categoryId ? [account.id, categoryId] : [account.id]))
			.first<{ n: number }>(),
		// Fetch household member emails so attribution ("added by X") can be shown.
		rdb
			.prepare(
				`SELECT u.id, u.email, u.display_name, u.avatar FROM household_members hm
				 JOIN users u ON u.id = hm.user_id
				 WHERE hm.household_id = ?`
			)
			.bind(hid)
			.all<{ id: string; email: string; display_name: string | null; avatar: string | null }>()
	]);

	// Maps used client-side to show who added a shared entry (name + photo).
	const memberEmails: Record<string, string> = {};
	const memberNames: Record<string, string> = {};
	const memberAvatars: Record<string, string> = {};
	for (const m of membersRes.results ?? []) {
		memberEmails[m.id] = m.email;
		if (m.display_name) memberNames[m.id] = m.display_name;
		if (m.avatar) memberAvatars[m.id] = m.avatar;
	}

	return {
		transactions,
		categories,
		total: countRow?.n ?? 0,
		page,
		pageSize: PAGE_SIZE,
		categoryId,
		accountId: account.id,
		currentUserId: locals.userId,
		memberEmails,
		memberNames,
		memberAvatars
	};
};
