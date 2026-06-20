import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import { softDeleteTransaction, updateTransaction } from '$lib/server/queries/transactions';
import { getDefaultAccount } from '$lib/server/queries/accounts';

const PatchSchema = z.object({
	amount_paise: z.number().int().positive(),
	category_id: z.string(),
	description: z.string().max(200).default(''),
	note: z.string().max(500).default(''),
	occurred_at: z.string().datetime({ offset: true })
});

export const PATCH: RequestHandler = async ({ platform, locals, params, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const parsed = PatchSchema.safeParse(await request.json());
	if (!parsed.success) throw error(400, parsed.error.message);
	const account = await getDefaultAccount(db, locals.userId);
	if (!account) throw error(409, 'No account for user');

	// Resolve sign from category kind (same logic as POST).
	const cat = await db
		.prepare('SELECT kind FROM categories WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
		.bind(parsed.data.category_id, locals.userId)
		.first<{ kind: string }>();
	if (!cat) throw error(400, 'Unknown category');
	const amount_paise = cat.kind === 'income' ? parsed.data.amount_paise : -parsed.data.amount_paise;

	await updateTransaction(db, params.id, account.id, {
		amount_paise,
		category_id: parsed.data.category_id,
		description: parsed.data.description,
		note: parsed.data.note,
		occurred_at: parsed.data.occurred_at
	});
	return new Response(null, { status: 204 });
};

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const account = await getDefaultAccount(db, locals.userId);
	if (!account) throw error(409, 'No account for user');
	await softDeleteTransaction(db, params.id, account.id);
	return new Response(null, { status: 204 });
};
