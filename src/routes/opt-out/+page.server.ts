import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ platform, url }) => {
	const token = platform?.env?.OPT_OUT_TOKEN;
	// If no token is configured in the environment, the route doesn't exist.
	if (!token) redirect(302, '/');
	const provided = url.searchParams.get('k');
	if (!provided || provided !== token) redirect(302, '/');
	return {};
};
