import { redirect, error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

export const OAUTH_STATE_COOKIE = 'keel_oauth_state';
const STATE_TTL = 10 * 60; // 10 minutes

function randomState(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export const GET: RequestHandler = async ({ platform, url, cookies }) => {
	const clientId = platform?.env?.GOOGLE_CLIENT_ID;
	if (!clientId) throw error(500, 'Google auth is not configured on this deployment.');

	const state = randomState();

	cookies.set(OAUTH_STATE_COOKIE, state, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: STATE_TTL
	});

	const redirectUri = `${url.origin}/api/auth/google/callback`;

	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'openid email',
		state,
		access_type: 'online',
		prompt: 'select_account'
	});

	throw redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
};
