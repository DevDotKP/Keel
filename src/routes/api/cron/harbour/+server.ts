import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { runHarbourReminders } from '$lib/server/harbour-reminder';
import { purgeOldDemoUsers } from '$lib/server/demo';

// Driven by a scheduled GitHub Action (Cloudflare Pages has no native cron).
// Guarded by a shared secret; the work itself is idempotent per cycle.
export const POST: RequestHandler = async ({ platform, request }) => {
	const secret = platform?.env?.CRON_SECRET;
	const provided = request.headers.get('x-cron-key');
	if (!secret || !provided || provided !== secret) throw error(401, 'Unauthorized');

	const db = getDb(platform);
	const result = await runHarbourReminders(db, platform?.env ?? {});
	// Sweep stale public-demo accounts so they never accumulate in production.
	await purgeOldDemoUsers(db, 24);
	return json({ ok: true, ...result });
};
