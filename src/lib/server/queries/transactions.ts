import type { Transaction, NewTransaction } from '$lib/types';

export interface TransactionFilterOpts {
	account_id: string;
	period_id?: string;
	category_id?: string;
	from?: string;
	to?: string;
	q?: string;
}

/**
 * Shared WHERE builder so the list and its COUNT always agree.
 * q matches description/note (substring) and, when it parses as an amount in
 * rupees, the exact absolute amount.
 */
export function transactionFilters(opts: TransactionFilterOpts): {
	where: string[];
	binds: unknown[];
} {
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
	if (opts.q) {
		const like = `%${opts.q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
		const rupees = parseFloat(opts.q.replace(/[₹,\s]/g, ''));
		const paise = Number.isFinite(rupees) && rupees > 0 ? Math.round(rupees * 100) : null;
		if (paise !== null) {
			where.push(
				"(description LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\' OR ABS(amount_paise) = ?)"
			);
			binds.push(like, like, paise);
		} else {
			where.push("(description LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\')");
			binds.push(like, like);
		}
	}
	return { where, binds };
}

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
		q?: string;
	}
): Promise<Transaction[]> {
	const { where, binds } = transactionFilters(opts);
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

/** Count transactions under the same filters listTransactions uses. */
export async function countTransactions(
	db: D1Database,
	opts: TransactionFilterOpts
): Promise<number> {
	const { where, binds } = transactionFilters(opts);
	const row = await db
		.prepare(`SELECT COUNT(*) AS n FROM transactions WHERE ${where.join(' AND ')}`)
		.bind(...binds)
		.first<{ n: number }>();
	return row?.n ?? 0;
}

/**
 * Insert a new transaction. period_id is always null on insert (assigned at harbour).
 * Returns the newly created row.
 */
export async function insertTransaction(db: D1Database, tx: NewTransaction): Promise<Transaction> {
	const row = await db
		.prepare(
			`INSERT INTO transactions
			   (account_id, category_id, period_id, amount_paise, description, note, occurred_at, source, entered_by, is_uncategorized_fallback)
			 VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 0)
			 RETURNING *`
		)
		.bind(
			tx.account_id,
			tx.category_id,
			tx.amount_paise,
			tx.description,
			tx.note ?? '',
			tx.occurred_at,
			tx.source,
			tx.entered_by ?? null
		)
		.first<Transaction>();
	if (!row) throw new Error('insertTransaction: insert returned no row');
	return row;
}

/**
 * Update editable fields on a transaction. Verifies it belongs to account_id.
 * amount_paise must already have the correct sign (negative = expense, positive = income).
 */
export async function updateTransaction(
	db: D1Database,
	id: string,
	account_id: string,
	fields: {
		amount_paise: number;
		category_id: string;
		description: string;
		note: string;
		occurred_at: string;
	}
): Promise<void> {
	await db
		.prepare(
			`UPDATE transactions
			 SET amount_paise = ?, category_id = ?, description = ?, note = ?, occurred_at = ?,
			     is_uncategorized_fallback = 0, updated_at = datetime('now')
			 WHERE id = ? AND account_id = ? AND deleted_at IS NULL`
		)
		.bind(
			fields.amount_paise,
			fields.category_id,
			fields.description,
			fields.note,
			fields.occurred_at,
			id,
			account_id
		)
		.run();
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
