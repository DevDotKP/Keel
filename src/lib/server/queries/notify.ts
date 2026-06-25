import { notifyUser, type PushPayload } from '$lib/server/push';
import { formatPaise } from '$lib/utils/money';

type VapidEnv = { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string };

/**
 * Tell the other household members that someone added an entry. No-op for a
 * solo household, for members who opted out (notify_partner = 0), or when push
 * isn't configured. Call from ctx.waitUntil so it never blocks the response.
 */
export async function notifyHouseholdOfEntry(
	db: D1Database,
	env: VapidEnv,
	opts: { householdId: string; adderId: string; amountPaise: number; description: string }
): Promise<void> {
	const { results } = await db
		.prepare(
			`SELECT hm.user_id AS user_id
			 FROM household_members hm
			 JOIN settings s ON s.user_id = hm.user_id
			 WHERE hm.household_id = ? AND hm.user_id != ? AND s.notify_partner = 1`
		)
		.bind(opts.householdId, opts.adderId)
		.all<{ user_id: string }>();
	if (!results.length) return;

	const adder = await db
		.prepare('SELECT display_name, email FROM users WHERE id = ? LIMIT 1')
		.bind(opts.adderId)
		.first<{ display_name: string | null; email: string | null }>();
	const name = adder?.display_name || (adder?.email ?? 'Someone').split('@')[0];

	const isIncome = opts.amountPaise > 0;
	const payload: PushPayload = {
		title: `${name} added ${formatPaise(Math.abs(opts.amountPaise))}`,
		body: opts.description || (isIncome ? 'Income' : 'Expense'),
		url: '/',
		tag: `entry-${opts.adderId}-${Date.now()}`
	};

	await Promise.all(results.map((r) => notifyUser(db, r.user_id, payload, env)));
}
