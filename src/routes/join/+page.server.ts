import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { getDb, getReadDb } from '$lib/server/db';
import { sha256 } from '$lib/server/auth';

const INVITE_SQL = `SELECT hi.id, hi.household_id, hi.role, hi.email, h.name AS household_name
	 FROM household_invites hi
	 JOIN households h ON h.id = hi.household_id
	 WHERE hi.token = ? AND hi.accepted_at IS NULL AND hi.expires_at > datetime('now')
	 LIMIT 1`;

type InviteRow = {
	id: string;
	household_id: string;
	role: string;
	email: string;
	household_name: string;
};

export const load: PageServerLoad = async ({ platform, locals, url }) => {
	const token = url.searchParams.get('token');
	if (!token) return { status: 'invalid' as const };

	const tokenHash = await sha256(token);
	const invite = await getReadDb(platform).prepare(INVITE_SQL).bind(tokenHash).first<InviteRow>();
	if (!invite) return { status: 'expired' as const };

	// Must be signed in to join. Carry a clean next back to this exact invite.
	if (!locals.userId) {
		throw redirect(302, `/auth?next=${encodeURIComponent(`/join?token=${token}`)}`);
	}

	return {
		status: 'ready' as const,
		token,
		household_name: invite.household_name,
		role: invite.role
	};
};

export const actions: Actions = {
	accept: async ({ platform, locals, url }) => {
		const token = url.searchParams.get('token');
		if (!token) return fail(400, { message: 'Missing invite token' });
		if (!locals.userId) {
			throw redirect(302, `/auth?next=${encodeURIComponent(`/join?token=${token}`)}`);
		}

		const db = getDb(platform);
		const tokenHash = await sha256(token);
		const invite = await db.prepare(INVITE_SQL).bind(tokenHash).first<InviteRow>();
		if (!invite) return fail(410, { message: 'Invite expired or already used' });

		// Join with the invited role; mark the invite used. Idempotent via the
		// UNIQUE(household_id, user_id) constraint.
		await db.batch([
			db
				.prepare(
					'INSERT OR IGNORE INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)'
				)
				.bind(invite.household_id, locals.userId, invite.role),
			db
				.prepare("UPDATE household_invites SET accepted_at = datetime('now') WHERE id = ?")
				.bind(invite.id)
		]);

		throw redirect(302, '/');
	}
};
