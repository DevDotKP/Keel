import type { RecurringIncome, NewRecurringIncome } from '$lib/types';

/** List a household's active (non-deleted) recurring income, newest first. */
export async function listRecurringIncome(
	db: D1Database,
	household_id: string
): Promise<RecurringIncome[]> {
	const { results } = await db
		.prepare(
			`SELECT * FROM recurring_income
			 WHERE household_id = ? AND deleted_at IS NULL
			 ORDER BY created_at DESC`
		)
		.bind(household_id)
		.all<RecurringIncome>();
	return results ?? [];
}

export async function createRecurringIncome(
	db: D1Database,
	input: NewRecurringIncome
): Promise<RecurringIncome> {
	// anchor_day only applies to a specific day-of-month anchor.
	const anchorDay = input.anchor_kind === 'day_of_month' ? (input.anchor_day ?? null) : null;
	const row = await db
		.prepare(
			`INSERT INTO recurring_income
			   (household_id, user_id, name, amount_paise, anchor_kind, anchor_day, category_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?)
			 RETURNING *`
		)
		.bind(
			input.household_id,
			input.user_id,
			input.name,
			input.amount_paise,
			input.anchor_kind,
			anchorDay,
			input.category_id ?? null
		)
		.first<RecurringIncome>();
	if (!row) throw new Error('Failed to create recurring income');
	return row;
}

export async function deleteRecurringIncome(
	db: D1Database,
	id: string,
	household_id: string
): Promise<void> {
	const res = await db
		.prepare(
			"UPDATE recurring_income SET deleted_at = datetime('now') WHERE id = ? AND household_id = ? AND deleted_at IS NULL"
		)
		.bind(id, household_id)
		.run();
	if (!res.meta.changes) throw new Error('Recurring income not found');
}
