import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';

// Whitelist, not free-form: events answer specific funnel questions and
// nothing else lands in the table. Name + user + time only; no payloads.
const Schema = z.object({
	name: z.enum(['settle_open', 'settle_view'])
});

export const POST: RequestHandler = async ({ platform, locals, request }) => {
	if (!locals.userId) throw error(401, 'Sign in required');
	const body = Schema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Unknown event');

	await getDb(platform)
		.prepare('INSERT INTO app_events (user_id, name) VALUES (?, ?)')
		.bind(locals.userId, body.data.name)
		.run();
	return json({ ok: true });
};
