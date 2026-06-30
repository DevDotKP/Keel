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

/** Update recurring income fields (editable at any time). */
export async function updateRecurringIncome(
	db: D1Database,
	id: string,
	household_id: string,
	updates: {
		name?: string;
		amount_paise?: number;
		category_id?: string | null;
		frequency?: string;
		start_date?: string;
		end_date?: string | null;
		occurrence_limit?: number | null;
		is_active?: boolean;
		next_due_at?: string;
	}
): Promise<RecurringIncomeWithFrequency> {
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
		binds.push(updates.category_id ?? null);
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

	if (setClauses.length === 0) throw new Error('No updates provided');

	binds.push(id, household_id);
	const sql = `UPDATE recurring_income SET ${setClauses.join(', ')} WHERE id = ? AND household_id = ? AND deleted_at IS NULL RETURNING *`;
	const row = await db.prepare(sql).bind(...binds).first<RecurringIncomeWithFrequency>();
	if (!row) throw new Error('Recurring income not found');
	return row;
}

/** Migrate existing anchor_kind items to frequency-based (run once per household). */
export async function migrateAnchorKindToFrequency(
	db: D1Database,
	household_id: string
): Promise<number> {
	// Find all items with anchor_kind set and next_due_at still at default (2099)
	// These are old-style items that haven't been migrated yet
	const oldItems = await db
		.prepare(
			`SELECT id, anchor_kind FROM recurring_income
			 WHERE household_id = ? AND anchor_kind IS NOT NULL AND next_due_at = '2099-12-31T00:00:00Z'`
		)
		.bind(household_id)
		.all<{ id: string; anchor_kind: string }>();

	if (!oldItems.results || oldItems.results.length === 0) return 0;

	const today = new Date().toISOString().split('T')[0];
	const writes: Array<ReturnType<D1Database['prepare']>> = [];

	for (const item of oldItems.results) {
		// All anchor_kind types map to monthly frequency
		writes.push(
			db
				.prepare(
					`UPDATE recurring_income
					 SET frequency = 'monthly', start_date = ?, next_due_at = ?
					 WHERE id = ? AND household_id = ?`
				)
				.bind(today, today, item.id, household_id)
		);
	}

	if (writes.length === 0) return 0;
	await db.batch(writes);
	return oldItems.results.length;
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
