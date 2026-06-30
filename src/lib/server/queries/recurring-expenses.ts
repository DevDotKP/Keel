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
	due_time: string | null;
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
		frequency: string;
		start_date?: string;
		end_date?: string | null;
		occurrence_limit?: number | null;
		due_time?: string | null; // HH:MM IST
	}
): Promise<RecurringExpense> {
	const startDate = input.start_date || new Date().toISOString().split('T')[0];
	const nextDueAt = input.due_time
		? new Date(`${startDate}T${input.due_time}:00+05:30`).toISOString()
		: startDate;
	const row = await db
		.prepare(
			`INSERT INTO recurring_expenses
			   (household_id, user_id, account_id, name, amount_paise, category_id, frequency, start_date, end_date, occurrence_limit, next_due_at, due_time)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
			nextDueAt,
			input.due_time ?? null
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
			`UPDATE recurring_expenses SET is_active = ?
			 WHERE id = ? AND household_id = ? AND deleted_at IS NULL`
		)
		.bind(isActive ? 1 : 0, id, household_id)
		.run();
	if (!res.meta.changes) throw new Error('Recurring expense not found');
}

/** Update recurring expense fields (editable at any time). */
export async function updateRecurringExpense(
	db: D1Database,
	id: string,
	household_id: string,
	updates: {
		name?: string;
		amount_paise?: number;
		category_id?: string;
		frequency?: string;
		start_date?: string;
		end_date?: string | null;
		occurrence_limit?: number | null;
		is_active?: boolean;
		next_due_at?: string;
		due_time?: string | null;
	}
): Promise<RecurringExpense> {
	const setClauses: string[] = [];
	const binds: (string | number | null | boolean)[] = [];

	if (updates.name !== undefined) {
		setClauses.push('name = ?');
		binds.push(updates.name);
	}
	if (updates.amount_paise !== undefined) {
		setClauses.push('amount_paise = ?');
		binds.push(updates.amount_paise);
	}
	if (updates.category_id !== undefined) {
		setClauses.push('category_id = ?');
		binds.push(updates.category_id);
	}
	if (updates.frequency !== undefined) {
		setClauses.push('frequency = ?');
		binds.push(updates.frequency);
	}
	if (updates.start_date !== undefined) {
		setClauses.push('start_date = ?');
		binds.push(updates.start_date);
	}
	if (updates.end_date !== undefined) {
		setClauses.push('end_date = ?');
		binds.push(updates.end_date ?? null);
	}
	if (updates.occurrence_limit !== undefined) {
		setClauses.push('occurrence_limit = ?');
		binds.push(updates.occurrence_limit ?? null);
	}
	if (updates.is_active !== undefined) {
		setClauses.push('is_active = ?');
		binds.push(updates.is_active ? 1 : 0);
	}
	if (updates.next_due_at !== undefined) {
		setClauses.push('next_due_at = ?');
		binds.push(updates.next_due_at);
	}
	if (updates.due_time !== undefined) {
		setClauses.push('due_time = ?');
		binds.push(updates.due_time ?? null);
	}

	if (setClauses.length === 0) throw new Error('No updates provided');

	binds.push(id, household_id);
	const sql = `UPDATE recurring_expenses SET ${setClauses.join(', ')} WHERE id = ? AND household_id = ? AND deleted_at IS NULL RETURNING *`;
	const row = await db.prepare(sql).bind(...binds).first<RecurringExpense>();
	if (!row) throw new Error('Recurring expense not found');
	return row;
}
