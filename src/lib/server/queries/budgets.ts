import type { BudgetOverview, CategoryBudget, HarbourCadence } from '$lib/types';
import { getOrCreateCurrentPeriod, nextDay } from './periods';

/**
 * Spend-by-category for the current cycle, with each category's optional budget.
 * Expenses only. Includes any expense category that has spend or a budget set.
 * Powers the Insights view and the soft-cap progress bars.
 */
export async function getBudgetOverview(
	db: D1Database,
	account_id: string,
	user_id: string,
	cadence: HarbourCadence
): Promise<BudgetOverview> {
	const period = await getOrCreateCurrentPeriod(db, account_id, cadence);
	const from = period.period_start;
	const to = nextDay(period.period_end);

	// Spend-by-category and the overall target in a single round trip.
	const [catRes, settingsRes] = await db.batch([
		db
			.prepare(
				`SELECT c.id AS category_id, c.name, c.color, c.budget_paise,
				        COALESCE(SUM(CASE WHEN t.amount_paise < 0 THEN -t.amount_paise ELSE 0 END), 0) AS spent_paise
				 FROM categories c
				 LEFT JOIN transactions t
				   ON t.category_id = c.id AND t.account_id = ? AND t.deleted_at IS NULL
				   AND t.occurred_at >= ? AND t.occurred_at < ?
				 WHERE c.user_id = ? AND c.deleted_at IS NULL AND c.kind = 'expense'
				 GROUP BY c.id
				 HAVING spent_paise > 0 OR c.budget_paise > 0
				 ORDER BY spent_paise DESC, c.name ASC`
			)
			.bind(account_id, from, to, user_id),
		db.prepare('SELECT cycle_budget_paise FROM settings WHERE user_id = ?').bind(user_id)
	]);

	const by_category = (catRes.results ?? []) as CategoryBudget[];
	const total_spent_paise = by_category.reduce((sum, c) => sum + c.spent_paise, 0);
	const cycle_budget_paise =
		(settingsRes.results?.[0] as { cycle_budget_paise: number } | undefined)?.cycle_budget_paise ?? 0;

	return { by_category, total_spent_paise, cycle_budget_paise, period };
}
