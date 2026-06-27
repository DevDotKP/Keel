import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { clearSession } from '$lib/server/auth';

// Delete the caller's account and all personal data.
// If the user is the sole member of their household, the entire household
// (transactions, accounts, categories, obligations, etc.) is deleted too.
// If they share a household with others, only their membership is removed —
// the household data belongs to the remaining members.
// The users row is anonymised rather than deleted so foreign-key references
// in shared household ledgers don't break.
export const POST: RequestHandler = async (event) => {
	const { platform, locals } = event;
	if (!locals.userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const db = getDb(platform);
	const userId = locals.userId;
	const hid = locals.householdId ?? userId;

	const memberCountRow = await db
		.prepare('SELECT COUNT(*) as count FROM household_members WHERE household_id = ?')
		.bind(hid)
		.first<{ count: number }>();
	const isPersonalHousehold = (memberCountRow?.count ?? 1) <= 1;

	if (isPersonalHousehold) {
		// Delete all household-scoped data in dependency order.
		await db.batch([
			db.prepare(
				`DELETE FROM transactions WHERE account_id IN
				 (SELECT id FROM accounts WHERE household_id = ?)`
			).bind(hid),
			db.prepare(
				`DELETE FROM reconciliation_periods WHERE account_id IN
				 (SELECT id FROM accounts WHERE household_id = ?)`
			).bind(hid),
			db.prepare('DELETE FROM accounts WHERE household_id = ?').bind(hid),
			db.prepare('DELETE FROM categories WHERE household_id = ?').bind(hid),
			db.prepare(
				`DELETE FROM obligation_settlements WHERE obligation_id IN
				 (SELECT id FROM obligations WHERE household_id = ?)`
			).bind(hid),
			db.prepare('DELETE FROM obligations WHERE household_id = ?').bind(hid),
			db.prepare('DELETE FROM recurring_income WHERE household_id = ?').bind(hid),
			db.prepare('DELETE FROM holdings WHERE user_id = ?').bind(userId),
			db.prepare('DELETE FROM portfolio_snapshots WHERE user_id = ?').bind(userId),
			db.prepare('DELETE FROM household_invites WHERE household_id = ?').bind(hid),
			db.prepare('DELETE FROM household_members WHERE household_id = ?').bind(hid),
			db.prepare('DELETE FROM households WHERE id = ?').bind(hid),
		]);
	} else {
		// Shared household: remove this user's membership only.
		await db
			.prepare('DELETE FROM household_members WHERE household_id = ? AND user_id = ?')
			.bind(hid, userId)
			.run();
	}

	// Delete user-scoped data and clear auth state.
	await db.batch([
		db.prepare('DELETE FROM voice_samples WHERE user_id = ?').bind(userId),
		db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').bind(userId),
		db.prepare('DELETE FROM entitlements WHERE user_id = ?').bind(userId),
		db.prepare('DELETE FROM settings WHERE user_id = ?').bind(userId),
		db.prepare('DELETE FROM magic_link_tokens WHERE user_id = ?').bind(userId),
		db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
		// Anonymise: replace email with a stable non-PII sentinel so FK constraints
		// on shared household ledgers don't break. display_name/avatar added later.
		db.prepare(
			`UPDATE users SET email = 'deleted+' || id || '@keel.deleted' WHERE id = ?`
		).bind(userId),
	]);

	// Also clear display_name and avatar if those columns exist.
	await db
		.prepare(`UPDATE users SET display_name = NULL, avatar = NULL WHERE id = ?`)
		.bind(userId)
		.run()
		.catch(() => { /* columns may not exist in all envs */ });

	await clearSession(db, event);

	return json({ ok: true });
};
