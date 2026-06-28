import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getReadDb } from '$lib/server/db';
import type { Settings } from '$lib/types';

export const load: PageServerLoad = async ({ platform, locals, setHeaders }) => {
	if (!locals.userId) redirect(302, '/auth');
	setHeaders({ 'cache-control': 'private, no-cache' });
	const rdb = getReadDb(platform);
	const settings = await rdb
		.prepare('SELECT * FROM settings WHERE user_id = ? LIMIT 1')
		.bind(locals.userId)
		.first<Settings>();
	return {
		settings,
		vapidPublicKey: platform?.env?.VAPID_PUBLIC_KEY ?? null
	};
};
