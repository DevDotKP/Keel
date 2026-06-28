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

// Not exported: SvelteKit endpoint files may only export request handlers.
// Exporting this const breaks the production build (postbuild route analysis).
const SUPPORTED_CURRENCIES = [
	'INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'CAD', 'AUD'
] as const;

const PatchSchema = z.object({
	balance_paise: z.number().int().min(0).optional(),
	currency: z.enum(SUPPORTED_CURRENCIES).optional()
});

export const PATCH: RequestHandler = async ({ platform, locals, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const { account } = await resolveAccountAndCadence(db, locals.userId, locals.householdId ?? locals.userId!);
	if (!account) throw error(404, 'No account');

	const body = PatchSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid payload');

	const writes: D1PreparedStatement[] = [];

	if (body.data.balance_paise !== undefined) {
		writes.push(
			db.prepare('UPDATE accounts SET balance_paise = ? WHERE id = ?').bind(body.data.balance_paise, account.id),
			db.prepare(
				'UPDATE reconciliation_periods SET opening_balance_paise = ? WHERE account_id = ? AND harboured_at IS NULL'
			).bind(body.data.balance_paise, account.id)
		);
	}

	if (body.data.currency !== undefined) {
		writes.push(db.prepare('UPDATE accounts SET currency = ? WHERE id = ?').bind(body.data.currency, account.id));
	}

	if (writes.length === 0) throw error(400, 'Nothing to update');
	await db.batch(writes);
	return new Response(null, { status: 204 });
};
