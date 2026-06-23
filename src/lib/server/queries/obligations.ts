import type { Obligation, ObligationStatus, NewObligation } from '$lib/types';

/**
 * List a user's active obligations, each annotated with whether it has been
 * settled (paid) in the given period.
 */
export async function listObligations(
	db: D1Database,
	user_id: string,
	period_id: string
): Promise<ObligationStatus[]> {
	const { results } = await db
		.prepare(
			`SELECT o.*,
			        CASE WHEN s.id IS NULL THEN 0 ELSE 1 END AS paid_flag
			 FROM obligations o
			 LEFT JOIN obligation_settlements s
			   ON s.obligation_id = o.id AND s.period_id = ?
			 WHERE o.user_id = ? AND o.deleted_at IS NULL
			 ORDER BY o.is_active DESC, o.amount_paise DESC, o.name ASC`
		)
		.bind(period_id, user_id)
		.all<Obligation & { paid_flag: number }>();

	return (results ?? []).map(({ paid_flag, ...o }) => ({ ...o, paid: paid_flag === 1 }));
}

export async function createObligation(db: D1Database, obl: NewObligation): Promise<Obligation> {
	const result = await db
		.prepare(
			`INSERT INTO obligations (user_id, name, amount_paise, category_id, cadence)
			 VALUES (?, ?, ?, ?, ?) RETURNING *`
		)
		.bind(
			obl.user_id,
			obl.name,
			obl.amount_paise,
			obl.category_id ?? null,
			obl.cadence ?? 'monthly'
		)
		.first<Obligation>();
	if (!result) throw new Error('Failed to create obligation');
	return result;
}

export async function deleteObligation(
	db: D1Database,
	id: string,
	user_id: string
): Promise<void> {
	const res = await db
		.prepare(
			"UPDATE obligations SET deleted_at = datetime('now') WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
		)
		.bind(id, user_id)
		.run();
	if (!res.meta.changes) throw new Error('Obligation not found');
}

/**
 * Settle an obligation for a period: create the expense transaction and the
 * settlement row atomically. Idempotent per period via the UNIQUE constraint.
 * The obligation's payment becomes a real ledger entry (single source of truth).
 */
export async function settleObligation(
	db: D1Database,
	id: string,
	user_id: string,
	period_id: string,
	account_id: string,
	occurred_at: string
): Promise<void> {
	const obl = await db
		.prepare('SELECT * FROM obligations WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
		.bind(id, user_id)
		.first<Obligation>();
	if (!obl) throw new Error('Obligation not found');

	// Already settled this period? No-op.
	const existing = await db
		.prepare('SELECT id FROM obligation_settlements WHERE obligation_id = ? AND period_id = ?')
		.bind(id, period_id)
		.first<{ id: string }>();
	if (existing) return;

	// Resolve the landing category: the obligation's, else Uncategorized.
	let categoryId = obl.category_id;
	if (!categoryId) {
		const uncat = await db
			.prepare(
				"SELECT id FROM categories WHERE user_id = ? AND name = 'Uncategorized' AND deleted_at IS NULL"
			)
			.bind(user_id)
			.first<{ id: string }>();
		categoryId = uncat?.id ?? null;
	}
	if (!categoryId) throw new Error('No category available for obligation payment');

	// Create the transaction (expense, negative), assigned to the current period.
	// Stamp entered_by so the entry is attributed to the member who settled it.
	const tx = await db
		.prepare(
			`INSERT INTO transactions
			   (account_id, category_id, period_id, amount_paise, description, occurred_at, source, entered_by)
			 VALUES (?, ?, ?, ?, ?, ?, 'tap', ?) RETURNING id`
		)
		.bind(account_id, categoryId, period_id, -Math.abs(obl.amount_paise), obl.name, occurred_at, user_id)
		.first<{ id: string }>();
	if (!tx) throw new Error('Failed to create obligation transaction');

	await db
		.prepare(
			'INSERT INTO obligation_settlements (obligation_id, period_id, transaction_id) VALUES (?, ?, ?)'
		)
		.bind(id, period_id, tx.id)
		.run();
}

/**
 * Reverse a settlement: soft-delete the linked transaction and remove the
 * settlement row, so the obligation shows as unpaid again.
 */
export async function unsettleObligation(
	db: D1Database,
	id: string,
	period_id: string
): Promise<void> {
	const settlement = await db
		.prepare('SELECT id, transaction_id FROM obligation_settlements WHERE obligation_id = ? AND period_id = ?')
		.bind(id, period_id)
		.first<{ id: string; transaction_id: string | null }>();
	if (!settlement) return;

	const writes: D1PreparedStatement[] = [
		db.prepare('DELETE FROM obligation_settlements WHERE id = ?').bind(settlement.id)
	];
	if (settlement.transaction_id) {
		writes.push(
			db
				.prepare("UPDATE transactions SET deleted_at = datetime('now') WHERE id = ?")
				.bind(settlement.transaction_id)
		);
	}
	await db.batch(writes);
}
