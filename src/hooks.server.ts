import type { Handle } from '@sveltejs/kit';
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
