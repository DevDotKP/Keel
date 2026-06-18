import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import { listTransactions, insertTransaction } from '$lib/server/queries/transactions';

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
	void db;
	// TODO(sonnet): resolve account_id from userId, call listTransactions,
	// support ?limit= and ?period_id= query params.
	throw error(501, 'Not implemented');
};

export const POST: RequestHandler = async ({ platform, locals, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const body = NewTransactionSchema.safeParse(await request.json());
	if (!body.success) throw error(400, body.error.message);
	void db;
	// TODO(sonnet): resolve account_id from userId, resolve category_id to
	// Uncategorized if omitted, call insertTransaction, return 201.
	throw error(501, 'Not implemented');
};
