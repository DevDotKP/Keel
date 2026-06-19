import type { Transaction, NewTransaction } from '$lib/types';

/**
 * List transactions for an account, most recent first.
 * Scoped to the account_id (which is itself user-scoped). Excludes soft-deleted rows.
 * Optional occurred_at window: from (inclusive) and to (exclusive).
 */
export async function listTransactions(
	db: D1Database,
	opts: {
		account_id: string;
		limit?: number;
		offset?: number;
		period_id?: string;
		category_id?: string;
		from?: string;
		to?: string;
	}
): Promise<Transaction[]> {
	const where = ['account_id = ?', 'deleted_at IS NULL'];
	const binds: unknown[] = [opts.account_id];
	if (opts.period_id) {
		where.push('period_id = ?');
		binds.push(opts.period_id);
	}
	if (opts.category_id) {
		where.push('category_id = ?');
		binds.push(opts.category_id);
	}
	if (opts.from) {
		where.push('occurred_at >= ?');
		binds.push(opts.from);
	}
	if (opts.to) {
		where.push('occurred_at < ?');
		binds.push(opts.to);
	}
	let sql = `SELECT * FROM transactions WHERE ${where.join(' AND ')} ORDER BY occurred_at DESC, entered_at DESC`;
	if (opts.limit != null) {
		sql += ' LIMIT ?';
		binds.push(opts.limit);
		if (opts.offset != null) {
			sql += ' OFFSET ?';
			binds.push(opts.offset);
		}
	}
	const { results } = await db
		.prepare(sql)
		.bind(...binds)
		.all<Transaction>();
	return results ?? [];
}

/**
 * Insert a new transaction. period_id is always null on insert (assigned at harbour).
 * Returns the newly created row.
 */
export async function insertTransaction(db: D1Database, tx: NewTransaction): Promise<Transaction> {
	const row = await db
		.prepare(
			`INSERT INTO transactions
			   (account_id, category_id, period_id, amount_paise, description, note, occurred_at, source, is_uncategorized_fallback)
			 VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 0)
			 RETURNING *`
		)
		.bind(
			tx.account_id,
			tx.category_id,
			tx.amount_paise,
			tx.description,
			tx.note ?? '',
			tx.occurred_at,
			tx.source
		)
		.first<Transaction>();
	if (!row) throw new Error('insertTransaction: insert returned no row');
	return row;
}

/**
 * Soft-delete a transaction by id. Verifies it belongs to account_id first.
 */
export async function softDeleteTransaction(
	db: D1Database,
	id: string,
	account_id: string
): Promise<void> {
	await db
		.prepare(
			"UPDATE transactions SET deleted_at = datetime('now') WHERE id = ? AND account_id = ? AND deleted_at IS NULL"
		)
		.bind(id, account_id)
		.run();
}
