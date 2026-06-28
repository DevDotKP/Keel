import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb, getReadDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/auth';
import { createDemoSession, isDemoUser, demoRateLimited, recordDemoCreation } from '$lib/server/demo';

// Start a public, no-login demo. POST (not GET) so link prefetch can't spawn
// demo users. Reuses an existing demo session if the visitor already has one,
// and rate-limits new sessions per IP so a script can't flood D1.
export const POST: RequestHandler = async (event) => {
	const { platform, request } = event;
	const current = await getSessionUser(getReadDb(platform), event);
	if (!isDemoUser(current)) {
		const db = getDb(platform);
		const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown';
		if (await demoRateLimited(db, ip)) {
			throw error(429, 'Too many demo sessions from your network just now. Please try again in a little while.');
		}
		await createDemoSession(db, event);
		await recordDemoCreation(db, ip);
	}
	throw redirect(303, '/');
};
