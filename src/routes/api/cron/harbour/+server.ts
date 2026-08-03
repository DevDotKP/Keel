import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { runHarbourReminders } from '$lib/server/harbour-reminder';
import { purgeOldDemoUsers } from '$lib/server/demo';
import { safeEqual } from '$lib/server/admin';
import { sweepRateLimits } from '$lib/server/rate-limit';
import { purgeUsersWhere } from '$lib/server/queries/purge';

// Driven by a scheduled GitHub Action (Cloudflare Pages has no native cron).
// Guarded by a shared secret; the work itself is idempotent per cycle.
export const POST: RequestHandler = async ({ platform, request }) => {
	const secret = platform?.env?.CRON_SECRET;
	const provided = request.headers.get('x-cron-key');
	if (!secret || !provided || !safeEqual(provided, secret)) throw error(401, 'Unauthorized');

	const db = getDb(platform);
	const result = await runHarbourReminders(db, platform?.env ?? {});
	// Sweep stale public-demo accounts (older than 10 min) so they never accumulate.
	await purgeOldDemoUsers(db, 10);
	await sweepRateLimits(db);
	// Sweep users who requested a magic link but never verified: no session ever,
	// no Google identity, no settings row (ensureUserSetup only runs at verify).
	// 48h grace covers anyone slow to click a real link.
	// Never touch demo accounts (demo-fam-* are shared fixtures with no sessions)
	// or anonymised deleted users (kept so shared-ledger FK references resolve).
	//
	// The last two guards enforce purgeUsersWhere's isolation contract. Skipping
	// them is what broke this endpoint: backfill migrations gave some unverified
	// users a household and categories, so deleting the users row hit a foreign
	// key and failed the batch every hour.
	const NEVER_VERIFIED = `created_at < datetime('now', '-48 hours')
		AND google_sub IS NULL
		AND id NOT LIKE 'demo-%'
		AND email NOT LIKE 'deleted+%'
		AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = users.id)
		AND NOT EXISTS (SELECT 1 FROM settings st WHERE st.user_id = users.id)
		AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.entered_by = users.id)
		AND NOT EXISTS (SELECT 1 FROM households h WHERE h.created_by = users.id AND h.id <> users.id)`;
	await db.batch(purgeUsersWhere(db, NEVER_VERIFIED));
	return json({ ok: true, ...result });
};
