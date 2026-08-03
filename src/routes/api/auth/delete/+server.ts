import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { clearSession } from '$lib/server/auth';

// Delete the caller's account and all personal data.
// The user may belong to several households: the one they own (id = user id)
// and any they joined. Per household: if no OTHER members remain, the whole
// household (transactions, accounts, categories, obligations, etc.) is deleted;
// if others remain, only this user's membership is removed — the ledger belongs
// to the remaining members. The users row is anonymised rather than deleted so
// foreign-key references (e.g. entered_by) in surviving ledgers don't break.
export const POST: RequestHandler = async (event) => {
	const { platform, locals } = event;
	if (!locals.userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const db = getDb(platform);
	const userId = locals.userId;

	// Every household this user belongs to, plus the one they own (id = user id),
	// which exists even when no membership row does.
	const { results: memberships } = await db
		.prepare('SELECT household_id FROM household_members WHERE user_id = ?')
		.bind(userId)
		.all<{ household_id: string }>();
	const householdIds = new Set<string>([userId, ...(memberships ?? []).map((m) => m.household_id)]);

	for (const hid of householdIds) {
		const others = await db
			.prepare(
				'SELECT COUNT(*) as count FROM household_members WHERE household_id = ? AND user_id != ?'
			)
			.bind(hid, userId)
			.first<{ count: number }>();

		if ((others?.count ?? 0) > 0) {
			// Shared household with remaining members: remove this user's membership only.
			await db
				.prepare('DELETE FROM household_members WHERE household_id = ? AND user_id = ?')
				.bind(hid, userId)
				.run();
			continue;
		}

		// Sole member: delete all household-scoped data in dependency order.
		// Order and scoping follow the same rules as queries/purge.ts — see the
		// comments there. Two of them are load-bearing:
		//  - obligation_settlements references transactions and periods, so it must
		//    be cleared before them, not after.
		//  - `household_id IS NULL AND user_id = ?` catches rows written before the
		//    households migration, which otherwise survive and hold a foreign key
		//    on the categories being deleted.
		const OWNED = (t: string) =>
			`(${t}.household_id = ? OR (${t}.household_id IS NULL AND ${t}.user_id = ?))`;
		const ACC = `(SELECT id FROM accounts WHERE ${OWNED('accounts')})`;
		await db.batch([
			db.prepare(
				`DELETE FROM obligation_settlements
				 WHERE obligation_id IN (SELECT id FROM obligations WHERE ${OWNED('obligations')})
				    OR transaction_id IN (SELECT id FROM transactions WHERE account_id IN ${ACC})
				    OR period_id IN (SELECT id FROM reconciliation_periods WHERE account_id IN ${ACC})`
			).bind(hid, userId, hid, userId, hid, userId),
			db.prepare(`DELETE FROM obligations WHERE ${OWNED('obligations')}`).bind(hid, userId),
			db.prepare(`DELETE FROM transactions WHERE account_id IN ${ACC}`).bind(hid, userId),
			db.prepare(`DELETE FROM reconciliation_periods WHERE account_id IN ${ACC}`).bind(hid, userId),
			db.prepare(`DELETE FROM accounts WHERE ${OWNED('accounts')}`).bind(hid, userId),
			// recurring_income and recurring_expenses both carry a category_id, so
			// they have to go before categories, not after.
			db.prepare(`DELETE FROM recurring_income WHERE ${OWNED('recurring_income')}`).bind(hid, userId),
			db.prepare(`DELETE FROM recurring_expenses WHERE ${OWNED('recurring_expenses')}`).bind(hid, userId),
			db.prepare(`DELETE FROM holdings WHERE ${OWNED('holdings')}`).bind(hid, userId),
			db.prepare('DELETE FROM portfolio_snapshots WHERE household_id = ?').bind(hid),
			// categories.parent_id self-reference: break the links before deleting.
			db.prepare(
				`UPDATE categories SET parent_id = NULL WHERE parent_id IN
				 (SELECT id FROM categories WHERE ${OWNED('categories')})`
			).bind(hid, userId),
			db.prepare(`DELETE FROM categories WHERE ${OWNED('categories')}`).bind(hid, userId),
			db.prepare('DELETE FROM household_invites WHERE household_id = ?').bind(hid),
			db.prepare('DELETE FROM household_members WHERE household_id = ?').bind(hid),
			db.prepare('DELETE FROM households WHERE id = ?').bind(hid),
		]);
	}

	// Delete user-scoped data and clear auth state. google_sub must go too, or a
	// later Google sign-in silently resurrects the "deleted" account.
	await db.batch([
		db.prepare('DELETE FROM voice_samples WHERE user_id = ?').bind(userId),
		db.prepare('DELETE FROM app_events WHERE user_id = ?').bind(userId),
		db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').bind(userId),
		db.prepare('DELETE FROM entitlements WHERE user_id = ?').bind(userId),
		db.prepare('DELETE FROM settings WHERE user_id = ?').bind(userId),
		db.prepare('DELETE FROM magic_link_tokens WHERE user_id = ?').bind(userId),
		db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
		db.prepare('DELETE FROM holdings WHERE user_id = ?').bind(userId),
		// Anonymise: replace identity with a stable non-PII sentinel so FK
		// references in surviving shared ledgers don't break. Credentials must go
		// too, or a password reset could resurrect the "deleted" account.
		db.prepare(
			`UPDATE users SET email = 'deleted+' || id || '@keel.deleted',
				google_sub = NULL, display_name = NULL, avatar = NULL,
				password_hash = NULL, recovery_code_hash = NULL WHERE id = ?`
		).bind(userId),
	]);

	await clearSession(db, event);

	return json({ ok: true });
};
