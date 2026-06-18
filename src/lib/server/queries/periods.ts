import type { ReconciliationPeriod, AccountSummary } from '$lib/types';
import type { HarbourCadence } from '$lib/types';

/**
 * Return the current open period for an account, creating it if it doesn't exist.
 * "Current" is determined by the account's settings.harbour_cadence and today's date.
 * The opening_balance_paise of a new period equals the account's current balance_paise.
 */
export async function getOrCreateCurrentPeriod(
	db: D1Database,
	account_id: string,
	cadence: HarbourCadence
): Promise<ReconciliationPeriod> {
	// TODO(sonnet): compute period_start and period_end from cadence and today,
	// then INSERT OR IGNORE into reconciliation_periods and SELECT the row back.
	throw new Error('Not implemented');
}

/**
 * Harbour (close) a period.
 *
 * Contract (implement all steps atomically in a D1 transaction):
 * 1. Find all transactions WHERE account_id = account_id AND period_id IS NULL
 *    AND deleted_at IS NULL AND occurred_at >= period.period_start
 *    AND occurred_at < period.period_end + 1 day.
 * 2. UPDATE those transactions: set period_id = period.id,
 *    category_id = <user's Uncategorized system category id>,
 *    is_uncategorized_fallback = 1.
 * 3. UPDATE reconciliation_periods SET closing_balance_paise = closingBalance,
 *    harboured_at = datetime('now') WHERE id = period.id.
 * 4. UPDATE accounts SET balance_paise = closingBalance,
 *    updated_at = datetime('now') WHERE id = account_id.
 *
 * Fresh-start path: if opts.freshStart = true, also seal all open periods
 * older than the one being harboured (set closing_balance_paise = opening_balance_paise,
 * harboured_at = datetime('now'), leave their transactions unassigned).
 * Multi-period catch-up: callers may call harbourPeriod once per open period;
 * the fresh-start path collapses all of them into one user action.
 */
export async function harbourPeriod(
	db: D1Database,
	period_id: string,
	account_id: string,
	closing_balance_paise: number,
	opts: { freshStart?: boolean } = {}
): Promise<void> {
	// TODO(sonnet): implement the full atomic contract above.
	// Use D1 batch() to run all UPDATEs in one round-trip.
	// Respect opts.freshStart for the amnesty path.
	throw new Error('Not implemented');
}

/**
 * Return an account summary including remaining balance for the current period
 * and the total count of harboured periods (never resets).
 */
export async function getAccountSummary(
	db: D1Database,
	account_id: string,
	cadence: HarbourCadence
): Promise<AccountSummary> {
	// TODO(sonnet): run getOrCreateCurrentPeriod, aggregate expense/income
	// for the period, compute remaining = opening + income - abs(expense),
	// count harboured_at IS NOT NULL periods for harbour_visits.
	throw new Error('Not implemented');
}
