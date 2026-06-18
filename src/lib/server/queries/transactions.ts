import type { Transaction, NewTransaction } from '$lib/types';

/**
 * List transactions for an account, most recent first.
 * Scoped to the account_id (which is itself user-scoped).
 * Excludes soft-deleted rows.
 */
export async function listTransactions(
	db: D1Database,
	opts: {
		account_id: string;
		limit?: number;
		offset?: number;
		period_id?: string;
		category_id?: string;
	}
): Promise<Transaction[]> {
	// TODO(sonnet): build the WHERE clause from opts, run SELECT against D1,
	// return typed rows. Include category join for display if needed.
	throw new Error('Not implemented');
}

/**
 * Insert a new transaction.
 * category_id defaults to the user's Uncategorized system category if omitted.
 * period_id is always null on insert (assigned at harbour time).
 * Returns the newly created row.
 */
export async function insertTransaction(
	db: D1Database,
	tx: NewTransaction
): Promise<Transaction> {
	// TODO(sonnet): INSERT into transactions with generated id, entered_at = now,
	// period_id = NULL, is_uncategorized_fallback = 0. Return the inserted row.
	throw new Error('Not implemented');
}

/**
 * Soft-delete a transaction by id.
 * Verifies the transaction belongs to the given account_id before deleting.
 */
export async function softDeleteTransaction(
	db: D1Database,
	id: string,
	account_id: string
): Promise<void> {
	// TODO(sonnet): UPDATE transactions SET deleted_at = datetime('now')
	// WHERE id = ? AND account_id = ? AND deleted_at IS NULL
	throw new Error('Not implemented');
}
