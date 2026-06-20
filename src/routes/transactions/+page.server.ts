import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb, getReadDb } from '$lib/server/db';
import { listTransactions } from '$lib/server/queries/transactions';
import { listCategories } from '$lib/server/queries/categories';
import type { Account } from '$lib/types';

const PAGE_SIZE = 30;

export const load: PageServerLoad = async ({ platform, locals, url, setHeaders }) => {
	if (!locals.userId) redirect(302, '/auth');
	setHeaders({ 'cache-control': 'private, max-age=0, stale-while-revalidate=10' });
	const db = getDb(platform);
	const rdb = getReadDb(platform);

	const account = await rdb
		.prepare('SELECT * FROM accounts WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1')
		.bind(locals.userId)
		.first<Account>();
	if (!account) return { transactions: [], categories: [], total: 0, page: 1, pageSize: PAGE_SIZE };

	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
	const categoryId = url.searchParams.get('category') ?? '';
	const offset = (page - 1) * PAGE_SIZE;

	const [transactions, categories, countRow] = await Promise.all([
		listTransactions(rdb, {
			account_id: account.id,
			limit: PAGE_SIZE,
			offset,
			...(categoryId ? { category_id: categoryId } : {})
		}),
		listCategories(rdb, locals.userId),
		rdb
			.prepare(
				categoryId
					? 'SELECT COUNT(*) AS n FROM transactions WHERE account_id = ? AND category_id = ? AND deleted_at IS NULL'
					: 'SELECT COUNT(*) AS n FROM transactions WHERE account_id = ? AND deleted_at IS NULL'
			)
			.bind(...(categoryId ? [account.id, categoryId] : [account.id]))
			.first<{ n: number }>()
	]);

	return {
		transactions,
		categories,
		total: countRow?.n ?? 0,
		page,
		pageSize: PAGE_SIZE,
		categoryId,
		accountId: account.id
	};
};
