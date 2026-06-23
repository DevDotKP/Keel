import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';

// Revoke a pending invite. Admins only. Resend by email is deferred until email
// is wired; the admin can re-copy the link from Settings in the meantime.
export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const hid = locals.householdId ?? locals.userId;
	const db = getDb(platform);

	const me = await db
		.prepare('SELECT role FROM household_members WHERE household_id = ? AND user_id = ? LIMIT 1')
		.bind(hid, locals.userId)
		.first<{ role: string }>();
	if (me?.role !== 'admin') throw error(403, 'Only admins can manage invites');

	await db
		.prepare('DELETE FROM household_invites WHERE id = ? AND household_id = ?')
		.bind(params.id, hid)
		.run();
	return new Response(null, { status: 204 });
};
