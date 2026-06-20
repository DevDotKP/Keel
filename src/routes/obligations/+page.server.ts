import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb, getReadDb } from '$lib/server/db';
import { resolveAccountAndCadence } from '$lib/server/context';
import { getOrCreateCurrentPeriod } from '$lib/server/queries/periods';
import { listObligations } from '$lib/server/queries/obligations';
import { listCategories } from '$lib/server/queries/categories';

export const load: PageServerLoad = async ({ platform, locals, setHeaders }) => {
	if (!locals.userId) redirect(302, '/auth');
	setHeaders({ 'cache-control': 'private, max-age=0, stale-while-revalidate=30' });
	const db = getDb(platform);
	const rdb = getReadDb(platform);

	const { account, cadence } = await resolveAccountAndCadence(rdb, locals.userId);
	if (!account) return { obligations: [], categories: [] };

	const period = await getOrCreateCurrentPeriod(db, account.id, cadence);
	const [obligations, categories] = await Promise.all([
		listObligations(rdb, locals.userId, period.id),
		listCategories(rdb, locals.userId)
	]);

	return { obligations, categories };
};
