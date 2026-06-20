import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getReadDb } from '$lib/server/db';
import type { Settings, User } from '$lib/types';

export const load: PageServerLoad = async ({ platform, locals, setHeaders }) => {
	if (!locals.userId) redirect(302, '/auth');
	setHeaders({ 'cache-control': 'private, max-age=0, stale-while-revalidate=30' });
	const rdb = getReadDb(platform);

	const [settings, user] = await Promise.all([
		rdb
			.prepare('SELECT * FROM settings WHERE user_id = ? LIMIT 1')
			.bind(locals.userId)
			.first<Settings>(),
		rdb
			.prepare('SELECT id, email, created_at FROM users WHERE id = ? LIMIT 1')
			.bind(locals.userId)
			.first<User>()
	]);

	return { settings, user };
};
