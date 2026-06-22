import type { HarbourCadence, BudgetRollover } from '$lib/types';
import { getOrCreateCurrentPeriod, nextDay } from './periods';

export interface InsightCategoryRow {
	category_id: string;
	name: string;
	color: string;
	bucket: 'committed' | 'flexible';
	is_system: 0 | 1;
	spent_paise: number;
	budget_paise: number;
}

export interface InsightPeriodRow {
	id: string;
	period_start: string;
	period_end: string;
	total_expense_paise: number;
	uncategorized_paise: number;
	harboured_at: string;
	/** Harbour adjustment amount (abs paise). Zero = perfect tracking for this period. */
	drift_paise: number;
}

export interface InsightsData {
	period_start: string;
	period_end: string;
	/** Expense total from committed-bucket categories this period. */
	committed_paise: number;
	/** Expense total from flexible-bucket categories (excl. Uncategorized) this period. */
	flexible_paise: number;
	/** Expense total of uncategorized transactions this period. */
	uncategorized_paise: number;
	total_expense_paise: number;
	by_category: InsightCategoryRow[];
	/** Last 3 completed (harboured) periods, newest first. */
	recent_periods: InsightPeriodRow[];
	/** Effective target for this cycle: base + rollover carry, clamped to >= 0. */
	cycle_budget_paise: number;
	/** The stored base target the user edits (before any rollover carry). */
	base_budget_paise: number;
	/** Signed carry applied to the base this cycle: positive added, negative removed. */
	carryover_paise: number;
	/** How the target carries between cycles. */
	budget_rollover: BudgetRollover;
	/** Previous completed period's spend per category, for change-vs-last-period. */
	prev_by_category: PrevCategorySpend[];
}

export interface PrevCategorySpend {
	category_id: string;
	name: string;
	color: string;
	spent_paise: number;
}

/**
 * Everything the Insights page needs in two batched D1 round trips:
 * 1. Category-level spend for the current period + settings.
 * 2. Last 3 harboured periods with uncategorized breakdown.
 */
