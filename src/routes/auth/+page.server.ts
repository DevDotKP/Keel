import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	if (locals.userId) throw redirect(302, '/');

	// Show the privacy-first email path whenever it can actually send: in dev,
	// or in production once Resend is configured. Otherwise it would dead-end at
	// "check your email" with nothing sent, so hide it and keep Google only.
	const magicLink = dev || !!platform?.env?.RESEND_API_KEY;

	// error values: 'oauth' | 'unverified' | 'invalid'
	return {
		error: url.searchParams.get('error'),
		next: url.searchParams.get('next'),
		magicLink
	};
};
