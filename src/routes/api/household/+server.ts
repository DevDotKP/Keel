import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import type { HouseholdMember, HouseholdInvite } from '$lib/types';

const InviteSchema = z.object({
	email: z.string().email(),
	role: z.enum(['admin', 'member']).default('member')
});

export const GET: RequestHandler = async ({ platform, locals }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const hid = locals.householdId ?? locals.userId;
	const db = getDb(platform);

	const [membersRes, invitesRes, householdRes] = await db.batch<
		HouseholdMember | HouseholdInvite | { id: string; name: string }
	>([
		db.prepare(
			`SELECT hm.id, hm.household_id, hm.user_id, hm.role, hm.joined_at, u.email
			 FROM household_members hm
			 JOIN users u ON u.id = hm.user_id
			 WHERE hm.household_id = ?
			 ORDER BY hm.joined_at ASC`
		).bind(hid),
		db.prepare(
			`SELECT * FROM household_invites
			 WHERE household_id = ? AND accepted_at IS NULL AND expires_at > datetime('now')
			 ORDER BY created_at DESC`
		).bind(hid),
		db.prepare('SELECT id, name FROM households WHERE id = ?').bind(hid)
	]);

	return json({
		household: householdRes.results?.[0] ?? null,
		members: membersRes.results ?? [],
		pending_invites: invitesRes.results ?? []
	});
};

export const POST: RequestHandler = async ({ platform, locals, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const hid = locals.householdId ?? locals.userId;
	const db = getDb(platform);

	// Only admins can invite.
	const role = await db
		.prepare('SELECT role FROM household_members WHERE household_id = ? AND user_id = ? LIMIT 1')
		.bind(hid, locals.userId)
		.first<{ role: string }>();
	if (role?.role !== 'admin') throw error(403, 'Only admins can invite members');

	const body = InviteSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid email or role');

	// Check for existing active invite or membership.
	const existing = await db
		.prepare(
			`SELECT 1 FROM household_members hm JOIN users u ON u.id = hm.user_id
			 WHERE hm.household_id = ? AND u.email = ? LIMIT 1`
		)
		.bind(hid, body.data.email)
		.first();
	if (existing) throw error(409, 'Already a member');

	const token = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

	const invite = await db
		.prepare(
			`INSERT INTO household_invites (household_id, email, token, invited_by, role, expires_at)
			 VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
		)
		.bind(hid, body.data.email, token, locals.userId, body.data.role, expiresAt)
		.first<HouseholdInvite>();

	// TODO(P7): send invite email via Resend when email infra is wired.
	// For now, return the token in the response so the admin can share the link manually.
	return json({ ...invite, invite_url: `/join?token=${token}` }, { status: 201 });
};
