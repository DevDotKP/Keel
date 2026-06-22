import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import { resolveAccountAndCadence } from '$lib/server/context';
import { getAccountSummary } from '$lib/server/queries/periods';

export const GET: RequestHandler = async ({ platform, locals }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);

	const { account, cadence, harbourDay } = await resolveAccountAndCadence(db, locals.userId, locals.householdId ?? locals.userId!);
	if (!account) return json(null, { status: 404 });

	const summary = await getAccountSummary(db, account.id, cadence, harbourDay);
	return json(summary);
};

const PatchSchema = z.object({ balance_paise: z.number().int().min(0) });

// Set the starting balance for the open cycle. Used by the dashboard nudge for
// users who skipped /welcome. Sets both the account balance and the open period's
// opening balance so "safe to spend" reflects it at once. Safe because the nudge
// only appears when there is no activity yet (no transactions, no harbour).
export const PATCH: RequestHandler = async ({ platform, locals, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const { account } = await resolveAccountAndCadence(db, locals.userId, locals.householdId ?? locals.userId!);
	if (!account) throw error(404, 'No account');

	const body = PatchSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid balance');

	await db.batch([
		db.prepare('UPDATE accounts SET balance_paise = ? WHERE id = ?').bind(body.data.balance_paise, account.id),
		db
			.prepare(
				'UPDATE reconciliation_periods SET opening_balance_paise = ? WHERE account_id = ? AND harboured_at IS NULL'
			)
			.bind(body.data.balance_paise, account.id)
	]);
	return new Response(null, { status: 204 });
};
