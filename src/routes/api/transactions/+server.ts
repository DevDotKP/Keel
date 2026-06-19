import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import { listTransactions, insertTransaction } from '$lib/server/queries/transactions';
import { getDefaultAccount } from '$lib/server/queries/accounts';

const NewTransactionSchema = z.object({
	category_id: z.string().optional(),
	amount_paise: z.number().int(),
	description: z.string().default(''),
	occurred_at: z.string().datetime({ offset: true }),
	source: z.enum(['tap', 'voice']).default('tap')
});

export const GET: RequestHandler = async ({ platform, locals, url }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const account = await getDefaultAccount(db, locals.userId);
	if (!account) return json([]);
	const limit = Number(url.searchParams.get('limit')) || 50;
	const period_id = url.searchParams.get('period_id') ?? undefined;
	const txns = await listTransactions(db, { account_id: account.id, limit, period_id });
	return json(txns);
};

export const POST: RequestHandler = async ({ platform, locals, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const parsed = NewTransactionSchema.safeParse(await request.json());
	if (!parsed.success) throw error(400, parsed.error.message);

	const account = await getDefaultAccount(db, locals.userId);
	if (!account) throw error(409, 'No account for user');

	// Resolve category: the given one, else the Uncategorized system category.
	let categoryId = parsed.data.category_id;
	let categoryName: string;
	if (categoryId) {
		const cat = await db
			.prepare('SELECT name FROM categories WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
			.bind(categoryId, locals.userId)
			.first<{ name: string }>();
		if (!cat) throw error(400, 'Unknown category');
		categoryName = cat.name;
	} else {
		const uncat = await db
			.prepare(
				"SELECT id FROM categories WHERE user_id = ? AND name = 'Uncategorized' AND deleted_at IS NULL"
			)
			.bind(locals.userId)
			.first<{ id: string }>();
		if (!uncat) throw error(500, 'Uncategorized category missing');
		categoryId = uncat.id;
		categoryName = 'Uncategorized';
	}

	// Income is positive; everything else is an expense (negative).
	const magnitude = Math.abs(parsed.data.amount_paise);
	const amount_paise = categoryName === 'Income' ? magnitude : -magnitude;

	const tx = await insertTransaction(db, {
		account_id: account.id,
		category_id: categoryId,
		amount_paise,
		description: parsed.data.description,
		occurred_at: parsed.data.occurred_at,
		source: parsed.data.source
	});
	return json(tx, { status: 201 });
};
