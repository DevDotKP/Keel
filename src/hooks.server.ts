import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { ensureUserSetup } from '$lib/server/bootstrap';
import { seedDevSampleData } from '$lib/server/dev-seed';

// Seed the dev preview user once per server process (not per request).
let devSeeded = false;

export const handle: Handle = async ({ event, resolve }) => {
	// TODO(sonnet): import getSessionUser from '$lib/server/auth' and call it here.

	// DEV-ONLY preview shim so the gated UI is viewable before auth exists.
	// TODO(sonnet): remove once getSessionUser is implemented. Production stays null.
	event.locals.userId = dev ? 'dev-preview-user' : null;

	if (dev && event.locals.userId && !devSeeded && event.platform?.env?.DB) {
		await ensureUserSetup(event.platform.env.DB, event.locals.userId, 'dev@local');
		await seedDevSampleData(event.platform.env.DB, event.locals.userId);
		devSeeded = true;
	}

	return resolve(event);
};
