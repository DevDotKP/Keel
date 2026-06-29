// Public, no-login demo. Each visitor gets their OWN throwaway user (id prefixed
// `demo-`), seeded with realistic fake data. Because every query in the app is
// scoped by the session's user_id (set server-side), a demo visitor is fully
// isolated and can never see or touch a real user's data. Demo users are purged
// by the hourly cron after they go stale.
import type { RequestEvent } from '@sveltejs/kit';
import { createSession } from './auth';
import { ensureUserSetup } from './bootstrap';

export const DEMO_PREFIX = 'demo-';

export function isDemoUser(userId: string | null | undefined): boolean {
	return !!userId && userId.startsWith(DEMO_PREFIX);
}

// Generous on purpose: Indian mobile networks share IPs heavily (CGNAT), so a
// low cap would block legitimate visitors. Cookie-reuse already stops honest
// repeat users from creating new sessions, so this only catches scripted bursts.
export const DEMO_CAP_PER_HOUR = 20;

/** True if this IP has created too many demo sessions in the last hour. */
export async function demoRateLimited(db: D1Database, ip: string): Promise<boolean> {
	const row = await db
		.prepare("SELECT COUNT(*) AS n FROM demo_throttle WHERE ip = ? AND created_at > datetime('now','-1 hour')")
		.bind(ip)
		.first<{ n: number }>();
	return (row?.n ?? 0) >= DEMO_CAP_PER_HOUR;
}

/** Record a demo creation against an IP for rate-limiting. */
export async function recordDemoCreation(db: D1Database, ip: string): Promise<void> {
	await db.prepare('INSERT INTO demo_throttle (ip) VALUES (?)').bind(ip).run();
}

