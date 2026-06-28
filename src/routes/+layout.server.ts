import type { LayoutServerLoad } from './$types';
import { getReadDb } from '$lib/server/db';
import { getDefaultAccount } from '$lib/server/queries/accounts';

export const load: LayoutServerLoad = async ({ platform, locals }) => {
	if (!locals.userId) return { currency: 'INR' };
	try {
		const hid = locals.householdId ?? locals.userId;
		const account = await getDefaultAccount(getReadDb(platform), hid);
		return { currency: account?.currency ?? 'INR' };
	} catch {
		return { currency: 'INR' };
	}
};
