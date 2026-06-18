import type { RequestEvent } from '@sveltejs/kit';
import type { User } from '$lib/types';

const SESSION_COOKIE = 'keel_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Issue a magic-link token for the given email.
 * Upserts the user row, generates a short-lived signed token,
 * and sends an email containing the verify link.
 * Returns the token (for testing; in production only the email is the delivery vector).
 */
export async function issueMagicLink(db: D1Database, email: string): Promise<string> {
	// TODO(sonnet): upsert into users (id, email), generate a HMAC-signed token
	// with 15-minute expiry, store in a magic_link_tokens table or KV,
	// send email via a transactional email provider (e.g. Resend).
	// Return the token for testing convenience.
	throw new Error('Not implemented');
}

/**
 * Verify a magic-link token.
 * On success: marks the token used, sets the session cookie, returns the user.
 * On failure: returns null.
 */
export async function verifyMagicLink(
	db: D1Database,
	event: RequestEvent,
	token: string
): Promise<User | null> {
	// TODO(sonnet): validate the HMAC-signed token, check expiry and used flag,
	// look up the user, set the session cookie via event.cookies.set(),
	// seed entitlement (trialing) and settings rows on first login,
	// seed default account and system categories on first login.
	throw new Error('Not implemented');
}

/**
 * Resolve the session cookie to a user_id.
 * Returns null if no valid session exists.
 * Called from hooks.server.ts to populate event.locals.userId.
 */
export async function getSessionUser(
	db: D1Database,
	event: RequestEvent
): Promise<string | null> {
	// TODO(sonnet): read SESSION_COOKIE, verify the session token against D1 or KV,
	// return user_id or null.
	throw new Error('Not implemented');
}

/**
 * Clear the session cookie, effectively signing the user out.
 */
export function clearSession(event: RequestEvent): void {
	event.cookies.delete(SESSION_COOKIE, { path: '/' });
}

export { SESSION_COOKIE, COOKIE_MAX_AGE };
