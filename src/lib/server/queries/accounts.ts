import type { Account } from '$lib/types';

/** Return the user's default (first, non-deleted) account, or null. */
export async function getDefaultAccount(db: D1Database, user_id: string): Promise<Account | null> {
	return await db
		.prepare(
			'SELECT * FROM accounts WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1'
		)
		.bind(user_id)
		.first<Account>();
}
