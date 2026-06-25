import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getReadDb } from '$lib/server/db';
import type { Settings, User, HouseholdMember, HouseholdInvite } from '$lib/types';

export const load: PageServerLoad = async ({ platform, locals, setHeaders }) => {
	if (!locals.userId) redirect(302, '/auth');
	setHeaders({ 'cache-control': 'private, max-age=0, stale-while-revalidate=30' });
	const rdb = getReadDb(platform);
	const hid = locals.householdId ?? locals.userId;

	const [settings, user, membersRes, invitesRes, householdRes] = await Promise.all([
		rdb.prepare('SELECT * FROM settings WHERE user_id = ? LIMIT 1').bind(locals.userId).first<Settings>(),
		rdb.prepare('SELECT id, email, created_at, display_name, avatar FROM users WHERE id = ? LIMIT 1').bind(locals.userId).first<User>(),
		rdb.prepare(
			`SELECT hm.id, hm.household_id, hm.user_id, hm.role, hm.joined_at, u.email, u.display_name, u.avatar
			 FROM household_members hm
			 JOIN users u ON u.id = hm.user_id
			 WHERE hm.household_id = ? ORDER BY hm.joined_at ASC`
		).bind(hid).all<HouseholdMember>(),
		rdb.prepare(
			`SELECT * FROM household_invites
			 WHERE household_id = ? AND accepted_at IS NULL AND expires_at > datetime('now')
			 ORDER BY created_at DESC`
		).bind(hid).all<HouseholdInvite>(),
		rdb.prepare('SELECT id, name FROM households WHERE id = ? LIMIT 1').bind(hid).first<{ id: string; name: string }>()
	]);

	return {
		settings,
		user,
		household: householdRes ?? null,
		members: membersRes.results ?? [],
		pendingInvites: invitesRes.results ?? [],
		currentUserId: locals.userId,
		// Public key the browser needs to subscribe to push. Null if not configured.
		vapidPublicKey: platform?.env?.VAPID_PUBLIC_KEY ?? null
	};
};
