import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { createSession } from '$lib/server/auth';
import { ensureUserSetup } from '$lib/server/bootstrap';
import { OAUTH_STATE_COOKIE } from '$lib/server/auth';

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
	name?: string;
	picture?: string;
}

function base64FromArrayBuffer(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let binary = '';
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}

// Inline the Google profile photo as a small data URL so avatars stay
// self-hosted (CSP allows data:, not external image hosts). Best-effort.
async function fetchAvatarDataUrl(url: string): Promise<string | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const type = res.headers.get('content-type') ?? 'image/jpeg';
		if (!/^image\/(png|jpeg|jpg|webp)/.test(type)) return null;
		const buf = await res.arrayBuffer();
		if (buf.byteLength > 150_000) return null;
		return `data:${type};base64,${base64FromArrayBuffer(buf)}`;
	} catch {
		return null;
	}
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
	const googleName = info.name?.trim() || null;

	// Resolve the user: google_sub → email match → new user (in that order).
	let userId: string | null = null;
	let existing: { id: string; display_name: string | null; avatar: string | null } | null = null;

	const byGoogleSub = await db
		.prepare('SELECT id, display_name, avatar FROM users WHERE google_sub = ? LIMIT 1')
		.bind(info.sub)
		.first<{ id: string; display_name: string | null; avatar: string | null }>();

	if (byGoogleSub) {
		existing = byGoogleSub;
		userId = byGoogleSub.id;
	} else {
		const byEmail = await db
			.prepare('SELECT id, display_name, avatar FROM users WHERE email = ? LIMIT 1')
			.bind(info.email)
			.first<{ id: string; display_name: string | null; avatar: string | null }>();

		if (byEmail) {
			// Existing magic-link user: link their Google account.
			existing = byEmail;
			userId = byEmail.id;
			await db
				.prepare('UPDATE users SET google_sub = ? WHERE id = ?')
				.bind(info.sub, byEmail.id)
				.run();
		} else {
			// Brand new user: seed name and avatar from the Google profile.
			const avatar = info.picture ? await fetchAvatarDataUrl(info.picture) : null;
			await db
				.prepare('INSERT INTO users (email, google_sub, display_name, avatar) VALUES (?, ?, ?, ?)')
				.bind(info.email, info.sub, googleName, avatar)
				.run();
			const created = await db
				.prepare('SELECT id FROM users WHERE email = ? LIMIT 1')
				.bind(info.email)
				.first<{ id: string }>();
			userId = created?.id ?? null;
		}
	}

	if (!userId) throw error(500, 'Could not resolve user after sign-in.');

	// Backfill name/avatar for an existing account that has neither yet (never
	// overwrites a name or photo the user has set).
	if (existing) {
		const sets: string[] = [];
		const binds: unknown[] = [];
		if (!existing.display_name && googleName) {
			sets.push('display_name = ?');
			binds.push(googleName);
		}
		if (!existing.avatar && info.picture) {
			const avatar = await fetchAvatarDataUrl(info.picture);
			if (avatar) {
				sets.push('avatar = ?');
				binds.push(avatar);
			}
		}
		if (sets.length > 0) {
			binds.push(userId);
			await db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
		}
	}

	await ensureUserSetup(db, userId, info.email);
	await createSession(db, event, userId);

	throw redirect(302, next);
};
