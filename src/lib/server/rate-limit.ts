// Sliding-window rate limiting backed by the rate_limits table. Workers are
// stateless, so counts live in D1. One row per event; the hourly cron sweeps
// rows older than the longest window we use.

/** Client IP for rate-limit keys. Cloudflare always sets cf-connecting-ip. */
export function clientIp(request: Request): string {
	return (
		request.headers.get('cf-connecting-ip') ??
		request.headers.get('x-forwarded-for') ??
		'unknown'
	);
}

/**
 * Count events in the bucket over the window and, if under the cap, record this
 * one. Returns true when the caller should be rejected (429). windowMinutes is
 * always a code-supplied integer, never user input.
 */
export async function rateLimited(
	db: D1Database,
	bucket: string,
	max: number,
	windowMinutes: number
): Promise<boolean> {
	const mins = Math.max(1, Math.floor(windowMinutes));
	const row = await db
		.prepare(
			`SELECT COUNT(*) AS n FROM rate_limits WHERE bucket = ? AND created_at > datetime('now', '-${mins} minutes')`
		)
		.bind(bucket)
		.first<{ n: number }>();
	if ((row?.n ?? 0) >= max) return true;
	await db.prepare('INSERT INTO rate_limits (bucket) VALUES (?)').bind(bucket).run();
	return false;
}

/** Sweep rows older than any window we use. Called by the hourly cron. */
export async function sweepRateLimits(db: D1Database): Promise<void> {
	await db.prepare("DELETE FROM rate_limits WHERE created_at < datetime('now', '-2 hours')").run();
}
