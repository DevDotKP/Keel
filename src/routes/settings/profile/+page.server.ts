import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getReadDb } from '$lib/server/db';
import type { User } from '$lib/types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!locals.userId) redirect(302, '/auth');
	const rdb = getReadDb(platform);
	const user = await rdb
		.prepare('SELECT id, email, created_at, display_name, avatar FROM users WHERE id = ? LIMIT 1')
		.bind(locals.userId)
		.first<User>();
	return { user };
};
