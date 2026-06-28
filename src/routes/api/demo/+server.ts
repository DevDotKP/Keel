import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb, getReadDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/auth';
import { createDemoSession, isDemoUser } from '$lib/server/demo';

// Start a public, no-login demo. POST (not GET) so link prefetch can't spawn
// demo users. Reuses an existing demo session if the visitor already has one.
export const POST: RequestHandler = async (event) => {
	const { platform } = event;
	const current = await getSessionUser(getReadDb(platform), event);
	if (!isDemoUser(current)) {
		await createDemoSession(getDb(platform), event);
	}
	throw redirect(303, '/');
};
