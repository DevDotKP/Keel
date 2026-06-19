import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { softDeleteTransaction } from '$lib/server/queries/transactions';
import { getDefaultAccount } from '$lib/server/queries/accounts';

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const account = await getDefaultAccount(db, locals.userId);
	if (!account) throw error(409, 'No account for user');
	await softDeleteTransaction(db, params.id, account.id);
	return new Response(null, { status: 204 });
};
