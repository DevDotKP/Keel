import { computePeriod } from '$lib/server/queries/periods';
import { getDefaultAccount } from '$lib/server/queries/accounts';
import { notifyUser } from '$lib/server/push';
import type { HarbourCadence } from '$lib/types';

type VapidEnv = { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string };

interface ReminderRow {
	user_id: string;
	household_id: string;
	harbour_cadence: HarbourCadence;
	harbour_day: string;
	harbour_notify_at: string; // 'HH:MM'
	last_harbour_notify: string | null;
}

// IST is UTC+5:30 with no DST, so a fixed offset is exact.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istParts(nowUtc: Date): { date: string; hhmm: string; ist: Date } {
	const ist = new Date(nowUtc.getTime() + IST_OFFSET_MS);
	const y = ist.getUTCFullYear();
	const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
	const d = String(ist.getUTCDate()).padStart(2, '0');
	const hh = String(ist.getUTCHours()).padStart(2, '0');
	const mi = String(ist.getUTCMinutes()).padStart(2, '0');
	// computePeriod reads local-time getters; in the (UTC) Worker runtime a Date
	// shifted by the IST offset yields IST wall-clock values.
	return { date: `${y}-${m}-${d}`, hhmm: `${hh}:${mi}`, ist };
}

/**
 * Send the one-per-cycle Harbour reminder to everyone who is due right now.
 * Due means: today (IST) is the cycle's end day, the chosen reminder time has
 * passed, the cycle isn't already harboured, and we haven't reminded for this
 * cycle yet. Idempotent via settings.last_harbour_notify, so running this hourly
 * never double-sends and never becomes a daily nag. Returns how many were sent.
 */
export async function runHarbourReminders(
	db: D1Database,
	env: VapidEnv,
	nowUtc: Date = new Date()
): Promise<{ sent: number; checked: number }> {
	const { date: today, hhmm: nowHHMM, ist } = istParts(nowUtc);

	const { results } = await db
		.prepare(
			`SELECT s.user_id, s.harbour_cadence, s.harbour_day, s.harbour_notify_at,
			        s.last_harbour_notify, hm.household_id
			 FROM settings s
			 JOIN household_members hm ON hm.user_id = s.user_id
			 WHERE s.notify_harbour = 1
			   AND EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = s.user_id)`
		)
		.all<ReminderRow>();

	let sent = 0;
	for (const row of results) {
		const { end, start } = computePeriod(row.harbour_cadence, row.harbour_day, ist);

		// Only on the cycle's last day, only once the chosen time has passed.
		if (end !== today) continue;
		if (nowHHMM < (row.harbour_notify_at || '20:00')) continue;
		if (row.last_harbour_notify === end) continue; // already reminded this cycle

		const account = await getDefaultAccount(db, row.household_id);
		if (!account) continue;

		// Don't nag someone who already closed this period.
		const period = await db
			.prepare(
				`SELECT closing_balance_paise FROM reconciliation_periods
				 WHERE account_id = ? AND period_start = ?`
			)
			.bind(account.id, start)
			.first<{ closing_balance_paise: number | null }>();
		const alreadyHarboured = !!period && period.closing_balance_paise !== null;

		// Mark as handled regardless, so a harboured cycle never re-triggers.
		await db
			.prepare('UPDATE settings SET last_harbour_notify = ? WHERE user_id = ?')
			.bind(end, row.user_id)
			.run();
		if (alreadyHarboured) continue;

		await notifyUser(
			db,
			row.user_id,
			{
				title: 'Time to come to harbour',
				body: 'Settle this cycle in about 2 minutes.',
				url: '/harbour',
				tag: `harbour-${end}`
			},
			env
		);
		sent++;
	}

	return { sent, checked: results.length };
}
