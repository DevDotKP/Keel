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

export interface AdminMetrics {
	totalUsers: number;
	newUsers30: number;
	dau: number;
	wau: number;
	mau: number;
	pau: number;
	churn30: number;
	weeks: { label: string; newUsers: number; activeUsers: number }[];
	recentErrors: AdminError[];
	releases: AdminRelease[];
}

// SQLite datetime ("YYYY-MM-DD HH:MM:SS", UTC) → epoch ms.
function parseUtc(s: string): number {
	return Date.parse(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
}

export async function getAdminMetrics(db: D1Database): Promise<AdminMetrics> {
	const [actsRes, usersRes, ownedRes, errorsRes, releasesRes] = await db.batch([
		db.prepare(
			`SELECT entered_by AS uid, entered_at FROM transactions
			 WHERE entered_by IS NOT NULL AND deleted_at IS NULL
			   AND entered_at >= datetime('now', '-90 days')`
		),
		db.prepare('SELECT id, created_at FROM users'),
		db.prepare("SELECT user_id FROM entitlements WHERE status = 'owned'"),
		db.prepare(
			'SELECT error_id, route, status, message, created_at FROM error_logs ORDER BY created_at DESC LIMIT 20'
		),
		db.prepare('SELECT id, note, created_at FROM releases ORDER BY created_at DESC LIMIT 20')
	]);

	const DAY = 86400000;
	const now = Date.now();

	const actRows = ((actsRes.results ?? []) as { uid: string; entered_at: string }[])
		.map((a) => ({ uid: a.uid, t: parseUtc(a.entered_at) }))
		.filter((a) => Number.isFinite(a.t));
	const users = ((usersRes.results ?? []) as { id: string; created_at: string }[]).map((u) => ({
		id: u.id,
		t: parseUtc(u.created_at)
	}));
	const owned = new Set(((ownedRes.results ?? []) as { user_id: string }[]).map((r) => r.user_id));

	const sinceSet = (from: number) =>
		new Set(actRows.filter((r) => r.t >= from).map((r) => r.uid));
	const rangeSet = (from: number, to: number) =>
		new Set(actRows.filter((r) => r.t >= from && r.t < to).map((r) => r.uid));

	const last30 = sinceSet(now - 30 * DAY);
	const prev30 = rangeSet(now - 60 * DAY, now - 30 * DAY);

	const weeks: AdminMetrics['weeks'] = [];
	for (let i = 7; i >= 0; i--) {
		const to = now - i * 7 * DAY;
		const from = to - 7 * DAY;
		const d = new Date(from);
		weeks.push({
			label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`,
			newUsers: users.filter((u) => u.t >= from && u.t < to).length,
			activeUsers: rangeSet(from, to).size
		});
	}

	return {
		totalUsers: users.length,
		newUsers30: users.filter((u) => u.t >= now - 30 * DAY).length,
		dau: sinceSet(now - DAY).size,
		wau: sinceSet(now - 7 * DAY).size,
		mau: last30.size,
		pau: [...last30].filter((u) => owned.has(u)).length,
		churn30: [...prev30].filter((u) => !last30.has(u)).length,
		weeks,
		recentErrors: (errorsRes.results ?? []) as AdminError[],
		releases: (releasesRes.results ?? []) as AdminRelease[]
	};
}
