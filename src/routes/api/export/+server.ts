import { error, text } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getDefaultAccount } from '$lib/server/queries/accounts';
import type { Transaction, Category } from '$lib/types';

interface ExportRow {
	date: string;
	category: string;
	description: string;
	amount_rs: string;
	type: string;
}

export const GET: RequestHandler = async ({ platform, locals, url }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const format = url.searchParams.get('format') ?? 'csv';

	// Get default account
	const account = await getDefaultAccount(db, locals.userId);
	if (!account) throw error(404, 'No account found');

	// Query transactions with category names
	const { results: transactions } = await db
		.prepare(
			`SELECT t.*, c.name as category_name
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.account_id = ? AND t.deleted_at IS NULL
       ORDER BY t.occurred_at DESC`
		)
		.bind(account.id)
		.all<Transaction & { category_name: string }>();

	const rows: ExportRow[] = (transactions ?? []).map((tx) => ({
		date: tx.occurred_at.slice(0, 10),
		category: tx.category_name || 'Uncategorized',
		description: tx.description,
		amount_rs: (Math.abs(tx.amount_paise) / 100).toFixed(2),
		type: tx.amount_paise >= 0 ? 'Income' : 'Expense'
	}));

	const timestamp = new Date().toISOString().slice(0, 10);

	if (format === 'json') {
		const json = {
			exported_at: new Date().toISOString(),
			account: account.name,
			transactions: rows
		};
		return new Response(JSON.stringify(json, null, 2), {
			headers: {
				'content-type': 'application/json',
				'content-disposition': `attachment; filename="keel-export-${timestamp}.json"`
			}
		});
	}

	// CSV format
	const csv = [
		['Date', 'Category', 'Description', 'Amount (₹)', 'Type'].join(','),
		...rows.map((row) =>
			[
				row.date,
				`"${row.category.replace(/"/g, '""')}"`,
				`"${row.description.replace(/"/g, '""')}"`,
				row.amount_rs,
				row.type
			].join(',')
		)
	].join('\n');

	return text(csv, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="keel-export-${timestamp}.csv"`
		}
	});
};
