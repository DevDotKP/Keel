import type { RecurringIncome, NewRecurringIncome } from '$lib/types';

export interface RecurringIncomeWithFrequency extends RecurringIncome {
	frequency: string;
	start_date: string;
	end_date: string | null;
	occurrence_limit: number | null;
	last_posted_at: string | null;
	next_due_at: string;
}

/** List a household's active (non-deleted) recurring income, newest first. */
export async function listRecurringIncome(
	db: D1Database,
	household_id: string
): Promise<RecurringIncomeWithFrequency[]> {
	const { results } = await db
		.prepare(
			`SELECT * FROM recurring_income
			 WHERE household_id = ? AND deleted_at IS NULL
			 ORDER BY created_at DESC`
		)
		.bind(household_id)
		.all<RecurringIncomeWithFrequency>();
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

/** Create recurring income with frequency scheduling. */
export async function createRecurringIncomeWithFrequency(
	db: D1Database,
	input: {
		household_id: string;
		user_id: string;
		name: string;
		amount_paise: number;
		category_id?: string | null;
		frequency: string; // 'daily' | 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly' | 'yearly'
		start_date?: string; // YYYY-MM-DD, defaults to today
		end_date?: string | null; // YYYY-MM-DD
		occurrence_limit?: number | null; // how many times to post
	}
): Promise<RecurringIncomeWithFrequency> {
	const startDate = input.start_date || new Date().toISOString().split('T')[0];
	const row = await db
		.prepare(
			`INSERT INTO recurring_income
			   (household_id, user_id, name, amount_paise, category_id, frequency, start_date, end_date, occurrence_limit, next_due_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 RETURNING *`
		)
		.bind(
			input.household_id,
			input.user_id,
			input.name,
			input.amount_paise,
			input.category_id ?? null,
			input.frequency,
			startDate,
			input.end_date ?? null,
			input.occurrence_limit ?? null,
			startDate // next_due_at starts at start_date
		)
		.first<RecurringIncomeWithFrequency>();
	if (!row) throw new Error('Failed to create recurring income with frequency');
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
