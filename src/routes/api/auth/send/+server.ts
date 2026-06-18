import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import { issueMagicLink } from '$lib/server/auth';

const SendSchema = z.object({ email: z.string().email() });

export const POST: RequestHandler = async ({ platform, request }) => {
	const db = getDb(platform);
	const body = SendSchema.safeParse(await request.json());
	if (!body.success) throw error(400, 'Valid email required');
	void db;
	// TODO(sonnet): call issueMagicLink(db, body.data.email),
	// return 200 regardless of whether the email exists (don't leak user presence).
	throw error(501, 'Not implemented');
};
