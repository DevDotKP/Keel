import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { runHarbourReminders } from '$lib/server/harbour-reminder';
import { purgeOldDemoUsers } from '$lib/server/demo';
import { safeEqual } from '$lib/server/admin';
import { sweepRateLimits } from '$lib/server/rate-limit';

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
	const NEVER_VERIFIED = `created_at < datetime('now', '-48 hours')
		AND google_sub IS NULL
		AND id NOT LIKE 'demo-%'
		AND email NOT LIKE 'deleted+%'
		AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = users.id)
		AND NOT EXISTS (SELECT 1 FROM settings st WHERE st.user_id = users.id)`;
	await db.batch([
		db.prepare(
			`DELETE FROM magic_link_tokens WHERE user_id IN (SELECT id FROM users WHERE ${NEVER_VERIFIED})`
		),
		db.prepare(`DELETE FROM users WHERE ${NEVER_VERIFIED}`)
	]);
	return json({ ok: true, ...result });
};
