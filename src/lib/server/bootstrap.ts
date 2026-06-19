// Idempotent per-user setup: user row, default settings, entitlement, a default
// account, and the two system categories (Uncategorized, Income). Real signup
// calls this once after magic-link verify. In dev, hooks.server.ts calls it so the
// preview user always has data to show.

export async function ensureUserSetup(
	db: D1Database,
	userId: string,
	email: string
): Promise<void> {
	await db.batch([
		db.prepare('INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)').bind(userId, email),
		// India-first default cadence: monthly (salary and rent cycles).
		db
			.prepare("INSERT OR IGNORE INTO settings (user_id, harbour_cadence) VALUES (?, 'monthly')")
			.bind(userId),
		db
			.prepare(
				"INSERT OR IGNORE INTO entitlements (user_id, status, provider) VALUES (?, 'trialing', 'local')"
			)
			.bind(userId),
		// Uncategorized: calm gold dot. Income: muted teal. Both undeletable (is_system = 1).
		db
			.prepare(
				"INSERT OR IGNORE INTO categories (user_id, name, color, is_system, sort_order) VALUES (?, 'Uncategorized', '#E0A82E', 1, 0)"
			)
			.bind(userId),
		db
			.prepare(
				"INSERT OR IGNORE INTO categories (user_id, name, color, is_system, sort_order) VALUES (?, 'Income', '#2F7E72', 1, 1)"
			)
			.bind(userId)
	]);

	// Default account, created only if the user has none.
	const account = await db
		.prepare('SELECT id FROM accounts WHERE user_id = ? AND deleted_at IS NULL LIMIT 1')
		.bind(userId)
		.first<{ id: string }>();
	if (!account) {
		await db
			.prepare("INSERT INTO accounts (user_id, name, balance_paise) VALUES (?, 'Spending', 0)")
			.bind(userId)
			.run();
	}
}
