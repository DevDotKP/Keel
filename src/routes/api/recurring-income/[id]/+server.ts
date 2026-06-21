import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { deleteRecurringIncome } from '$lib/server/queries/recurring-income';

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const hid = locals.householdId ?? locals.userId;
	await deleteRecurringIncome(getDb(platform), params.id, hid);
	return new Response(null, { status: 204 });
};
