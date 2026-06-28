import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import { resolveAccountAndCadence } from '$lib/server/context';
import { getOrCreateCurrentPeriod } from '$lib/server/queries/periods';
import { settleObligation, unsettleObligation } from '$lib/server/queries/obligations';
import { nowIso } from '$lib/utils/date';

const Schema = z.object({ paid: z.boolean() });

export const POST: RequestHandler = async ({ platform, locals, params, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const body = Schema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid payload');

	const { account, cadence, harbourDay } = await resolveAccountAndCadence(db, locals.userId, locals.householdId ?? locals.userId!);
	if (!account) throw error(409, 'No account for user');
	const period = await getOrCreateCurrentPeriod(db, account.id, cadence, harbourDay);

	const hid = locals.householdId ?? locals.userId!;
	try {
		if (body.data.paid) {
			await settleObligation(db, params.id, locals.userId, period.id, account.id, nowIso(), hid);
		} else {
			await unsettleObligation(db, params.id, period.id);
		}
		return json({ ok: true });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Settle failed';
		if (msg.includes('not found')) throw error(404, msg);
		throw error(500, msg);
	}
};
