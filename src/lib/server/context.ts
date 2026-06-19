import type { Account, HarbourCadence } from '$lib/types';
import { getDefaultAccount } from '$lib/server/queries/accounts';

/** Resolve the user's default account and harbour cadence in one step. */
export async function resolveAccountAndCadence(
	db: D1Database,
	userId: string
): Promise<{ account: Account | null; cadence: HarbourCadence }> {
	const account = await getDefaultAccount(db, userId);
	const settings = await db
		.prepare('SELECT harbour_cadence FROM settings WHERE user_id = ?')
		.bind(userId)
		.first<{ harbour_cadence: HarbourCadence }>();
	return { account, cadence: settings?.harbour_cadence ?? 'weekly' };
}
