import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';

const PatchSettingsSchema = z.object({
	harbour_cadence: z.enum(['weekly', 'fortnightly', 'monthly']).optional(),
	harbour_day: z.string().optional(),
	harbour_notify_at: z.string().regex(/^\d{2}:\d{2}$/).optional()
});

export const GET: RequestHandler = async ({ platform, locals }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	void db;
	// TODO(sonnet): SELECT * FROM settings WHERE user_id = ? return json.
	throw error(501, 'Not implemented');
};

export const PATCH: RequestHandler = async ({ platform, locals, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const body = PatchSettingsSchema.safeParse(await request.json());
	if (!body.success) throw error(400, body.error.message);
	void db;
	// TODO(sonnet): UPDATE settings SET ... WHERE user_id = ?, return updated row.
	throw error(501, 'Not implemented');
};
