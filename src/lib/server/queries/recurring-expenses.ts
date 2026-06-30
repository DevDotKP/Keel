import type { D1Database } from '@cloudflare/workers-types';

export interface RecurringExpense {
	id: string;
	household_id: string;
	user_id: string;
	account_id: string;
	name: string;
	amount_paise: number;
	category_id: string;
	frequency: string;
	start_date: string;
	end_date: string | null;
	occurrence_limit: number | null;
	last_posted_at: string | null;
	next_due_at: string;
	is_active: number;
	created_at: string;
	deleted_at: string | null;
}

/** List a household's active (non-deleted) recurring expenses, newest first. */
export async function listRecurringExpenses(
	db: D1Database,
	household_id: string
): Promise<RecurringExpense[]> {
	const { results } = await db
		.prepare(
			`SELECT * FROM recurring_expenses
			 WHERE household_id = ? AND deleted_at IS NULL
			 ORDER BY created_at DESC`
		)
		.bind(household_id)
		.all<RecurringExpense>();
	return results ?? [];
}

/** Create a recurring expense with frequency scheduling. */
export async function createRecurringExpense(
	db: D1Database,
	input: {
		household_id: string;
		user_id: string;
		account_id: string;
		name: string;
		amount_paise: number;
		category_id: string;
		frequency: string; // 'daily' | 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly' | 'yearly'
		start_date?: string; // YYYY-MM-DD, defaults to today
		end_date?: string | null; // YYYY-MM-DD
		occurrence_limit?: number | null; // how many times to post
	}
): Promise<RecurringExpense> {
	const startDate = input.start_date || new Date().toISOString().split('T')[0];
	const row = await db
		.prepare(
			`INSERT INTO recurring_expenses
			   (household_id, user_id, account_id, name, amount_paise, category_id, frequency, start_date, end_date, occurrence_limit, next_due_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 RETURNING *`
		)
		.bind(
			input.household_id,
			input.user_id,
			input.account_id,
			input.name,
			input.amount_paise,
			input.category_id,
			input.frequency,
			startDate,
			input.end_date ?? null,
			input.occurrence_limit ?? null,
			startDate // next_due_at starts at start_date
		)
		.first<RecurringExpense>();
	if (!row) throw new Error('Failed to create recurring expense');
	return row;
}

/** Delete a recurring expense (soft delete via deleted_at). */
export async function deleteRecurringExpense(
	db: D1Database,
	id: string,
	household_id: string
): Promise<void> {
	const res = await db
		.prepare(
			"UPDATE recurring_expenses SET deleted_at = datetime('now') WHERE id = ? AND household_id = ? AND deleted_at IS NULL"
		)
		.bind(id, household_id)
		.run();
	if (!res.meta.changes) throw new Error('Recurring expense not found');
}

/** Toggle a recurring expense's active status. */
export async function toggleRecurringExpense(
	db: D1Database,
	id: string,
	household_id: string,
	isActive: boolean
): Promise<void> {
	const res = await db
		.prepare(
			`UPDATE recurring_expenses SET is_active = ?, updated_at = datetime('now')
			 WHERE id = ? AND household_id = ? AND deleted_at IS NULL`
		)
		.bind(isActive ? 1 : 0, id, household_id)
		.run();
	if (!res.meta.changes) throw new Error('Recurring expense not found');
}
