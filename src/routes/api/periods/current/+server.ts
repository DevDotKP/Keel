import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getOrCreateCurrentPeriod } from '$lib/server/queries/periods';
import { resolveAccountAndCadence } from '$lib/server/context';

export const GET: RequestHandler = async ({ platform, locals }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const { account, cadence, harbourDay } = await resolveAccountAndCadence(db, locals.userId, locals.householdId ?? locals.userId!);
	if (!account) throw error(409, 'No account for user');
	const period = await getOrCreateCurrentPeriod(db, account.id, cadence, harbourDay);
	return json(period);
};
