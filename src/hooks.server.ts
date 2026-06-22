import type { Handle, HandleServerError } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { getDb, getReadDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/auth';
import { ensureUserSetup } from '$lib/server/bootstrap';
import { seedDevSampleData } from '$lib/server/dev-seed';

// Seed the dev preview user once per server process.
let devSeeded = false;

export const handle: Handle = async ({ event, resolve }) => {
	// Resolve user from session cookie on every request.
	// Session reads are safe from a replica — logins/logouts are rare write events.
	let userId: string | null = null;

	if (event.platform?.env?.DB) {
		const rdb = getReadDb(event.platform);
		userId = await getSessionUser(rdb, event);

		// In dev, if there is no active session, fall back to the preview user
		// so the app is usable without going through the auth flow every restart.
		if (dev && !userId) {
			userId = 'dev-preview-user';
		}

		if (dev && userId && !devSeeded) {
			const db = getDb(event.platform);
			await ensureUserSetup(db, userId, 'dev@local');
			await seedDevSampleData(db, userId);
			devSeeded = true;
		}
	}

	event.locals.userId = userId;

	// Resolve the household for this user. Personal household id = user id (migration convention).
	// Falls back to userId so the app works even before ensureUserSetup creates the membership row.
	let householdId: string | null = null;
	if (userId && event.platform?.env?.DB) {
		// Prefer a shared household (household_id != user_id) over the user's own
		// personal household, so an invited member sees the joint ledger, not their
		// empty personal one. Earliest-joined breaks ties.
		const hm = await getReadDb(event.platform)
			.prepare(
				`SELECT household_id FROM household_members
				 WHERE user_id = ?
				 ORDER BY CASE WHEN household_id = ? THEN 1 ELSE 0 END ASC, joined_at ASC
				 LIMIT 1`
			)
			.bind(userId, userId)
			.first<{ household_id: string }>();
		householdId = hm?.household_id ?? userId;
	} else if (userId) {
		householdId = userId;
	}
	event.locals.householdId = householdId;

	const response = await resolve(event);

	// Security headers on every response.
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	// HSTS: only in production (HTTPS enforced by Cloudflare Pages).
	if (!dev) {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}
	// CSP: Keel uses only self-hosted fonts, no external images, Clarity CDN for analytics.
	// 'unsafe-inline' is required for SvelteKit's SSR hydration scripts and Svelte scoped styles.
	response.headers.set(
		'Content-Security-Policy',
		[
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' https://www.clarity.ms",
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data:",
			"font-src 'self'",
			"connect-src 'self' https://www.clarity.ms https://c.clarity.ms",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'"
		].join('; ')
	);

	return response;
};

// Central server error logging. Fires for uncaught/unexpected errors (e.g. a
// failed D1 write), not for handled throw error(...) responses. Cloudflare
// captures console output: live via `wrangler tail`, retained if Workers
// Observability is enabled on the project. Privacy-first: log only the route,
// method, status, and message. Never amounts, email, or transcripts.
export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const id = crypto.randomUUID().slice(0, 8);
	console.error(
		JSON.stringify({
			errorId: id,
			at: new Date().toISOString(),
			method: event.request.method,
			route: event.route?.id ?? event.url.pathname,
			status,
			message: error instanceof Error ? error.message : String(error)
		})
	);
	// Surface a reference id so a user-reported failure can be found in the logs.
	return { message, errorId: id };
};
