import { redirect, error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
import { OAUTH_STATE_COOKIE } from '$lib/server/auth';

const STATE_TTL = 10 * 60; // 10 minutes

function randomNonce(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

// Only allow relative paths — prevent open redirect.
function safeNext(raw: string | null): string {
	if (!raw) return '/';
	if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
	return '/';
}

export const GET: RequestHandler = async ({ platform, url, cookies }) => {
	const clientId = platform?.env?.GOOGLE_CLIENT_ID;
	if (!clientId) throw error(500, 'Google auth is not configured on this deployment.');

	const nonce = randomNonce();
	const next = safeNext(url.searchParams.get('next'));

	// Store {nonce, next} server-side so the callback can redirect correctly.
	// Only the nonce is sent to Google as the state parameter.
	cookies.set(OAUTH_STATE_COOKIE, JSON.stringify({ nonce, next }), {
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
		state: nonce,
		access_type: 'online',
		prompt: 'select_account'
	});

	throw redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
};
