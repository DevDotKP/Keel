import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import { listTransactions, insertTransaction } from '$lib/server/queries/transactions';
import { getDefaultAccount } from '$lib/server/queries/accounts';
import { notifyHouseholdOfEntry } from '$lib/server/queries/notify';

const NewTransactionSchema = z.object({
	category_id: z.string().optional(),
	amount_paise: z.number().int().positive(),
	description: z.string().default(''),
	note: z.string().max(500).default(''),
	occurred_at: z.string().datetime({ offset: true }),
	source: z.enum(['tap', 'voice']).default('tap')
});

export const GET: RequestHandler = async ({ platform, locals, url }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const account = await getDefaultAccount(db, locals.householdId ?? locals.userId!);
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

	const account = await getDefaultAccount(db, locals.householdId ?? locals.userId!);
	if (!account) throw error(409, 'No account for user');

	// Resolve category: the given one, else the Uncategorized system category.
	let categoryId = parsed.data.category_id;
	let categoryKind: string;
	const hid = locals.householdId ?? locals.userId!;
	if (categoryId) {
		const cat = await db
			.prepare('SELECT kind FROM categories WHERE id = ? AND household_id = ? AND deleted_at IS NULL')
			.bind(categoryId, hid)
			.first<{ kind: string }>();
		if (!cat) throw error(400, 'Unknown category');
		categoryKind = cat.kind;
	} else {
		const uncat = await db
			.prepare(
				"SELECT id FROM categories WHERE household_id = ? AND name = 'Uncategorized' AND deleted_at IS NULL"
			)
			.bind(hid)
			.first<{ id: string }>();
		if (!uncat) throw error(500, 'Uncategorized category missing');
		categoryId = uncat.id;
		categoryKind = 'expense';
	}

	const magnitude = Math.abs(parsed.data.amount_paise);
	const amount_paise = categoryKind === 'income' ? magnitude : -magnitude;

	const tx = await insertTransaction(db, {
		account_id: account.id,
		category_id: categoryId,
		amount_paise,
		description: parsed.data.description,
		note: parsed.data.note,
		occurred_at: parsed.data.occurred_at,
		source: parsed.data.source,
		entered_by: locals.userId
	});

	// Let other household members know, in the background (never blocks the save).
	const waitUntil = platform?.context?.waitUntil?.bind(platform.context);
	const notify = notifyHouseholdOfEntry(db, platform?.env ?? {}, {
		householdId: hid,
		adderId: locals.userId,
		amountPaise: amount_paise,
		description: parsed.data.description
	}).catch(() => {});
	if (waitUntil) waitUntil(notify);

	return json(tx, { status: 201 });
};
