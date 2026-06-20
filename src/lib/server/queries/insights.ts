import type { HarbourCadence } from '$lib/types';
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
	period_start: string;
	period_end: string;
	total_expense_paise: number;
	uncategorized_paise: number;
	harboured_at: string;
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
	cycle_budget_paise: number;
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
			.prepare('SELECT cycle_budget_paise FROM settings WHERE user_id = ?')
			.bind(user_id),

		// Last 3 completed periods with expense and uncategorized totals.
		db
			.prepare(
				`SELECT rp.period_start, rp.period_end, rp.harboured_at,
				        COALESCE(SUM(CASE WHEN t.amount_paise < 0 THEN -t.amount_paise ELSE 0 END), 0) AS total_expense_paise,
				        COALESCE(SUM(CASE WHEN t.amount_paise < 0
				          AND (t.is_uncategorized_fallback = 1 OR c.name = 'Uncategorized')
				          THEN -t.amount_paise ELSE 0 END), 0) AS uncategorized_paise
				 FROM reconciliation_periods rp
				 LEFT JOIN transactions t ON t.period_id = rp.id AND t.deleted_at IS NULL
				 LEFT JOIN categories c ON c.id = t.category_id
				 WHERE rp.account_id = ? AND rp.harboured_at IS NOT NULL
				 GROUP BY rp.id
				 ORDER BY rp.period_start DESC
				 LIMIT 3`
			)
			.bind(account_id)
	]);

	const by_category = (catRes.results ?? []) as InsightCategoryRow[];
	const cycle_budget_paise =
		(settingsRes.results?.[0] as { cycle_budget_paise: number } | undefined)
			?.cycle_budget_paise ?? 0;
	const recent_periods = (historyRes.results ?? []) as InsightPeriodRow[];

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
		cycle_budget_paise
	};
}
