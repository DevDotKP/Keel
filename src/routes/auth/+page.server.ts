import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.userId) throw redirect(302, '/');

	// error values: 'oauth' | 'unverified' | 'invalid'
	return { error: url.searchParams.get('error') };
};
