import type { LayoutServerLoad } from './$types';
import { getReadDb } from '$lib/server/db';
import { getDefaultAccount } from '$lib/server/queries/accounts';
import { isDemoUser } from '$lib/server/demo';

export const load: LayoutServerLoad = async ({ platform, locals }) => {
	const isDemo = isDemoUser(locals.userId);
	if (!locals.userId) return { currency: 'INR', isDemo };
	try {
		const hid = locals.householdId ?? locals.userId;
		const account = await getDefaultAccount(getReadDb(platform), hid);
		return { currency: account?.currency ?? 'INR', isDemo };
	} catch {
		return { currency: 'INR', isDemo };
	}
};
