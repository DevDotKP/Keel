import type { Account } from '$lib/types';

/** Return the household's default (first, non-deleted) account, or null. */
export async function getDefaultAccount(db: D1Database, household_id: string): Promise<Account | null> {
	return await db
		.prepare(
			'SELECT * FROM accounts WHERE household_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1'
		)
		.bind(household_id)
		.first<Account>();
}
