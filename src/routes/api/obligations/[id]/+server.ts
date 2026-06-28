import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { deleteObligation } from '$lib/server/queries/obligations';

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const hid = locals.householdId ?? locals.userId!;

	try {
		await deleteObligation(db, params.id, hid);
		return new Response(null, { status: 204 });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Delete failed';
		if (msg.includes('not found')) throw error(404, 'Obligation not found');
		throw error(500, msg);
	}
};
