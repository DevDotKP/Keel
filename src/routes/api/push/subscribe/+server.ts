import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';

const SubSchema = z.object({
	endpoint: z.string().url(),
	keys: z.object({
		p256dh: z.string().min(1),
		auth: z.string().min(1)
	})
});

// Register this device's push subscription. Re-subscribing with the same
// endpoint just re-points it at the current user (endpoint is unique).
export const POST: RequestHandler = async ({ platform, locals, request }) => {
	if (!locals.userId) throw error(401, 'Sign in required');
	const body = SubSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid subscription');

	const db = getDb(platform);
	const { endpoint, keys } = body.data;
	await db
		.prepare(
			`INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
			 VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id,
				p256dh = excluded.p256dh, auth = excluded.auth`
		)
		.bind(crypto.randomUUID(), locals.userId, endpoint, keys.p256dh, keys.auth)
		.run();

	return json({ ok: true });
};

const UnsubSchema = z.object({ endpoint: z.string().url() });

export const DELETE: RequestHandler = async ({ platform, locals, request }) => {
	if (!locals.userId) throw error(401, 'Sign in required');
	const body = UnsubSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid request');

	const db = getDb(platform);
	await db
		.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?')
		.bind(body.data.endpoint, locals.userId)
		.run();

	return json({ ok: true });
};
