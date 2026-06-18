import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import { harbourPeriod } from '$lib/server/queries/periods';

const HarbourSchema = z.object({
	closing_balance_paise: z.number().int(),
	fresh_start: z.boolean().default(false)
});

export const POST: RequestHandler = async ({ platform, locals, params, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const body = HarbourSchema.safeParse(await request.json());
	if (!body.success) throw error(400, body.error.message);
	void db;
	// TODO(sonnet): verify the period belongs to this user's account,
	// call harbourPeriod(db, params.id, account_id, closing_balance_paise, { freshStart }).
	throw error(501, 'Not implemented');
};
