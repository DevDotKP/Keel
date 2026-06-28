import type { ReconciliationPeriod, AccountSummary, HarbourCadence, RunwaySummary } from '$lib/types';

// ── Date helpers (local, not UTC, so period boundaries match the user's day) ───
// occurred_at is stored with IST offset (+05:30) so the date portion of the
// ISO string matches the user's calendar day. Period boundaries are YYYY-MM-DD
// strings; D1's lexicographic comparison is therefore exact for IST users.

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

export function computePeriod(
	cadence: HarbourCadence,
	harbourDay: string,
	now: Date
): { start: string; end: string } {
	if (cadence === 'monthly') {
		// Resolve the payday day-of-month for a given month from the anchor:
		//  'last_working_day' | 'first_working_day' | a specific day (1-31, clamped).
		// Working-day anchors skip Sat/Sun so the cycle lands on a real payday.
		const boundaryDom = (yy: number, mm: number): number | null => {
			const total = new Date(yy, mm + 1, 0).getDate();
			const isWeekend = (d: number) => {
				const w = new Date(yy, mm, d).getDay();
				return w === 0 || w === 6;
			};
			if (harbourDay === 'last_working_day') {
				let d = total;
				while (isWeekend(d)) d--;
				return d;
			}
			if (harbourDay === 'first_working_day') {
				let d = 1;
				while (isWeekend(d)) d++;
				return d;
			}
			const n = parseInt(harbourDay, 10);
			if (!isNaN(n) && n >= 1 && n <= 31) return Math.min(n, total);
			return null; // not a payday anchor → calendar month
		};

		const y = now.getFullYear();
		const m = now.getMonth();
		const today = now.getDate();
		const thisDom = boundaryDom(y, m);

		if (thisDom !== null) {
			// If today is before this month's payday, we're still in last month's period.
			const prev = today < thisDom;
			const startY = prev ? (m === 0 ? y - 1 : y) : y;
			const startM = prev ? (m === 0 ? 11 : m - 1) : m;
			const startDom = boundaryDom(startY, startM)!;
			const start = new Date(startY, startM, startDom);
			// End = day before the next month's payday.
			const nextY = startM === 11 ? startY + 1 : startY;
			const nextM = startM === 11 ? 0 : startM + 1;
			const end = new Date(nextY, nextM, boundaryDom(nextY, nextM)! - 1);
			return { start: ymdLocal(start), end: ymdLocal(end) };
		}

		// Default: calendar month (1st to last day).
		const start = new Date(now.getFullYear(), now.getMonth(), 1);
		const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
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
	cadence: HarbourCadence,
	harbourDay = 'sunday'
): Promise<ReconciliationPeriod> {
	const { start, end } = computePeriod(cadence, harbourDay, new Date());

	// One round trip: insert-if-absent (opening pulled from the account inline),
	// then read the row back. D1 batch runs these as a sequential transaction.
	const [, selectRes] = await db.batch<ReconciliationPeriod>([
		db
			.prepare(
				`INSERT OR IGNORE INTO reconciliation_periods
				   (account_id, period_start, period_end, cadence, opening_balance_paise)
				 VALUES (?, ?, ?, ?, (SELECT balance_paise FROM accounts WHERE id = ?))`
			)
			.bind(account_id, start, end, cadence, account_id),
		db
			.prepare('SELECT * FROM reconciliation_periods WHERE account_id = ? AND period_start = ?')
			.bind(account_id, start)
	]);

	const period = selectRes.results?.[0];
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
				"SELECT id FROM categories WHERE household_id = (SELECT household_id FROM accounts WHERE id = ?) AND name = 'Uncategorized' AND deleted_at IS NULL"
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
	cadence: HarbourCadence,
	rdbOrHarbourDay?: D1Database | string,
	rdb?: D1Database
): Promise<AccountSummary> {
	// Overloaded signature for backward compat:
	//   getAccountSummary(db, account_id, cadence, rdb?)            — legacy
	//   getAccountSummary(db, account_id, cadence, harbourDay, rdb?) — new
	let harbourDay = 'sunday';
	let readDbArg: D1Database | undefined;
	if (typeof rdbOrHarbourDay === 'string') {
		harbourDay = rdbOrHarbourDay;
		readDbArg = rdb;
	} else {
		readDbArg = rdbOrHarbourDay;
	}

	// Hot path: one read-only SELECT via the nearest replica. Cold path
	// (first load of a new cycle): INSERT on the primary then re-read from it.
	const readDb = readDbArg ?? db;
	const { start, end } = computePeriod(cadence, harbourDay, new Date());
	const to = nextDay(end);
	const days_remaining = daysUntil(end);

	type SummaryRow = ReconciliationPeriod & {
		income: number;
		expense: number;
		balance_paise: number;
		harbour_visits: number;
		open_periods: number;
		daily_reserve_paise: number;
		locked_obligations_paise: number;
	};

	// One read-only SELECT computes everything. Reads are far cheaper than the
	// write-commit latency D1 charges for a batch containing an INSERT. The period
	// row already exists on every load except the first of a new cycle, so we only
	// pay the write cost once per cycle (handled in the fallback below).
	const summarySql = `SELECT
		   rp.*,
		   (SELECT COALESCE(SUM(CASE WHEN amount_paise > 0 THEN amount_paise ELSE 0 END), 0)
		      FROM transactions
		      WHERE account_id = ?1 AND deleted_at IS NULL AND occurred_at >= ?2 AND occurred_at < ?3) AS income,
		   (SELECT COALESCE(SUM(CASE WHEN amount_paise < 0 THEN amount_paise ELSE 0 END), 0)
		      FROM transactions
		      WHERE account_id = ?1 AND deleted_at IS NULL AND occurred_at >= ?2 AND occurred_at < ?3) AS expense,
		   (SELECT balance_paise FROM accounts WHERE id = ?1) AS balance_paise,
		   (SELECT COUNT(*) FROM reconciliation_periods WHERE account_id = ?1 AND harboured_at IS NOT NULL) AS harbour_visits,
		   (SELECT COUNT(*) FROM reconciliation_periods WHERE account_id = ?1 AND harboured_at IS NULL) AS open_periods,
		   (SELECT COALESCE(SUM(daily_reserve_paise), 0) FROM categories
		      WHERE household_id = (SELECT household_id FROM accounts WHERE id = ?1) AND deleted_at IS NULL) AS daily_reserve_paise,
		   (SELECT COALESCE(SUM(o.amount_paise), 0) FROM obligations o
		      WHERE o.household_id = (SELECT household_id FROM accounts WHERE id = ?1) AND o.is_active = 1 AND o.deleted_at IS NULL
		        AND NOT EXISTS (SELECT 1 FROM obligation_settlements s WHERE s.obligation_id = o.id AND s.period_id = rp.id)) AS locked_obligations_paise
		 FROM reconciliation_periods rp
		 WHERE rp.account_id = ?1 AND rp.period_start = ?4`;

	// Bind order: ?1 account_id, ?2 window-from (period_start), ?3 window-to, ?4 period_start.
	// Read from replica on the hot path; primary on the cold write path for consistency.
	let row = await readDb.prepare(summarySql).bind(account_id, start, to, start).first<SummaryRow>();

	// First load of a new cycle: the period does not exist yet. Create it on primary, re-read.
	if (!row) {
		await db
			.prepare(
				`INSERT OR IGNORE INTO reconciliation_periods
				   (account_id, period_start, period_end, cadence, opening_balance_paise)
				 VALUES (?, ?, ?, ?, (SELECT balance_paise FROM accounts WHERE id = ?))`
			)
			.bind(account_id, start, end, cadence, account_id)
			.run();
		row = await db.prepare(summarySql).bind(account_id, start, to, start).first<SummaryRow>();
	}
	if (!row) throw new Error('getAccountSummary: period upsert returned no row');

	// Self-heal a stale boundary: if the open current period was created under a
	// different cadence or harbour day, its stored end is wrong (for example a
	// weekly Sunday left behind after switching to monthly). Re-point the open
	// period to the current boundary so a cadence change reflects immediately.
	if (row.harboured_at === null && (row.period_end !== end || row.cadence !== cadence)) {
		await db
			.prepare(
				'UPDATE reconciliation_periods SET period_end = ?, cadence = ? WHERE id = ? AND harboured_at IS NULL'
			)
			.bind(end, cadence, row.id)
			.run();
		row.period_end = end;
		row.cadence = cadence;
	}

	const period: ReconciliationPeriod = {
		id: row.id,
		account_id: row.account_id,
		period_start: row.period_start,
		period_end: row.period_end,
		cadence: row.cadence,
		opening_balance_paise: row.opening_balance_paise,
		closing_balance_paise: row.closing_balance_paise,
		harboured_at: row.harboured_at
	};

	const remaining = period.opening_balance_paise + row.income + row.expense;
	const balance_paise = row.balance_paise ?? 0;
	const harbour_visits = row.harbour_visits ?? 0;
	const open_periods = row.open_periods ?? 0;
	const daily_reserve_paise = row.daily_reserve_paise ?? 0;
	const locked_obligations_paise = row.locked_obligations_paise ?? 0;

	const locked_reserve_paise = daily_reserve_paise * days_remaining;
	const safe_to_spend_paise = remaining - locked_obligations_paise - locked_reserve_paise;

	return {
		balance_paise,
		remaining_paise: remaining,
		current_period: period,
		harbour_visits,
		open_periods,
		safe_to_spend_paise,
		locked_obligations_paise,
		locked_reserve_paise,
		daily_reserve_paise,
		days_remaining
	};
}

/**
 * Runway: how many days the current balance lasts at the trailing burn rate.
 * Two windows (30-day and 7-day) bound the estimate. A committed-only 30-day
 * figure powers the "cut discretionary: +X days" secondary line.
 */
export async function getRunway(db: D1Database, account_id: string): Promise<RunwaySummary> {
	type RunwayRow = {
		balance_paise: number;
		spend_30d: number;
		spend_7d: number;
		committed_spend_30d: number;
	};

	const row = await db
		.prepare(
			`SELECT
			   (SELECT balance_paise FROM accounts WHERE id = ?1) AS balance_paise,
			   (SELECT COALESCE(SUM(CASE WHEN t.amount_paise < 0 THEN ABS(t.amount_paise) ELSE 0 END), 0)
			      FROM transactions t
			      WHERE t.account_id = ?1 AND t.deleted_at IS NULL
			        AND t.occurred_at >= datetime('now', '-30 days')) AS spend_30d,
			   (SELECT COALESCE(SUM(CASE WHEN t.amount_paise < 0 THEN ABS(t.amount_paise) ELSE 0 END), 0)
			      FROM transactions t
			      WHERE t.account_id = ?1 AND t.deleted_at IS NULL
			        AND t.occurred_at >= datetime('now', '-7 days')) AS spend_7d,
			   (SELECT COALESCE(SUM(CASE WHEN t.amount_paise < 0 THEN ABS(t.amount_paise) ELSE 0 END), 0)
			      FROM transactions t
			      JOIN categories c ON c.id = t.category_id
			      WHERE t.account_id = ?1 AND t.deleted_at IS NULL
			        AND c.bucket = 'committed'
			        AND t.occurred_at >= datetime('now', '-30 days')) AS committed_spend_30d`
		)
		.bind(account_id)
		.first<RunwayRow>();

	const balance = row?.balance_paise ?? 0;
	const spend30 = row?.spend_30d ?? 0;
	const spend7 = row?.spend_7d ?? 0;
	const committed30 = row?.committed_spend_30d ?? 0;

	const daily30 = spend30 / 30;
	const daily7 = spend7 / 7;
	const dailyCommitted = committed30 / 30;

	const runway = (bal: number, daily: number): number | null => {
		if (daily <= 0) return null;
		return bal <= 0 ? 0 : Math.min(Math.floor(bal / daily), 9999);
	};

	return {
		balance_paise: balance,
		days_30: runway(balance, daily30),
		daily_burn_30_paise: Math.round(daily30),
		days_7: runway(balance, daily7),
		daily_burn_7_paise: Math.round(daily7),
		days_committed: runway(balance, dailyCommitted),
		daily_burn_committed_paise: Math.round(dailyCommitted),
		has_data: spend30 > 0 || spend7 > 0
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