// UTC noon on a given y/m/d (clamped to the month's last day), as an ISO string.
// Noon avoids any date-boundary drift when SQLite compares the date portion.
function utcNoon(y: number, m: number, d: number): string {
	const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
	return new Date(Date.UTC(y, m, Math.min(d, lastDay), 12, 0, 0)).toISOString();
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Create an isolated demo user, seed it, and start a session. Returns the id. */
export async function createDemoSession(db: D1Database, event: RequestEvent): Promise<string> {
	// Sweep stale demos on the way in, so they clear ~10 min after creation even
	// between hourly cron runs.
	await purgeOldDemoUsers(db, 10);
	const userId = DEMO_PREFIX + crypto.randomUUID();
	await ensureUserSetup(db, userId, `${userId}@demo.keel`);
	await seedDemoData(db, userId);
	await createSession(db, event, userId);
	return userId;
}

/**
 * Seed a demo user with a realistic, current-looking month plus two harboured
 * months of history, a portfolio, obligations and recurring income. Dates are
 * relative to "now" so the demo always looks current. Idempotent per account.
 */
export async function seedDemoData(db: D1Database, userId: string): Promise<void> {
	const account = await db
		.prepare('SELECT id FROM accounts WHERE user_id = ? AND deleted_at IS NULL LIMIT 1')
		.bind(userId)
		.first<{ id: string }>();
	if (!account) return;
	const acc = account.id;

	const already = await db.prepare('SELECT 1 FROM transactions WHERE account_id = ? LIMIT 1').bind(acc).first();
	if (already) return;

	const { results: cats } = await db
		.prepare('SELECT id, name FROM categories WHERE household_id = ? AND deleted_at IS NULL')
		.bind(userId)
		.all<{ id: string; name: string }>();
	const C = (name: string): string | null => cats.find((c) => c.name === name)?.id ?? null;

	const now = new Date();
	const Y = now.getUTCFullYear();
	const Mo = now.getUTCMonth();

	// Settings, opening balance, and a few category caps so the dashboard and
	// Insights read well. Opening balance Rs 92,000; monthly target Rs 70,000.
	await db.batch([
		db
			.prepare("UPDATE settings SET onboarded = 1, show_portfolio = 1, cycle_budget_paise = 7000000, harbour_cadence = 'monthly' WHERE user_id = ?")
			.bind(userId),
		db.prepare('UPDATE accounts SET balance_paise = 9200000 WHERE id = ?').bind(acc),
		db.prepare('UPDATE categories SET daily_reserve_paise = 15000, budget_paise = 800000 WHERE id = ?').bind(C('Food & Dining')),
		db.prepare('UPDATE categories SET budget_paise = 800000 WHERE id = ?').bind(C('Groceries')),
		db.prepare('UPDATE categories SET daily_reserve_paise = 5000 WHERE id = ?').bind(C('Transport'))
	]);

	// Family members, each with a photo, so the shared ledger shows who logged what.
	// Member ids are prefixed by the demo user id so they purge with it. Kenny's
	// photo is not in static/demo-avatars yet, so he falls back to initials.
	const FAMILY: Array<{ name: string; avatar: string | null }> = [
		{ name: 'Erik', avatar: '/demo-avatars/erik.png' },
		{ name: 'Stan', avatar: '/demo-avatars/stan.jpeg' },
		{ name: 'Kyle', avatar: '/demo-avatars/kyle.png' },
		{ name: 'Butters', avatar: '/demo-avatars/butters.webp' },
		{ name: 'Kenny', avatar: null }
	];
	const memberIds = FAMILY.map((_, i) => `${userId}-m${i + 1}`);
	await db.batch(
		FAMILY.flatMap((m, i) => [
			db
				.prepare('INSERT OR IGNORE INTO users (id, email, display_name, avatar) VALUES (?, ?, ?, ?)')
				.bind(memberIds[i], `${memberIds[i]}@demo.keel`, m.name, m.avatar),
			db
				.prepare("INSERT OR IGNORE INTO household_members (household_id, user_id, role) VALUES (?, ?, 'member')")
				.bind(userId, memberIds[i])
		])
	);
	// Pick a random family member to attribute an entry to.
	const who = () => memberIds[Math.floor(Math.random() * memberIds.length)];

	const tx = (
		catId: string | null,
		amount: number,
		desc: string,
		iso: string,
		source = 'tap',
		periodId: string | null = null,
		fallback = 0,
		enteredBy: string | null = null
	) =>
		db
			.prepare(
				`INSERT INTO transactions (account_id, category_id, period_id, amount_paise, description, occurred_at, source, is_uncategorized_fallback, entered_by)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(acc, catId, periodId, amount, desc, iso, source, fallback, enteredBy);

	const writes: D1PreparedStatement[] = [];

	// Two harboured months of history (drift shrinks: the picture gets clearer).
	for (const [offset, drift] of [
		[-2, -350000],
		[-1, -150000]
	] as const) {
		const d = new Date(Date.UTC(Y, Mo + offset, 1));
		const y = d.getUTCFullYear();
		const mm = d.getUTCMonth();
		const lastDay = new Date(Date.UTC(y, mm + 1, 0)).getUTCDate();
		const pid = crypto.randomUUID();
		writes.push(
			db
				.prepare(
					`INSERT INTO reconciliation_periods (id, account_id, period_start, period_end, cadence, opening_balance_paise, closing_balance_paise, harboured_at)
					 VALUES (?, ?, ?, ?, 'monthly', 7000000, 9200000, datetime('now'))`
				)
				.bind(pid, acc, `${y}-${pad(mm + 1)}-01`, `${y}-${pad(mm + 1)}-${pad(lastDay)}`)
		);
		const hist: Array<[string | null, number, string, number, string, number]> = [
			[C('Salary'), 8500000, 'Salary', 1, 'tap', 0],
			[C('Rent'), -1800000, 'Rent', 3, 'tap', 0],
			[C('Investments'), -1000000, 'SIP - Nifty index', 5, 'tap', 0],
			[C('Groceries'), -640000, 'Monthly groceries', 6, 'tap', 0],
			[C('Food & Dining'), -520000, 'Restaurants', 15, 'voice', 0],
			[C('Bills & Utilities'), -360000, 'Electricity + water', 19, 'tap', 0],
			[C('Transport'), -420000, 'Fuel + cabs', 24, 'tap', 0],
			[C('Uncategorized'), -150000, 'Cash spends', 27, 'tap', 1],
			[C('Uncategorized'), drift, 'Harbour adjustment', lastDay, 'tap', 1]
		];
		for (const [cid, amt, desc, day, src, fb] of hist) {
			writes.push(tx(cid, amt, desc, utcNoon(y, mm, day), src, pid, fb, desc === 'Harbour adjustment' ? null : who()));
		}
	}

	// Current month (unassigned = the forgiving model). Mix of tap and voice,
	// one uncategorized gap. Days clamp to today, so it always looks current.
	const cur: Array<[string, number, string, number, string]> = [
		['Rent', -1800000, 'Rent', 3, 'tap'],
		['Investments', -1000000, 'SIP - Nifty index', 5, 'tap'],
		['Food & Dining', -180000, 'Restaurant dinner', 6, 'tap'],
		['Health', -500000, 'Health insurance', 7, 'tap'],
		['Entertainment', -90000, 'BookMyShow', 9, 'voice'],
		['Plants & Garden', -60000, 'Nursery plants', 11, 'tap'],
		['Transport', -250000, 'Fuel', 12, 'tap'],
		['Uncategorized', -350000, 'Cash spends', 12, 'tap'],
		['Home', -120000, 'Cleaning supplies', 14, 'tap'],
		['Health', -65000, 'Pharmacy', 15, 'tap'],
		['Entertainment', -64900, 'Netflix', 18, 'tap'],
		['Bills & Utilities', -280000, 'Electricity', 22, 'tap'],
		['Bills & Utilities', -89900, 'Jio recharge', 22, 'tap'],
		['Shopping', -349900, 'Myntra order', 23, 'tap'],
		['Groceries', -550000, 'BigBasket weekly', 24, 'tap'],
		['Transport', -220000, 'Fuel', 25, 'voice'],
		['Food & Dining', -26000, 'Chai and snacks', 26, 'voice'],
		['Transport', -12000, 'Auto to office', 27, 'voice'],
		['Food & Dining', -52000, 'Swiggy dinner', 27, 'voice'],
		['Groceries', -110000, 'Vegetables', 28, 'voice']
	];
	for (const [name, amt, desc, day, src] of cur) {
		writes.push(tx(C(name), amt, desc, utcNoon(Y, Mo, day), src, null, 0, who()));
	}

	// Obligations (small, genuinely upcoming), recurring income, portfolio.
	const obl = (name: string, amt: number, cat: string | null) =>
		db
			.prepare("INSERT INTO obligations (user_id, household_id, name, amount_paise, category_id, cadence, is_active) VALUES (?, ?, ?, ?, ?, 'monthly', 1)")
			.bind(userId, userId, name, amt, cat);
	writes.push(obl('Internet (ACT)', 119900, C('Bills & Utilities')));
	writes.push(obl('Mobile postpaid', 99900, C('Bills & Utilities')));
	writes.push(obl('Gym membership', 200000, C('Health')));

	const inc = (name: string, amt: number, anchorKind: string, anchorDay: number | null) =>
		db
			.prepare("INSERT INTO recurring_income (household_id, user_id, name, amount_paise, anchor_kind, anchor_day, category_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)")
			.bind(userId, userId, name, amt, anchorKind, anchorDay, C('Salary'));
	writes.push(inc('Salary', 8500000, 'day_of_month', 1));
	writes.push(inc('Freelance', 1000000, 'end_of_month', null));

	const holding = (name: string, kind: string, value: number, sort: number) =>
		db
			.prepare('INSERT INTO holdings (household_id, user_id, name, kind, value_paise, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
			.bind(userId, userId, name, kind, value, sort);
	writes.push(holding('Nifty 50 Index Fund', 'mutual_fund', 45000000, 0));
	writes.push(holding('Parag Parikh Flexi Cap', 'mutual_fund', 28000000, 1));
	writes.push(holding('Reliance + HDFC', 'stock', 12000000, 2));
	writes.push(holding('PPF', 'ppf_epf', 32000000, 3));
	writes.push(holding('SBI Fixed Deposit', 'fd_rd', 20000000, 4));
	writes.push(holding('Digital Gold', 'gold', 8500000, 5));
	writes.push(holding('Emergency Fund', 'cash', 15000000, 6));

	// Six month-end portfolio snapshots, rising, ending near the holdings total.
	const snapVals = [120000000, 128000000, 134000000, 142000000, 151000000, 160500000];
	for (let i = 0; i < 6; i++) {
		const d = new Date(Date.UTC(Y, Mo - (5 - i) + 1, 0)); // month-end
		writes.push(
			db
				.prepare('INSERT INTO portfolio_snapshots (household_id, snapshot_date, total_paise) VALUES (?, ?, ?)')
				.bind(userId, `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, snapVals[i])
		);
	}

	await db.batch(writes);
}

