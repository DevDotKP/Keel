import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { resolveAccountAndCadence } from '$lib/server/context';
import { getAccountSummary } from '$lib/server/queries/periods';

export const GET: RequestHandler = async ({ platform, locals }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);

	const { account, cadence, harbourDay } = await resolveAccountAndCadence(db, locals.userId);
	if (!account) return json(null, { status: 404 });

	const summary = await getAccountSummary(db, account.id, cadence, harbourDay);
	return json(summary);
};
