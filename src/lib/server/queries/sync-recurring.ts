import type { D1Database } from '@cloudflare/workers-types';

/**
 * Calculate the next due date given a frequency and optional start date.
 * start is an ISO datetime string (e.g., '2026-06-30T14:30:00').
 * Returns an ISO datetime string for the next occurrence.
 */
function nextDueDate(frequency: string, from: Date): Date {
	const next = new Date(from);

	switch (frequency) {
		case 'daily':
			next.setDate(next.getDate() + 1);
			break;
		case 'weekly':
			next.setDate(next.getDate() + 7);
			break;
		case 'bi_weekly':
			next.setDate(next.getDate() + 14);
			break;
		case 'monthly': {
			const day = next.getDate();
			next.setMonth(next.getMonth() + 1);
			// Handle month-end overflow (e.g., Jan 31 → Feb 28/29)
			if (next.getDate() !== day) {
				next.setDate(0); // Last day of prev month if overflow
			}
			break;
		}
		case 'bi_monthly':
			next.setMonth(next.getMonth() + 2);
			break;
		case 'quarterly':
			next.setMonth(next.getMonth() + 3);
			break;
		case 'half_yearly':
			next.setMonth(next.getMonth() + 6);
			break;
		case 'yearly':
			next.setFullYear(next.getFullYear() + 1);
			break;
		default:
			next.setMonth(next.getMonth() + 1); // fallback: monthly
	}

	return next;
}

/**
 * Check if a recurring item has reached its end_date or occurrence_limit.
 */
function isExpired(
	endDate: string | null,
	occurrenceLimit: number | null,
	occurrencesGenerated: number
): boolean {
	if (occurrenceLimit !== null && occurrencesGenerated >= occurrenceLimit) return true;
	if (endDate !== null && new Date().toISOString() > endDate) return true;
	return false;
}

/**
 * Sync recurring income: create transactions for any due recurrences.
 * Call this on dashboard load or via a scheduled job (cron).
 */
export async function syncRecurringIncome(db: D1Database, household_id: string): Promise<number> {
	const now = new Date().toISOString();

	// Find all active recurring income items that are due
	const dueItems = await db
		.prepare(
			`SELECT ri.*
			 FROM recurring_income ri
			 WHERE ri.household_id = ?
			   AND ri.deleted_at IS NULL
			   AND ri.is_active = 1
			   AND ri.next_due_at <= ?
			   AND (ri.end_date IS NULL OR ri.end_date > date('now'))`
		)
		.bind(household_id, now)
		.all<{
			id: string;
			name: string;
			amount_paise: number;
			category_id: string | null;
			frequency: string;
			next_due_at: string;
			occurrence_limit: number | null;
		}>();

	if (!dueItems.results) return 0;

	const writes: Array<ReturnType<D1Database['prepare']>> = [];

	for (const item of dueItems.results) {
		// Check if this item has reached its occurrence limit
		if (item.occurrence_limit !== null) {
			const countRow = await db
				.prepare(`SELECT COUNT(*) as cnt FROM transactions WHERE recurring_source = ?`)
				.bind(`income:${item.id}`)
				.first<{ cnt: number}>();
			if ((countRow?.cnt ?? 0) >= item.occurrence_limit) continue;
		}

		// Get the default income category if not set
		const categoryId =
			item.category_id ??
			(
				await db
					.prepare(`SELECT id FROM categories WHERE household_id = ? AND name = 'Income' LIMIT 1`)
					.bind(household_id)
					.first<{ id: string }>()
			)?.id;

		if (!categoryId) continue;

		// Get the current account (assume first account for the household)
		const accountRow = await db
			.prepare(`SELECT id FROM accounts WHERE household_id = ? AND deleted_at IS NULL LIMIT 1`)
			.bind(household_id)
			.first<{ id: string }>();

		if (!accountRow) continue;

		// Create the transaction
		writes.push(
			db
				.prepare(
					`INSERT INTO transactions
					   (account_id, category_id, amount_paise, description, occurred_at, entered_at, source, is_recurring_sync, recurring_source)
					 VALUES (?, ?, ?, ?, ?, ?, 'tap', 1, ?)`
				)
				.bind(accountRow.id, categoryId, item.amount_paise, item.name, now, now, `income:${item.id}`)
		);

		// Update next_due_at and last_posted_at
		const nextDue = nextDueDate(item.frequency, new Date());
		writes.push(
			db
				.prepare(
					`UPDATE recurring_income
					 SET next_due_at = ?, last_posted_at = ?
					 WHERE id = ?`
				)
				.bind(nextDue.toISOString(), now, item.id)
		);
	}

	if (writes.length === 0) return 0;

	// Execute all writes as a batch
	await db.batch(writes);
	return writes.length / 2; // Each item = 2 writes (insert + update)
}

/**
 * Sync recurring expenses: create transactions for any due recurrences.
 */
export async function syncRecurringExpenses(db: D1Database, household_id: string): Promise<number> {
	const now = new Date().toISOString();

	const dueItems = await db
		.prepare(
			`SELECT re.*
			 FROM recurring_expenses re
			 WHERE re.household_id = ?
			   AND re.deleted_at IS NULL
			   AND re.is_active = 1
			   AND re.next_due_at <= ?
			   AND (re.end_date IS NULL OR re.end_date > date('now'))`
		)
		.bind(household_id, now)
		.all<{
			id: string;
			account_id: string;
			name: string;
			amount_paise: number;
			category_id: string;
			frequency: string;
			next_due_at: string;
			occurrence_limit: number | null;
		}>();

	if (!dueItems.results) return 0;

	const writes: Array<ReturnType<D1Database['prepare']>> = [];

	for (const item of dueItems.results) {
		// Check if this item has reached its occurrence limit
		if (item.occurrence_limit !== null) {
			const countRow = await db
				.prepare(`SELECT COUNT(*) as cnt FROM transactions WHERE recurring_source = ?`)
				.bind(`expense:${item.id}`)
				.first<{ cnt: number }>();
			if ((countRow?.cnt ?? 0) >= item.occurrence_limit) continue;
		}

		const accountRow = await db
			.prepare(`SELECT id FROM accounts WHERE id = ? AND deleted_at IS NULL`)
			.bind(item.account_id)
			.first<{ id: string }>();

		if (!accountRow) continue;

		// Amount is negative for expenses
		writes.push(
			db
				.prepare(
					`INSERT INTO transactions
					   (account_id, category_id, amount_paise, description, occurred_at, entered_at, source, is_recurring_sync, recurring_source)
					 VALUES (?, ?, ?, ?, ?, ?, 'tap', 1, ?)`
				)
				.bind(accountRow.id, item.category_id, -item.amount_paise, item.name, now, now, `expense:${item.id}`)
		);

		// Update next_due_at and last_posted_at
		const nextDue = nextDueDate(item.frequency, new Date());
		writes.push(
			db
				.prepare(
					`UPDATE recurring_expenses
					 SET next_due_at = ?, last_posted_at = ?
					 WHERE id = ?`
				)
				.bind(nextDue.toISOString(), now, item.id)
		);
	}

	if (writes.length === 0) return 0;

	await db.batch(writes);
	return writes.length / 2; // Each item = 2 writes (insert + update)
}

/**
 * Main sync function: call this on dashboard load or via cron.
 * Syncs both recurring income and expenses for a household.
 */
export async function syncAllRecurring(db: D1Database, household_id: string): Promise<void> {
	await Promise.all([syncRecurringIncome(db, household_id), syncRecurringExpenses(db, household_id)]);
}
