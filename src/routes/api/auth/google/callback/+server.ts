import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { createSession } from '$lib/server/auth';
import { ensureUserSetup } from '$lib/server/bootstrap';
import { OAUTH_STATE_COOKIE } from '../+server';

interface GoogleTokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	id_token?: string;
	error?: string;
}

interface GoogleUserInfo {
	sub: string; // stable Google user ID
	email: string;
	email_verified: boolean;
}

export const GET: RequestHandler = async (event) => {
	const { url, platform, cookies } = event;

	const code = url.searchParams.get('code');
	const returnedState = url.searchParams.get('state');
	const rawCookie = cookies.get(OAUTH_STATE_COOKIE);

	// Always clear the state cookie — one use only.
	cookies.delete(OAUTH_STATE_COOKIE, { path: '/' });

	// Parse {nonce, next} stored server-side when the flow was initiated.
	let storedNonce: string | null = null;
	let next = '/';
	try {
		if (rawCookie) {
			const parsed = JSON.parse(rawCookie) as { nonce?: string; next?: string };
			storedNonce = parsed.nonce ?? null;
			// Re-validate next on the way back out.
			const n = parsed.next ?? '/';
			next = n.startsWith('/') && !n.startsWith('//') ? n : '/';
		}
	} catch {
		// Malformed cookie — treat as missing.
	}

	// Missing params or nonce mismatch = CSRF or stale flow.
	if (!code || !returnedState || !storedNonce || returnedState !== storedNonce) {
		throw redirect(302, '/auth?error=oauth');
	}

	const clientId = platform?.env?.GOOGLE_CLIENT_ID;
	const clientSecret = platform?.env?.GOOGLE_CLIENT_SECRET;
	if (!clientId || !clientSecret) throw error(500, 'Google auth is not configured.');

	const redirectUri = `${url.origin}/api/auth/google/callback`;

	// Exchange authorization code for access token.
	const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code'
		})
	});

	if (!tokenRes.ok) {
		console.error('[google-auth] token exchange failed', tokenRes.status, await tokenRes.text());
		throw redirect(302, '/auth?error=oauth');
	}

	const tokens = (await tokenRes.json()) as GoogleTokenResponse;
	if (tokens.error) {
		console.error('[google-auth] token error', tokens.error);
		throw redirect(302, '/auth?error=oauth');
	}

	// Fetch user info from Google's userinfo endpoint.
	const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
		headers: { Authorization: `Bearer ${tokens.access_token}` }
	});

	if (!userRes.ok) {
		console.error('[google-auth] userinfo failed', userRes.status);
		throw redirect(302, '/auth?error=oauth');
	}

	const info = (await userRes.json()) as GoogleUserInfo;

	if (!info.email_verified) {
		throw redirect(302, '/auth?error=unverified');
	}

	const db = getDb(platform);

	// Resolve the user: google_sub → email match → new user (in that order).
	let userId: string | null = null;

	const byGoogleSub = await db
		.prepare('SELECT id FROM users WHERE google_sub = ? LIMIT 1')
		.bind(info.sub)
		.first<{ id: string }>();

	if (byGoogleSub) {
		userId = byGoogleSub.id;
	} else {
		const byEmail = await db
			.prepare('SELECT id FROM users WHERE email = ? LIMIT 1')
			.bind(info.email)
			.first<{ id: string }>();

		if (byEmail) {
			// Existing magic-link user: link their Google account.
			await db
				.prepare('UPDATE users SET google_sub = ? WHERE id = ?')
				.bind(info.sub, byEmail.id)
				.run();
			userId = byEmail.id;
		} else {
			// Brand new user.
			await db
				.prepare('INSERT INTO users (email, google_sub) VALUES (?, ?)')
				.bind(info.email, info.sub)
				.run();
			const created = await db
				.prepare('SELECT id FROM users WHERE email = ? LIMIT 1')
				.bind(info.email)
				.first<{ id: string }>();
			userId = created?.id ?? null;
		}
	}

	if (!userId) throw error(500, 'Could not resolve user after sign-in.');

	await ensureUserSetup(db, userId, info.email);
	await createSession(db, event, userId);

	throw redirect(302, next);
};
