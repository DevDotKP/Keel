import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import { resolveAccountAndCadence } from '$lib/server/context';
import { getOrCreateCurrentPeriod } from '$lib/server/queries/periods';
import { listObligations, createObligation } from '$lib/server/queries/obligations';

const NewObligationSchema = z.object({
	name: z.string().min(1).max(60),
	amount_paise: z.number().int().positive(),
	category_id: z.string().nullable().optional(),
	cadence: z.enum(['weekly', 'fortnightly', 'monthly']).optional()
});

export const GET: RequestHandler = async ({ platform, locals }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const hid = locals.householdId ?? locals.userId!;

	const { account, cadence, harbourDay } = await resolveAccountAndCadence(db, locals.userId, hid);
	if (!account) return json([]);
	const period = await getOrCreateCurrentPeriod(db, account.id, cadence, harbourDay);
	const obligations = await listObligations(db, hid, period.id);
	return json(obligations);
};

export const POST: RequestHandler = async ({ platform, locals, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const hid = locals.householdId ?? locals.userId!;
	const body = NewObligationSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid obligation');

	const obl = await createObligation(db, { user_id: locals.userId, household_id: hid, ...body.data });
	return json(obl, { status: 201 });
};
