import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getReadDb } from '$lib/server/db';
import { getDefaultAccount } from '$lib/server/queries/accounts';

// Family-account guard: before a new entry is saved, check whether another
// household member already logged a charge of the same amount very recently.
// Helps two people on a joint ledger avoid double-logging the same expense.
// Returns at most one match (the most recent). Personal accounts never match.
const WINDOW_HOURS = 6;

export const GET: RequestHandler = async ({ platform, locals, url }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');

	const amount = Math.abs(parseInt(url.searchParams.get('amount_paise') ?? '', 10));
	if (!amount || Number.isNaN(amount)) return json({ duplicate: null });

	const rdb = getReadDb(platform);
	const hid = locals.householdId ?? locals.userId;
	const account = await getDefaultAccount(rdb, hid);
	if (!account) return json({ duplicate: null });

	const row = await rdb
		.prepare(
			`SELECT t.description, t.amount_paise, t.entered_at,
			        u.display_name, u.email
			 FROM transactions t
			 LEFT JOIN users u ON u.id = t.entered_by
			 WHERE t.account_id = ?1
			   AND t.deleted_at IS NULL
			   AND ABS(t.amount_paise) = ?2
			   AND t.entered_by IS NOT NULL
			   AND t.entered_by != ?3
			   AND t.entered_at >= datetime('now', ?4)
			 ORDER BY t.entered_at DESC
			 LIMIT 1`
		)
		.bind(account.id, amount, locals.userId, `-${WINDOW_HOURS} hours`)
		.first<{ description: string; amount_paise: number; entered_at: string; display_name: string | null; email: string | null }>();

	if (!row) return json({ duplicate: null });

	const name =
		row.display_name?.trim() || (row.email ? row.email.split('@')[0] : 'Someone in your household');

	return json({
		duplicate: {
			name,
			description: row.description,
			amount_paise: Math.abs(row.amount_paise),
			entered_at: row.entered_at
		}
	});
};
