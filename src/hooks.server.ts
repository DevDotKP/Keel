import type { Handle } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

// Populate event.locals.userId from the session cookie on every request.
export const handle: Handle = async ({ event, resolve }) => {
	// TODO(sonnet): import getSessionUser from '$lib/server/auth' and call it here.
	// For now, userId is null (all routes that need auth will redirect to /auth).
	const db = getDb(event.platform);
	void db; // will be used by getSessionUser
	event.locals.userId = null;
	return resolve(event);
};