export async function getInsightsData(
	db: D1Database,
	account_id: string,
	user_id: string,
	cadence: HarbourCadence,
	harbourDay: string,
	rdb?: D1Database
): Promise<InsightsData> {
	const readDb = rdb ?? db;
	const period = await getOrCreateCurrentPeriod(db, account_id, cadence, harbourDay);
	const from = period.period_start;
	const to = nextDay(period.period_end);

	const [catRes, settingsRes, historyRes] = await readDb.batch([
		// Current-period spend per expense category, with bucket and budget.
		db
			.prepare(
				`SELECT c.id AS category_id, c.name, c.color, c.bucket, c.is_system, c.budget_paise,
				        COALESCE(SUM(CASE WHEN t.amount_paise < 0 THEN -t.amount_paise ELSE 0 END), 0) AS spent_paise
				 FROM categories c
				 LEFT JOIN transactions t
				   ON t.category_id = c.id AND t.account_id = ?1 AND t.deleted_at IS NULL
				   AND t.occurred_at >= ?2 AND t.occurred_at < ?3
				 WHERE c.user_id = ?4 AND c.deleted_at IS NULL AND c.kind = 'expense'
				 GROUP BY c.id
				 HAVING spent_paise > 0 OR c.budget_paise > 0
				 ORDER BY spent_paise DESC, c.name ASC`
			)
			.bind(account_id, from, to, user_id),

		db
			.prepare('SELECT cycle_budget_paise, budget_rollover FROM settings WHERE user_id = ?')
			.bind(user_id),

		// Last 5 completed periods with expense, uncategorized, and drift totals.
		// drift_paise: the harbour adjustment amount (the gap between Keel's estimate
		// and the actual balance typed by the user). Zero means perfect tracking.
		db
			.prepare(
				`SELECT rp.id, rp.period_start, rp.period_end, rp.harboured_at,
				        COALESCE(SUM(CASE WHEN t.amount_paise < 0 THEN -t.amount_paise ELSE 0 END), 0) AS total_expense_paise,
				        COALESCE(SUM(CASE WHEN t.amount_paise < 0
				          AND (t.is_uncategorized_fallback = 1 OR c.name = 'Uncategorized')
				          THEN -t.amount_paise ELSE 0 END), 0) AS uncategorized_paise,
				        COALESCE(ABS(SUM(CASE WHEN t.is_uncategorized_fallback = 1
				          AND t.description = 'Harbour adjustment'
				          THEN t.amount_paise ELSE 0 END)), 0) AS drift_paise
				 FROM reconciliation_periods rp
				 LEFT JOIN transactions t ON t.period_id = rp.id AND t.deleted_at IS NULL
				 LEFT JOIN categories c ON c.id = t.category_id
				 WHERE rp.account_id = ? AND rp.harboured_at IS NOT NULL
				 GROUP BY rp.id
				 ORDER BY rp.period_start DESC
				 LIMIT 5`
			)
			.bind(account_id)
	]);

	const by_category = (catRes.results ?? []) as InsightCategoryRow[];
	const settingsRow = settingsRes.results?.[0] as
		| { cycle_budget_paise: number; budget_rollover: BudgetRollover }
		| undefined;
	const base_budget_paise = settingsRow?.cycle_budget_paise ?? 0;
	const budget_rollover: BudgetRollover = settingsRow?.budget_rollover ?? 'fresh';
	const recent_periods = (historyRes.results ?? []) as InsightPeriodRow[];

	// Rollover carries into the *target* only (never safe-to-spend). We compare the
	// previous completed period's spend against the base target. Budget rarely
	// changes, so the current base stands in for the previous period's base.
	let carryover_paise = 0;
	if (base_budget_paise > 0 && budget_rollover !== 'fresh' && recent_periods.length > 0) {
		const delta = base_budget_paise - recent_periods[0].total_expense_paise; // + surplus, - overspend
		if (budget_rollover === 'surplus') carryover_paise = Math.max(0, delta);
		else if (budget_rollover === 'deficit') carryover_paise = Math.min(0, delta);
	}
	const cycle_budget_paise = Math.max(0, base_budget_paise + carryover_paise);

	// Previous completed period's spend per category, for "change vs last period".
	const prevPeriodId = recent_periods[0]?.id;
	let prev_by_category: PrevCategorySpend[] = [];
	if (prevPeriodId) {
		const prevRes = await readDb
			.prepare(
				`SELECT c.id AS category_id, c.name, c.color,
				        COALESCE(SUM(CASE WHEN t.amount_paise < 0 THEN -t.amount_paise ELSE 0 END), 0) AS spent_paise
				 FROM categories c
				 LEFT JOIN transactions t
				   ON t.category_id = c.id AND t.period_id = ? AND t.deleted_at IS NULL
				 WHERE c.user_id = ? AND c.deleted_at IS NULL AND c.kind = 'expense'
				 GROUP BY c.id
				 HAVING spent_paise > 0`
			)
			.bind(prevPeriodId, user_id)
			.all<PrevCategorySpend>();
		prev_by_category = (prevRes.results ?? []) as PrevCategorySpend[];
	}

	let committed_paise = 0;
	let flexible_paise = 0;
	let uncategorized_paise = 0;

	for (const c of by_category) {
		if (c.is_system && c.name === 'Uncategorized') {
			uncategorized_paise += c.spent_paise;
		} else if (c.bucket === 'committed') {
			committed_paise += c.spent_paise;
		} else {
			flexible_paise += c.spent_paise;
		}
	}

	return {
		period_start: period.period_start,
		period_end: period.period_end,
		committed_paise,
		flexible_paise,
		uncategorized_paise,
		total_expense_paise: committed_paise + flexible_paise + uncategorized_paise,
		by_category,
		recent_periods,
		cycle_budget_paise,
		base_budget_paise,
		carryover_paise,
		budget_rollover,
		prev_by_category
	};
}
