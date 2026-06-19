import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Already authenticated — nothing to do here.
	if (locals.userId) throw redirect(302, '/');

	return {
		error: url.searchParams.get('error') // 'invalid' when magic link fails
	};
};
