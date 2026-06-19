import type { ReconciliationPeriod, AccountSummary, HarbourCadence } from '$lib/types';

// ── Date helpers (local, not UTC, so period boundaries match the user's day) ───
// Note: occurred_at is stored as a UTC ISO datetime; near-midnight entries can
// land in an adjacent period by the tz offset. Acceptable for now.
// TODO(sonnet): store/compare occurred_at in the user's local day for exactness.

function ymdLocal(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function mondayOf(date: Date): Date {
	const d = new Date(date);
	const day = d.getDay(); // 0 = Sun
	const diff = day === 0 ? -6 : 1 - day;
	d.setDate(d.getDate() + diff);
	d.setHours(0, 0, 0, 0);
	return d;
}

/** Day after the given 'YYYY-MM-DD', as 'YYYY-MM-DD'. Used as an exclusive upper bound. */
export function nextDay(ymd: string): string {
	const d = new Date(`${ymd}T00:00:00`);
	d.setDate(d.getDate() + 1);
	return ymdLocal(d);
}

function computePeriod(cadence: HarbourCadence, now: Date): { start: string; end: string } {
	if (cadence === 'monthly') {
		const start = new Date(now.getFullYear(), now.getMonth(), 1);
		const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of month
		return { start: ymdLocal(start), end: ymdLocal(end) };
	}
	const blockDays = cadence === 'fortnightly' ? 14 : 7;
	const monday = mondayOf(now);
	if (cadence === 'fortnightly') {
		// Anchor fortnights to a fixed Monday epoch so the blocks are stable week to week.
		const epoch = new Date(2024, 0, 1); // Mon 2024-01-01 (local)
		const weeks = Math.floor((monday.getTime() - epoch.getTime()) / (7 * 86400000));
		if (weeks % 2 === 1) monday.setDate(monday.getDate() - 7);
	}
	const end = new Date(monday);
	end.setDate(end.getDate() + blockDays - 1);
	return { start: ymdLocal(monday), end: ymdLocal(end) };
}

/**
 * Return the current open period for an account, creating it if it doesn't exist.
 * The opening_balance_paise of a new period equals the account's current balance.
 */
export async function getOrCreateCurrentPeriod(
	db: D1Database,
	account_id: string,
	cadence: HarbourCadence
): Promise<ReconciliationPeriod> {
	const { start, end } = computePeriod(cadence, new Date());
	const account = await db
		.prepare('SELECT balance_paise FROM accounts WHERE id = ?')
		.bind(account_id)
		.first<{ balance_paise: number }>();
	const opening = account?.balance_paise ?? 0;

	await db
		.prepare(
			`INSERT OR IGNORE INTO reconciliation_periods
			   (account_id, period_start, period_end, cadence, opening_balance_paise)
			 VALUES (?, ?, ?, ?, ?)`
		)
		.bind(account_id, start, end, cadence, opening)
		.run();

	const period = await db
		.prepare('SELECT * FROM reconciliation_periods WHERE account_id = ? AND period_start = ?')
		.bind(account_id, start)
		.first<ReconciliationPeriod>();
	if (!period) throw new Error('getOrCreateCurrentPeriod: upsert returned no row');
	return period;
}

/**
 * Harbour (close) a period.
 *
 * Miss-tolerant by design: existing categories are preserved. The gap between
 * Keel's estimate and the user's real balance (the drift) is recorded as a single
 * Uncategorized adjustment so the total reconciles without hunting individual
 * missed entries. The period seals at the real balance, and the account balance
 * is set to it.
 */
export async function harbourPeriod(
	db: D1Database,
	period_id: string,
	account_id: string,
	closing_balance_paise: number,
	opts: { freshStart?: boolean } = {}
): Promise<void> {
	const period = await db
		.prepare('SELECT * FROM reconciliation_periods WHERE id = ? AND account_id = ?')
		.bind(period_id, account_id)
		.first<ReconciliationPeriod>();
	if (!period) throw new Error('harbourPeriod: period not found');
	if (period.harboured_at) throw new Error('harbourPeriod: period already harboured');

	const endExclusive = nextDay(period.period_end);

	// 1. Assign all unassigned in-window transactions to this period. Keep their categories.
	await db
		.prepare(
			`UPDATE transactions SET period_id = ?
			 WHERE account_id = ? AND period_id IS NULL AND deleted_at IS NULL
			   AND occurred_at >= ? AND occurred_at < ?`
		)
		.bind(period_id, account_id, period.period_start, endExclusive)
		.run();

	// 2. Keel's estimate = opening balance + net of this period's transactions.
	const sum = await db
		.prepare('SELECT COALESCE(SUM(amount_paise), 0) AS net FROM transactions WHERE period_id = ? AND deleted_at IS NULL')
		.bind(period_id)
		.first<{ net: number }>();
	const estimate = period.opening_balance_paise + (sum?.net ?? 0);
	const drift = closing_balance_paise - estimate;

	const writes: D1PreparedStatement[] = [];

	// 3. Record the drift as a single Uncategorized adjustment (never corrupts the rest).
	if (drift !== 0) {
		const uncat = await db
			.prepare(
				"SELECT id FROM categories WHERE user_id = (SELECT user_id FROM accounts WHERE id = ?) AND name = 'Uncategorized' AND deleted_at IS NULL"
			)
			.bind(account_id)
			.first<{ id: string }>();
		if (!uncat) throw new Error('harbourPeriod: Uncategorized category missing');
		writes.push(
			db
				.prepare(
					`INSERT INTO transactions
					   (account_id, category_id, period_id, amount_paise, description, occurred_at, source, is_uncategorized_fallback)
					 VALUES (?, ?, ?, ?, 'Harbour adjustment', ?, 'tap', 1)`
				)
				.bind(account_id, uncat.id, period_id, drift, `${period.period_end}T23:59:59.000Z`)
		);
	}

	// 4. Amnesty: seal all older open periods in one action.
	if (opts.freshStart) {
		writes.push(
			db
				.prepare(
					`UPDATE reconciliation_periods
					 SET closing_balance_paise = opening_balance_paise, harboured_at = datetime('now')
					 WHERE account_id = ? AND harboured_at IS NULL AND period_start < ?`
				)
				.bind(account_id, period.period_start)
		);
	}

	// 5. Seal this period. 6. Update the account balance to the real one.
	writes.push(
		db
			.prepare(
				"UPDATE reconciliation_periods SET closing_balance_paise = ?, harboured_at = datetime('now') WHERE id = ?"
			)
			.bind(closing_balance_paise, period_id)
	);
	writes.push(
		db
			.prepare("UPDATE accounts SET balance_paise = ?, updated_at = datetime('now') WHERE id = ?")
			.bind(closing_balance_paise, account_id)
	);

	await db.batch(writes);
}

/**
 * Account summary: remaining for the current period, plus harbour visit counts.
 * remaining = opening_balance + income - expenses, over the current period window.
 */
export async function getAccountSummary(
	db: D1Database,
	account_id: string,
	cadence: HarbourCadence
): Promise<AccountSummary> {
	const period = await getOrCreateCurrentPeriod(db, account_id, cadence);

	// amount_paise is signed (expense negative, income positive), so the net sum
	// added to opening gives remaining directly.
	const agg = await db
		.prepare(
			`SELECT
			   COALESCE(SUM(CASE WHEN amount_paise > 0 THEN amount_paise ELSE 0 END), 0) AS income,
			   COALESCE(SUM(CASE WHEN amount_paise < 0 THEN amount_paise ELSE 0 END), 0) AS expense
			 FROM transactions
			 WHERE account_id = ? AND deleted_at IS NULL
			   AND occurred_at >= ? AND occurred_at < ?`
		)
		.bind(account_id, period.period_start, nextDay(period.period_end))
		.first<{ income: number; expense: number }>();

	const income = agg?.income ?? 0;
	const expense = agg?.expense ?? 0; // negative or zero
	const remaining = period.opening_balance_paise + income + expense;

	const account = await db
		.prepare('SELECT user_id, balance_paise FROM accounts WHERE id = ?')
		.bind(account_id)
		.first<{ user_id: string; balance_paise: number }>();
	const userId = account?.user_id ?? '';

	const visits = await db
		.prepare(
			'SELECT COUNT(*) AS c FROM reconciliation_periods WHERE account_id = ? AND harboured_at IS NOT NULL'
		)
		.bind(account_id)
		.first<{ c: number }>();

	const open = await db
		.prepare(
			'SELECT COUNT(*) AS c FROM reconciliation_periods WHERE account_id = ? AND harboured_at IS NULL'
		)
		.bind(account_id)
		.first<{ c: number }>();

	// ── Control view ────────────────────────────────────────────────────────
	// Days left in the period, today excluded (period_end - today, floored at 0).
	const days_remaining = daysUntil(period.period_end);

	// Total daily reserve across the user's categories (e.g. Food Rs 120/day).
	const reserveAgg = await db
		.prepare(
			'SELECT COALESCE(SUM(daily_reserve_paise), 0) AS r FROM categories WHERE user_id = ? AND deleted_at IS NULL'
		)
		.bind(userId)
		.first<{ r: number }>();
	const daily_reserve_paise = reserveAgg?.r ?? 0;
	const locked_reserve_paise = daily_reserve_paise * days_remaining;

	// Unpaid obligations: active, not yet settled for this period.
	const oblAgg = await db
		.prepare(
			`SELECT COALESCE(SUM(o.amount_paise), 0) AS due
			 FROM obligations o
			 WHERE o.user_id = ? AND o.is_active = 1 AND o.deleted_at IS NULL
			   AND NOT EXISTS (
			     SELECT 1 FROM obligation_settlements s
			     WHERE s.obligation_id = o.id AND s.period_id = ?
			   )`
		)
		.bind(userId, period.id)
		.first<{ due: number }>();
	const locked_obligations_paise = oblAgg?.due ?? 0;

	const safe_to_spend_paise = remaining - locked_obligations_paise - locked_reserve_paise;

	return {
		balance_paise: account?.balance_paise ?? 0,
		remaining_paise: remaining,
		current_period: period,
		harbour_visits: visits?.c ?? 0,
		open_periods: open?.c ?? 0,
		safe_to_spend_paise,
		locked_obligations_paise,
		locked_reserve_paise,
		daily_reserve_paise,
		days_remaining
	};
}

/** Whole days from today (midnight) to an ISO date 'YYYY-MM-DD', floored at 0. */
function daysUntil(isoDate: string): number {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const end = new Date(`${isoDate}T00:00:00`);
	const diff = Math.round((end.getTime() - today.getTime()) / 86_400_000);
	return Math.max(0, diff);
}
