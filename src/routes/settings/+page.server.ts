import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import type { Settings, User } from '$lib/types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!locals.userId) redirect(302, '/auth');
	const db = getDb(platform);

	const [settings, user] = await Promise.all([
		db
			.prepare('SELECT * FROM settings WHERE user_id = ? LIMIT 1')
			.bind(locals.userId)
			.first<Settings>(),
		db
			.prepare('SELECT id, email, created_at FROM users WHERE id = ? LIMIT 1')
			.bind(locals.userId)
			.first<User>()
	]);

	return { settings, user };
};
