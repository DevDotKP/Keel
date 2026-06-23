// Owner PM metrics, derived from existing tables (no event pipeline). Aggregates
// only; no per-user financial data. Active user = entered a transaction in the
// window. PAU (paid active users) reads zero until billing lands.

export interface AdminError {
	error_id: string;
	route: string | null;
	status: number | null;
	message: string | null;
	created_at: string;
}

export interface AdminRelease {
	id: string;
	note: string;
	created_at: string;
}

export interface SeriesPoint {
	label: string;
	value: number;
}

export type SeriesKey = 'new' | 'wau' | 'mau' | 'total' | 'pau' | 'churn';

export interface AdminMetrics {
	totalUsers: number;
	newUsers30: number;
	dau: number;
	wau: number;
	mau: number;
	pau: number;
	churn30: number;
	// 8-week weekly history per metric, so every card can show its own trend.
	series: Record<SeriesKey, SeriesPoint[]>;
	recentErrors: AdminError[];
	releases: AdminRelease[];
}

// SQLite datetime ("YYYY-MM-DD HH:MM:SS", UTC) → epoch ms.
function parseUtc(s: string): number {
	return Date.parse(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
}

const DAY = 86400000;
const WEEKS = 8;

export async function getAdminMetrics(db: D1Database): Promise<AdminMetrics> {
	const [actsRes, usersRes, ownedRes, errorsRes, releasesRes] = await db.batch([
		db.prepare(
			// 130 days covers 8 weekly buckets of rolling 30d/60d windows.
			`SELECT entered_by AS uid, entered_at FROM transactions
			 WHERE entered_by IS NOT NULL AND deleted_at IS NULL
			   AND entered_at >= datetime('now', '-130 days')`
		),
		db.prepare('SELECT id, created_at FROM users'),
		db.prepare("SELECT user_id FROM entitlements WHERE status = 'owned'"),
		db.prepare(
			'SELECT error_id, route, status, message, created_at FROM error_logs ORDER BY created_at DESC LIMIT 20'
		),
		db.prepare('SELECT id, note, created_at FROM releases ORDER BY created_at DESC LIMIT 20')
	]);

	const now = Date.now();

	const actRows = ((actsRes.results ?? []) as { uid: string; entered_at: string }[])
		.map((a) => ({ uid: a.uid, t: parseUtc(a.entered_at) }))
		.filter((a) => Number.isFinite(a.t));
	const users = ((usersRes.results ?? []) as { id: string; created_at: string }[]).map((u) => ({
		t: parseUtc(u.created_at)
	}));
	const owned = new Set(((ownedRes.results ?? []) as { user_id: string }[]).map((r) => r.user_id));

	// distinct active users with entered_at in [from, to)
	const activeSet = (from: number, to: number) =>
		new Set(actRows.filter((r) => r.t >= from && r.t < to).map((r) => r.uid));

	const last30 = activeSet(now - 30 * DAY, now + DAY);
	const prev30 = activeSet(now - 60 * DAY, now - 30 * DAY);

	// Build an 8-week series; week i ends at weekEnd, starts 7 days earlier.
	const empty = (): SeriesPoint[] => [];
	const series: Record<SeriesKey, SeriesPoint[]> = {
		new: empty(),
		wau: empty(),
		mau: empty(),
		total: empty(),
		pau: empty(),
		churn: empty()
	};

	for (let i = WEEKS - 1; i >= 0; i--) {
		const we = now - i * 7 * DAY; // week end
		const ws = we - 7 * DAY; // week start
		const d = new Date(ws);
		const label = `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;

		const weekActive = activeSet(ws, we);
		const mauSet = activeSet(we - 30 * DAY, we);
		const prevMauSet = activeSet(we - 60 * DAY, we - 30 * DAY);

		series.new.push({ label, value: users.filter((u) => u.t >= ws && u.t < we).length });
		series.wau.push({ label, value: weekActive.size });
		series.mau.push({ label, value: mauSet.size });
		series.total.push({ label, value: users.filter((u) => u.t < we).length });
		series.pau.push({ label, value: [...mauSet].filter((u) => owned.has(u)).length });
		series.churn.push({ label, value: [...prevMauSet].filter((u) => !mauSet.has(u)).length });
	}

	return {
		totalUsers: users.length,
		newUsers30: users.filter((u) => u.t >= now - 30 * DAY).length,
		dau: activeSet(now - DAY, now + DAY).size,
		wau: activeSet(now - 7 * DAY, now + DAY).size,
		mau: last30.size,
		pau: [...last30].filter((u) => owned.has(u)).length,
		churn30: [...prev30].filter((u) => !last30.has(u)).length,
		series,
		recentErrors: (errorsRes.results ?? []) as AdminError[],
		releases: (releasesRes.results ?? []) as AdminRelease[]
	};
}
