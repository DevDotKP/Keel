// Idempotent per-user setup: user row, default settings, entitlement, a default
// account, the system categories (Uncategorized, Income) and a starter set of
// spending categories. Real signup calls this once after magic-link verify. In
// dev, hooks.server.ts calls it so the preview user always has data to show.

// Starter spending categories every new user gets. Deletable. Committed ones are
// the typical essentials; users set a daily reserve later if they want one.
const DEFAULT_SPENDING_CATEGORIES: Array<{ name: string; color: string; bucket: 'committed' | 'flexible' }> = [
	{ name: 'Food & Dining', color: '#C2683C', bucket: 'flexible' },
	{ name: 'Groceries', color: '#5FA85D', bucket: 'committed' },
	{ name: 'Transport', color: '#1B3A66', bucket: 'committed' },
	{ name: 'Bills & Utilities', color: '#7C756A', bucket: 'committed' },
	{ name: 'Shopping', color: '#8B6DBF', bucket: 'flexible' },
	{ name: 'Home', color: '#9C6B4A', bucket: 'flexible' },
	{ name: 'Plants & Garden', color: '#4E8B5A', bucket: 'flexible' },
	{ name: 'Health', color: '#2F7E72', bucket: 'flexible' },
	{ name: 'Entertainment', color: '#E07B54', bucket: 'flexible' },
	{ name: 'Rent', color: '#374151', bucket: 'committed' },
	{ name: 'Investments', color: '#1B5E8B', bucket: 'committed' }
];

export async function ensureUserSetup(
	db: D1Database,
	userId: string,
	email: string
): Promise<void> {
	// householdId = userId for personal setups (migration convention).
	const householdId = userId;

	await db.batch([
		db.prepare('INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)').bind(userId, email),
		// Personal household: id = userId so account/category queries work without a join.
		db.prepare("INSERT OR IGNORE INTO households (id, name, created_by) VALUES (?, 'Personal', ?)").bind(householdId, userId),
		db.prepare("INSERT OR IGNORE INTO household_members (household_id, user_id, role) VALUES (?, ?, 'admin')").bind(householdId, userId),
		// India-first default cadence: monthly (salary and rent cycles).
		db
			.prepare("INSERT OR IGNORE INTO settings (user_id, harbour_cadence) VALUES (?, 'monthly')")
			.bind(userId),
		db
			.prepare(
				"INSERT OR IGNORE INTO entitlements (user_id, status, provider) VALUES (?, 'trialing', 'local')"
			)
			.bind(userId),
		// Uncategorized and Income: system categories, undeletable.
		db
			.prepare(
				"INSERT OR IGNORE INTO categories (user_id, household_id, name, color, is_system, sort_order, kind) VALUES (?, ?, 'Uncategorized', '#E0A82E', 1, 0, 'expense')"
			)
			.bind(userId, householdId),
		db
			.prepare(
				"INSERT OR IGNORE INTO categories (user_id, household_id, name, color, is_system, sort_order, kind) VALUES (?, ?, 'Income', '#2F7E72', 1, 1, 'income')"
			)
			.bind(userId, householdId),
		db
			.prepare(
				"INSERT OR IGNORE INTO categories (user_id, household_id, name, color, is_system, sort_order, kind) VALUES (?, ?, 'Salary', '#2F7E72', 0, 2, 'income')"
			)
			.bind(userId, householdId),
		...DEFAULT_SPENDING_CATEGORIES.map((c, i) =>
			db
				.prepare(
					"INSERT OR IGNORE INTO categories (user_id, household_id, name, color, is_system, sort_order, kind, bucket, daily_reserve_paise) VALUES (?, ?, ?, ?, 0, ?, 'expense', ?, 0)"
				)
				.bind(userId, householdId, c.name, c.color, 10 + i, c.bucket)
		)
	]);

	// Default account, created only if the user has none.
	const account = await db
		.prepare('SELECT id FROM accounts WHERE user_id = ? AND deleted_at IS NULL LIMIT 1')
		.bind(userId)
		.first<{ id: string }>();
	if (!account) {
		await db
			.prepare("INSERT INTO accounts (user_id, household_id, name, balance_paise) VALUES (?, ?, 'Spending', 0)")
			.bind(userId, householdId)
			.run();
	}
}
