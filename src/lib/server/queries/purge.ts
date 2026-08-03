// Hard-delete users and everything that references them, in foreign-key
// dependency order. D1 enforces foreign keys, so a `DELETE FROM users` that
// leaves any child row behind fails the whole batch — which is how the
// never-verified sweep silently broke the hourly cron for weeks.
//
// Callers pass a WHERE clause selecting the users to purge. It is always
// code-supplied SQL, never user input (same convention as rate-limit.ts).
// Statements are returned rather than run so the caller can add its own to a
// single batch and keep the purge atomic.
//
// Ownership rule: ledger rows belong to a HOUSEHOLD, not to whoever created
// them. user_id on categories/obligations/holdings is the author, so purging by
// it would delete rows out of a shared ledger that outlives this user. Scope on
// household_id (which equals the user id for personal households, per the
// migration convention), and fall back to user_id only for legacy rows written
// before migration 0009 that never got a household_id.
//
// Caller contract: only pass users who are isolated — they created no household
// other than their personal one, and no surviving row points at them (e.g.
// transactions.entered_by in someone else's ledger). A user still referenced by
// a ledger that outlives them must be anonymised instead of deleted; that is
// what /api/auth/delete does.

export function purgeUsersWhere(db: D1Database, userWhere: string): D1PreparedStatement[] {
	const U = `(SELECT id FROM users WHERE ${userWhere})`;
	// Their household's rows, plus their own pre-0009 rows that have no household.
	const OWNED = (t: string) =>
		`(${t}.household_id IN ${U} OR (${t}.household_id IS NULL AND ${t}.user_id IN ${U}))`;
	const ACC = `(SELECT id FROM accounts WHERE ${OWNED('accounts')})`;
	const DOOMED_CATS = `(SELECT id FROM categories WHERE ${OWNED('categories')})`;

	return [
		// obligation_settlements points at obligations, reconciliation_periods AND
		// transactions, so it must go before all three. Deleting transactions first
		// trips a foreign key for anyone who has ever settled an obligation.
		db.prepare(
			`DELETE FROM obligation_settlements
			 WHERE obligation_id IN (SELECT id FROM obligations WHERE ${OWNED('obligations')})
			    OR transaction_id IN (SELECT id FROM transactions WHERE account_id IN ${ACC})
			    OR period_id IN (SELECT id FROM reconciliation_periods WHERE account_id IN ${ACC})`
		),
		db.prepare(`DELETE FROM obligations WHERE ${OWNED('obligations')}`),
		db.prepare(`DELETE FROM transactions WHERE account_id IN ${ACC}`),
		db.prepare(`DELETE FROM reconciliation_periods WHERE account_id IN ${ACC}`),
		db.prepare(`DELETE FROM holdings WHERE ${OWNED('holdings')}`),
		db.prepare(`DELETE FROM portfolio_snapshots WHERE household_id IN ${U}`),
		db.prepare(`DELETE FROM recurring_income WHERE ${OWNED('recurring_income')}`),
		db.prepare(`DELETE FROM recurring_expenses WHERE ${OWNED('recurring_expenses')}`),
		db.prepare(`DELETE FROM voice_samples WHERE user_id IN ${U}`),
		db.prepare(`DELETE FROM app_events WHERE user_id IN ${U}`),
		db.prepare(`DELETE FROM push_subscriptions WHERE user_id IN ${U}`),
		// categories.parent_id points at categories, and SQLite checks foreign keys
		// row by row, so a subcategory outlives its parent mid-statement and trips
		// the constraint. Break the links first, then the delete is order-free.
		db.prepare(`UPDATE categories SET parent_id = NULL WHERE parent_id IN ${DOOMED_CATS}`),
		db.prepare(`DELETE FROM categories WHERE ${OWNED('categories')}`),
		db.prepare(`DELETE FROM accounts WHERE ${OWNED('accounts')}`),
		db.prepare(`DELETE FROM magic_link_tokens WHERE user_id IN ${U}`),
		db.prepare(`DELETE FROM sessions WHERE user_id IN ${U}`),
		db.prepare(`DELETE FROM entitlements WHERE user_id IN ${U}`),
		db.prepare(`DELETE FROM settings WHERE user_id IN ${U}`),
		db.prepare(`DELETE FROM household_invites WHERE household_id IN ${U} OR invited_by IN ${U}`),
		db.prepare(`DELETE FROM household_members WHERE household_id IN ${U} OR user_id IN ${U}`),
		// Personal household only (id = user id). Per the caller contract there is
		// no other household created by these users, so no created_by FK is left
		// dangling.
		db.prepare(`DELETE FROM households WHERE id IN ${U}`),
		db.prepare(`DELETE FROM users WHERE id IN ${U}`)
	];
}
