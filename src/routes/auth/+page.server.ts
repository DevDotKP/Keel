import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	if (locals.userId) throw redirect(302, '/');

	// Show the email path when it can actually deliver a link: in dev, when Resend
	// is configured (real emails), or in closed-testing reveal mode (link shown on
	// screen, no email). Otherwise it would dead-end, so hide it and keep Google only.
	const reveal = platform?.env?.MAGIC_LINK_REVEAL === 'true';
	const magicLink = dev || !!platform?.env?.RESEND_API_KEY || reveal;

	// error values: 'oauth' | 'unverified' | 'invalid'
	return {
		error: url.searchParams.get('error'),
		next: url.searchParams.get('next'),
		magicLink,
		reveal
	};
};