/**
 * Delete demo users (and all their data) older than maxAgeHours. Safe to run on
 * a schedule. Deletes child rows before parents. maxAgeHours is an integer we
 * control, interpolated into the interval (never user input).
 */
export async function purgeOldDemoUsers(db: D1Database, maxAgeMinutes = 10): Promise<void> {
	const mins = Math.max(1, Math.floor(maxAgeMinutes));
	const OLD = `(SELECT id FROM users WHERE id LIKE 'demo-%' AND created_at < datetime('now','-${mins} minutes'))`;
	const OLDACC = `(SELECT id FROM accounts WHERE user_id IN ${OLD})`;
	await db.batch([
		db.prepare(`DELETE FROM transactions WHERE account_id IN ${OLDACC}`),
		db.prepare(`DELETE FROM reconciliation_periods WHERE account_id IN ${OLDACC}`),
		db.prepare(`DELETE FROM holdings WHERE household_id IN ${OLD}`),
		db.prepare(`DELETE FROM portfolio_snapshots WHERE household_id IN ${OLD}`),
		db.prepare(`DELETE FROM recurring_income WHERE household_id IN ${OLD}`),
		db.prepare(`DELETE FROM obligations WHERE household_id IN ${OLD}`),
		db.prepare(`DELETE FROM voice_samples WHERE user_id IN ${OLD}`),
		db.prepare(`DELETE FROM categories WHERE household_id IN ${OLD}`),
		db.prepare(`DELETE FROM accounts WHERE user_id IN ${OLD}`),
		db.prepare(`DELETE FROM magic_link_tokens WHERE user_id IN ${OLD}`),
		db.prepare(`DELETE FROM sessions WHERE user_id IN ${OLD}`),
		db.prepare(`DELETE FROM entitlements WHERE user_id IN ${OLD}`),
		db.prepare(`DELETE FROM settings WHERE user_id IN ${OLD}`),
		db.prepare(`DELETE FROM household_invites WHERE household_id IN ${OLD}`),
		db.prepare(`DELETE FROM household_members WHERE household_id IN ${OLD} OR user_id IN ${OLD}`),
		db.prepare(`DELETE FROM households WHERE id IN ${OLD}`),
		db.prepare(`DELETE FROM users WHERE id IN ${OLD}`),
		// Throttle rows only matter for an hour; sweep anything older.
		db.prepare("DELETE FROM demo_throttle WHERE created_at < datetime('now','-2 hours')")
	]);
}
