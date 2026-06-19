import { getDefaultAccount } from '$lib/server/queries/accounts';

// DEV ONLY. Give the preview user a realistic opening balance, a few user
// categories, and sample expenses so the UI looks populated. Runs once and skips
// if the account already has transactions. Never called from production paths.
export async function seedDevSampleData(db: D1Database, userId: string): Promise<void> {
	const account = await getDefaultAccount(db, userId);
	if (!account) return;

	const existing = await db
		.prepare('SELECT 1 FROM transactions WHERE account_id = ? LIMIT 1')
		.bind(account.id)
		.first();
	if (existing) return;

	// Realistic opening balance: Rs 50,000.
	await db.prepare('UPDATE accounts SET balance_paise = 5000000 WHERE id = ?').bind(account.id).run();

	// Food is committed with a Rs 120/day reserve so the "safe to spend" view has
	// something to lock. Transport committed at Rs 50/day. Others flexible.
	await db.batch([
		db
			.prepare(
				"INSERT OR IGNORE INTO categories (user_id, name, color, is_system, sort_order, bucket, daily_reserve_paise) VALUES (?, 'Food', '#C2683C', 0, 2, 'committed', 12000)"
			)
			.bind(userId),
		db
			.prepare(
				"INSERT OR IGNORE INTO categories (user_id, name, color, is_system, sort_order, bucket, daily_reserve_paise) VALUES (?, 'Transport', '#1B3A66', 0, 3, 'committed', 5000)"
			)
			.bind(userId),
		db
			.prepare(
				"INSERT OR IGNORE INTO categories (user_id, name, color, is_system, sort_order) VALUES (?, 'Groceries', '#2F7E72', 0, 4)"
			)
			.bind(userId),
		db
			.prepare(
				"INSERT OR IGNORE INTO categories (user_id, name, color, is_system, sort_order) VALUES (?, 'Bills', '#7C756A', 0, 5)"
			)
			.bind(userId)
	]);

	const { results } = await db
		.prepare('SELECT id, name FROM categories WHERE user_id = ? AND deleted_at IS NULL')
		.bind(userId)
		.all<{ id: string; name: string }>();
	const catId = (name: string) => results.find((c) => c.name === name)?.id ?? null;

	// A rent obligation: due once per period, unpaid so it shows as locked.
	await db
		.prepare(
			"INSERT INTO obligations (user_id, name, amount_paise, category_id, cadence) VALUES (?, 'Rent', 1500000, ?, 'monthly')"
		)
		.bind(userId, catId('Bills'))
		.run();

	const daysAgo = (n: number) => {
		const d = new Date();
		d.setDate(d.getDate() - n);
		return d.toISOString();
	};

	// Mostly expenses (negative); one salary credit (positive income) so the
	// income path is visible. All within the current cycle so they count.
	const samples: Array<[string | null, number, string, number]> = [
		[catId('Salary'), 8500000, 'Salary credit', 3],
		[catId('Transport'), -12000, 'Auto to office', 0],
		[catId('Food'), -38000, 'Swiggy dinner', 0],
		[catId('Groceries'), -145000, 'BigBasket weekly', 1],
		[catId('Food'), -9000, 'Chai and snacks', 1],
		[catId('Bills'), -89900, 'Jio recharge', 2],
		[catId('Uncategorized'), -25000, 'Cash spends', 2]
	];

	await db.batch(
		samples
			.filter(([id]) => id)
			.map(([id, amount, desc, n]) =>
				db
					.prepare(
						`INSERT INTO transactions
						   (account_id, category_id, period_id, amount_paise, description, occurred_at, source, is_uncategorized_fallback)
						 VALUES (?, ?, NULL, ?, ?, ?, 'tap', 0)`
					)
					.bind(account.id, id, amount, desc, daysAgo(n))
			)
	);
}
