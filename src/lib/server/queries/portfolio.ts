import type { Holding, NewHolding, HoldingKind } from '$lib/types';

export interface PortfolioSnapshot {
	snapshot_date: string;
	total_paise: number;
}

export async function listHoldings(db: D1Database, household_id: string): Promise<Holding[]> {
	const { results } = await db
		.prepare(
			`SELECT * FROM holdings WHERE household_id = ? AND deleted_at IS NULL
			 ORDER BY value_paise DESC, name ASC`
		)
		.bind(household_id)
		.all<Holding>();
	return results ?? [];
}

export async function listSnapshots(
	db: D1Database,
	household_id: string,
	limit = 12
): Promise<PortfolioSnapshot[]> {
	const { results } = await db
		.prepare(
			`SELECT snapshot_date, total_paise FROM portfolio_snapshots
			 WHERE household_id = ? ORDER BY snapshot_date DESC LIMIT ?`
		)
		.bind(household_id, limit)
		.all<PortfolioSnapshot>();
	return (results ?? []).reverse(); // oldest first, for charting
}

/** Recompute the household total and upsert today's snapshot (one per day). */
export async function snapshotToday(
	db: D1Database,
	household_id: string,
	today: string
): Promise<void> {
	const row = await db
		.prepare(
			'SELECT COALESCE(SUM(value_paise), 0) AS total FROM holdings WHERE household_id = ? AND deleted_at IS NULL'
		)
		.bind(household_id)
		.first<{ total: number }>();
	await db
		.prepare(
			`INSERT INTO portfolio_snapshots (household_id, snapshot_date, total_paise)
			 VALUES (?, ?, ?)
			 ON CONFLICT(household_id, snapshot_date) DO UPDATE SET total_paise = excluded.total_paise`
		)
		.bind(household_id, today, row?.total ?? 0)
		.run();
}

export async function createHolding(db: D1Database, input: NewHolding): Promise<Holding> {
	const row = await db
		.prepare(
			`INSERT INTO holdings (household_id, user_id, name, kind, value_paise)
			 VALUES (?, ?, ?, ?, ?) RETURNING *`
		)
		.bind(input.household_id, input.user_id, input.name, input.kind, input.value_paise)
		.first<Holding>();
	if (!row) throw new Error('Failed to create holding');
	return row;
}

export async function updateHolding(
	db: D1Database,
	id: string,
	household_id: string,
	fields: { name: string; kind: HoldingKind; value_paise: number }
): Promise<void> {
	await db
		.prepare(
			`UPDATE holdings SET name = ?, kind = ?, value_paise = ?, updated_at = datetime('now')
			 WHERE id = ? AND household_id = ? AND deleted_at IS NULL`
		)
		.bind(fields.name, fields.kind, fields.value_paise, id, household_id)
		.run();
}

export async function deleteHolding(db: D1Database, id: string, household_id: string): Promise<void> {
	await db
		.prepare(
			"UPDATE holdings SET deleted_at = datetime('now') WHERE id = ? AND household_id = ? AND deleted_at IS NULL"
		)
		.bind(id, household_id)
		.run();
}
