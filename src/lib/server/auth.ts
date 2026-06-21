import type { RequestEvent } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { User } from '$lib/types';
import { ensureUserSetup } from './bootstrap';

export const SESSION_COOKIE = 'keel_session';
export const OAUTH_STATE_COOKIE = 'keel_oauth_state';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds
const MAGIC_LINK_TTL = 15 * 60; // 15 minutes in seconds

// SHA-256 of a raw string; returns lowercase hex.
async function sha256(input: string): Promise<string> {
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

// 256 bits of CSPRNG entropy encoded as lowercase hex (64 chars).
function randomToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

// Produce a UTC datetime string SQLite can compare with datetime('now').
function sqliteUtc(date: Date): string {
	return date.toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Issue a magic-link token for the given email.
 *
 * In dev (or when RESEND_API_KEY is absent) the token is returned in the
 * result so the developer can paste it into /api/auth/verify?token=…
 * In production the token is sent via email and the result is always
 * { token: null } so it's never exposed to the client.
 */
export async function issueMagicLink(
	db: D1Database,
	email: string,
	opts: { baseUrl: string; resendApiKey?: string; fromEmail?: string }
): Promise<{ token: string | null }> {
	// Upsert user so user_id exists before storing the token.
	await db.prepare('INSERT OR IGNORE INTO users (email) VALUES (?)').bind(email).run();
	const user = await db
		.prepare('SELECT id FROM users WHERE email = ? LIMIT 1')
		.bind(email)
		.first<{ id: string }>();
	if (!user) throw new Error('Failed to resolve user after upsert');

	const token = randomToken();
	const hash = await sha256(token);
	const expiresAt = sqliteUtc(new Date(Date.now() + MAGIC_LINK_TTL * 1000));

	// Invalidate any previous unused tokens for this user so only one works at a time.
	await db
		.prepare("UPDATE magic_link_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL")
		.bind(user.id)
		.run();

	await db
		.prepare(
			'INSERT INTO magic_link_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
		)
		.bind(user.id, hash, expiresAt)
		.run();

	const link = `${opts.baseUrl}/api/auth/verify?token=${token}`;

	if (dev || !opts.resendApiKey) {
		// Dev path: skip email, hand the token back for manual testing.
		console.log('[auth] magic link:', link);
		return { token };
	}

	// Production path: send via Resend. Fire-and-forget; a delivery failure
	// should not block the 200 response to the client.
	const fromEmail = opts.fromEmail ?? 'noreply@keel.app';
	const emailRes = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${opts.resendApiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			from: `Keel <${fromEmail}>`,
			to: [email],
			subject: 'Your Keel sign-in link',
			html: `<p>Click the link below to sign in. It expires in 15 minutes.</p>
<p><a href="${link}">Sign in to Keel</a></p>
<p style="color:#888;font-size:0.85em">If you didn't request this, ignore it.</p>`
		})
	});

	if (!emailRes.ok) {
		// Log the error but don't surface it to the client (don't leak info).
		console.error('[auth] Resend error', emailRes.status, await emailRes.text());
	}

	return { token: null };
}

/**
 * Create a session for the given user_id and set the session cookie.
 * Called by both the magic-link verify path and the Google OAuth callback.
 */
export async function createSession(
	db: D1Database,
	event: RequestEvent,
	userId: string
): Promise<void> {
	const sessionToken = randomToken();
	const sessionHash = await sha256(sessionToken);
	const expiresAt = sqliteUtc(new Date(Date.now() + COOKIE_MAX_AGE * 1000));

	await db
		.prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
		.bind(userId, sessionHash, expiresAt)
		.run();

	event.cookies.set(SESSION_COOKIE, sessionToken, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: COOKIE_MAX_AGE
	});
}

/**
 * Verify a magic-link token.
 * On success: marks the token used, creates a session cookie, calls ensureUserSetup,
 * and returns the user. On failure: returns null.
 */
export async function verifyMagicLink(
	db: D1Database,
	event: RequestEvent,
	token: string
): Promise<User | null> {
	const hash = await sha256(token);

	const row = await db
		.prepare(
			"SELECT id, user_id FROM magic_link_tokens WHERE token_hash = ? AND expires_at > datetime('now') AND used_at IS NULL LIMIT 1"
		)
		.bind(hash)
		.first<{ id: string; user_id: string }>();

	if (!row) return null;

	// Mark used immediately so concurrent requests can't reuse it.
	await db
		.prepare("UPDATE magic_link_tokens SET used_at = datetime('now') WHERE id = ?")
		.bind(row.id)
		.run();

	const user = await db
		.prepare('SELECT id, email, created_at FROM users WHERE id = ? LIMIT 1')
		.bind(row.user_id)
		.first<User>();

	if (!user) return null;

	// Bootstrap user data (idempotent: no-op on subsequent logins).
	await ensureUserSetup(db, user.id, user.email);

	await createSession(db, event, user.id);

	return user;
}

/**
 * Resolve the session cookie to a user_id.
 * Returns null if no valid session exists.
 */
export async function getSessionUser(
	db: D1Database,
	event: RequestEvent
): Promise<string | null> {
	const cookie = event.cookies.get(SESSION_COOKIE);
	if (!cookie) return null;

	const hash = await sha256(cookie);
	const session = await db
		.prepare(
			"SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > datetime('now') LIMIT 1"
		)
		.bind(hash)
		.first<{ user_id: string }>();

	return session?.user_id ?? null;
}

/**
 * Clear the session cookie and delete the session row.
 */
export async function clearSession(db: D1Database, event: RequestEvent): Promise<void> {
	const cookie = event.cookies.get(SESSION_COOKIE);
	if (cookie) {
		const hash = await sha256(cookie);
		await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
	}
	event.cookies.delete(SESSION_COOKIE, { path: '/' });
}
