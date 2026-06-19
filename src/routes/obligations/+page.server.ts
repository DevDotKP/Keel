import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { resolveAccountAndCadence } from '$lib/server/context';
import { getOrCreateCurrentPeriod } from '$lib/server/queries/periods';
import { listObligations } from '$lib/server/queries/obligations';
import { listCategories } from '$lib/server/queries/categories';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!locals.userId) redirect(302, '/auth');
	const db = getDb(platform);

	const { account, cadence } = await resolveAccountAndCadence(db, locals.userId);
	if (!account) return { obligations: [], categories: [] };

	const period = await getOrCreateCurrentPeriod(db, account.id, cadence);
	const [obligations, categories] = await Promise.all([
		listObligations(db, locals.userId, period.id),
		listCategories(db, locals.userId)
	]);

	return { obligations, categories };
};
