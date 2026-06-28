import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import { harbourPeriod } from '$lib/server/queries/periods';
import { getDefaultAccount } from '$lib/server/queries/accounts';

const HarbourSchema = z.object({
	closing_balance_paise: z.number().int(),
	fresh_start: z.boolean().default(false)
});

export const POST: RequestHandler = async ({ platform, locals, params, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const body = HarbourSchema.safeParse(await request.json());
	if (!body.success) throw error(400, body.error.message);

	const account = await getDefaultAccount(db, locals.householdId ?? locals.userId!);
	if (!account) throw error(409, 'No account for user');

	// Verify the period belongs to this user's account.
	const period = await db
		.prepare('SELECT id FROM reconciliation_periods WHERE id = ? AND account_id = ?')
		.bind(params.id, account.id)
		.first<{ id: string }>();
	if (!period) throw error(404, 'Period not found');

	await harbourPeriod(db, params.id, account.id, body.data.closing_balance_paise, {
		freshStart: body.data.fresh_start
	});
	return json({ ok: true });
};
