import type { PageServerLoad, Actions } from './$types';
import { error, redirect, fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

export const load: PageServerLoad = async ({ platform, url }) => {
	const token = url.searchParams.get('token');
	if (!token) throw error(400, 'Missing invite token');

	const db = getDb(platform);
	const invite = await db
		.prepare(
			`SELECT hi.*, h.name AS household_name
			 FROM household_invites hi
			 JOIN households h ON h.id = hi.household_id
			 WHERE hi.token = ? AND hi.accepted_at IS NULL AND hi.expires_at > datetime('now')
			 LIMIT 1`
		)
		.bind(token)
		.first<{ email: string; household_name: string; role: string; expires_at: string }>();

	if (!invite) throw error(410, 'Invite link expired or already used');
	return { invite, token };
};

export const actions: Actions = {
	accept: async ({ platform, locals, url }) => {
		if (!locals.userId) throw redirect(302, `/auth?next=${url.pathname}${url.search}`);

		const token = url.searchParams.get('token');
		if (!token) return fail(400, { message: 'Missing token' });

		const db = getDb(platform);
		const invite = await db
			.prepare(
				`SELECT * FROM household_invites
				 WHERE token = ? AND accepted_at IS NULL AND expires_at > datetime('now') LIMIT 1`
			)
			.bind(token)
			.first<{ id: string; household_id: string; role: string; email: string }>();

		if (!invite) return fail(410, { message: 'Invite expired or already used' });

		// Add member and mark invite accepted in one batch.
		await db.batch([
			db.prepare(
				`INSERT OR IGNORE INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)`
			).bind(invite.household_id, locals.userId, invite.role),
			db.prepare(`UPDATE household_invites SET accepted_at = datetime('now') WHERE id = ?`).bind(invite.id)
		]);

		throw redirect(302, '/');
	}
};
