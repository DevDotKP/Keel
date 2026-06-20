import type { Account, HarbourCadence } from '$lib/types';

/** Resolve account + cadence in one batch. Pass rdb to serve from the nearest replica. */
export async function resolveAccountAndCadence(
	db: D1Database,
	userId: string
): Promise<{ account: Account | null; cadence: HarbourCadence }> {
	const [accountRes, settingsRes] = await db.batch<Account | { harbour_cadence: HarbourCadence }>(
		[
			db
				.prepare(
					'SELECT * FROM accounts WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1'
				)
				.bind(userId),
			db.prepare('SELECT harbour_cadence FROM settings WHERE user_id = ?').bind(userId)
		]
	);
	const account = (accountRes.results?.[0] as Account) ?? null;
	const cadence =
		((settingsRes.results?.[0] as { harbour_cadence: HarbourCadence })?.harbour_cadence) ??
		'monthly';
	return { account, cadence };
}
