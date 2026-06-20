import type { Account, HarbourCadence } from '$lib/types';

/** Resolve account + cadence + harbour_day in one batch. Pass rdb to serve from the nearest replica. */
export async function resolveAccountAndCadence(
	db: D1Database,
	userId: string,
	householdId?: string
): Promise<{ account: Account | null; cadence: HarbourCadence; harbourDay: string }> {
	const hid = householdId ?? userId; // personal household id = user id
	const [accountRes, settingsRes] = await db.batch<
		Account | { harbour_cadence: HarbourCadence; harbour_day: string }
	>([
		db
			.prepare(
				'SELECT * FROM accounts WHERE household_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1'
			)
			.bind(hid),
		db
			.prepare('SELECT harbour_cadence, harbour_day FROM settings WHERE user_id = ?')
			.bind(userId)
	]);
	const account = (accountRes.results?.[0] as Account) ?? null;
	const row = settingsRes.results?.[0] as
		| { harbour_cadence: HarbourCadence; harbour_day: string }
		| undefined;
	const cadence = row?.harbour_cadence ?? 'monthly';
	const harbourDay = row?.harbour_day ?? 'sunday';
	return { account, cadence, harbourDay };
}
