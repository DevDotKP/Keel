// Keel's North Star and the habit metrics that predict it, derived from existing
// tables (no event pipeline). Aggregates only, owner-only. The point: make the
// retention habit measurable during dogfooding so optimisation is aimed, not blind.
//
// Metric tree:
//   North Star  weeks the user keeps tracking without abandoning
//     - avgActiveWeeks         avg distinct weeks/user with >=1 entry (last 12 wks)
//     - retention W1/W2/W4     of cohorts old enough, % active in that later week
//   L1 (leading)
//     - activationLoggedPct    % of users who ever logged an entry
//     - harbourCompletionRate  % of ended periods that were harboured (the keystone)
//     - uncategorizedSeries    8-week % uncategorized (the churn early-warning)
//   L2 (supporting)
//     - voiceSharePct          % of recent entries added by voice
//     - voiceCorrectionPct     % of voice samples the user had to correct
//     - entriesPerActiveWeek   capture frequency when engaged
import type { SeriesPoint } from './admin-metrics';

export interface HabitMetrics {
	avgActiveWeeks: number;
	retention: { w1: number | null; w2: number | null; w4: number | null };
	activationLoggedPct: number;
	harbourCompletionRate: number | null;
	uncategorizedSeries: SeriesPoint[];
	voiceSharePct: number | null;
	voiceCorrectionPct: number | null;
	entriesPerActiveWeek: number;
	usersWithEntries: number;
	totalUsers: number;
}

function parseUtc(s: string): number {
	return Date.parse(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
}

const DAY = 86400000;
const WEEK = 7 * DAY;
const WINDOW_DAYS = 120;
const TREND_WEEKS = 8;

const pct = (n: number, d: number): number => (d > 0 ? Math.round((n / d) * 100) : 0);

export async function getHabitMetrics(db: D1Database): Promise<HabitMetrics> {
	const [txRes, usersRes, periodsRes, voiceRes] = await db.batch([
		db.prepare(
			`SELECT entered_by AS uid, entered_at AS t, source, is_uncategorized_fallback AS uncat
			 FROM transactions
			 WHERE entered_by IS NOT NULL AND deleted_at IS NULL
			   AND entered_at >= datetime('now', '-${WINDOW_DAYS} days')`
		),
		db.prepare('SELECT id, created_at FROM users'),
		db.prepare(
			`SELECT COUNT(*) AS total,
			        SUM(CASE WHEN closing_balance_paise IS NOT NULL THEN 1 ELSE 0 END) AS done
			 FROM reconciliation_periods WHERE period_end < date('now')`
		),
		db.prepare('SELECT COUNT(*) AS total, SUM(was_corrected) AS corrected FROM voice_samples')
	]);

	const now = Date.now();
	const nowWeek = Math.floor(now / WEEK);

	const tx = ((txRes.results ?? []) as { uid: string; t: string; source: string; uncat: number }[])
		.map((r) => ({ uid: r.uid, t: parseUtc(r.t), source: r.source, uncat: r.uncat }))
		.filter((r) => Number.isFinite(r.t));
	const users = ((usersRes.results ?? []) as { id: string; created_at: string }[]).map((u) => ({
		id: u.id,
		week: Math.floor(parseUtc(u.created_at) / WEEK)
	}));

	// Per-user set of active week indices (a week with >=1 entry).
	const activeWeeks = new Map<string, Set<number>>();
	for (const r of tx) {
		const w = Math.floor(r.t / WEEK);
		if (!activeWeeks.has(r.uid)) activeWeeks.set(r.uid, new Set());
		activeWeeks.get(r.uid)!.add(w);
	}

	// North Star: average distinct active weeks among users who have ever logged.
	const usersWithEntries = activeWeeks.size;
	let weekSum = 0;
	for (const set of activeWeeks.values()) weekSum += set.size;
	const avgActiveWeeks = usersWithEntries > 0 ? +(weekSum / usersWithEntries).toFixed(1) : 0;

	// Cohort retention: of users old enough to have reached week k, the share who
	// were active in their (signup week + k). Null when no cohort is eligible yet.
	const retentionAt = (k: number): number | null => {
		let eligible = 0;
		let retained = 0;
		for (const u of users) {
			if (nowWeek - u.week < k) continue; // not old enough to judge week k
			eligible++;
			if (activeWeeks.get(u.id)?.has(u.week + k)) retained++;
		}
		return eligible > 0 ? pct(retained, eligible) : null;
	};

	// 8-week uncategorized trend (the churn early-warning signal).
	const uncategorizedSeries: SeriesPoint[] = [];
	for (let i = TREND_WEEKS - 1; i >= 0; i--) {
		const we = now - i * WEEK;
		const ws = we - WEEK;
		const wk = tx.filter((r) => r.t >= ws && r.t < we);
		const uncat = wk.filter((r) => r.uncat === 1).length;
		const d = new Date(ws);
		uncategorizedSeries.push({
			label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`,
			value: pct(uncat, wk.length)
		});
	}

	const periods = (periodsRes.results?.[0] ?? {}) as { total?: number; done?: number };
	const harbourCompletionRate =
		periods.total && periods.total > 0 ? pct(periods.done ?? 0, periods.total) : null;

	const recent = tx.filter((r) => r.t >= now - 30 * DAY);
	const voiceShare = recent.length > 0 ? pct(recent.filter((r) => r.source === 'voice').length, recent.length) : null;

	const vs = (voiceRes.results?.[0] ?? {}) as { total?: number; corrected?: number };
	const voiceCorrectionPct = vs.total && vs.total > 0 ? pct(vs.corrected ?? 0, vs.total) : null;

	const entriesPerActiveWeek = weekSum > 0 ? +(tx.length / weekSum).toFixed(1) : 0;

	return {
		avgActiveWeeks,
		retention: { w1: retentionAt(1), w2: retentionAt(2), w4: retentionAt(4) },
		activationLoggedPct: pct(usersWithEntries, users.length),
		harbourCompletionRate,
		uncategorizedSeries,
		voiceSharePct: voiceShare,
		voiceCorrectionPct,
		entriesPerActiveWeek,
		usersWithEntries,
		totalUsers: users.length
	};
}
