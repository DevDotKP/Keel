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

	return resolve(event);
};
