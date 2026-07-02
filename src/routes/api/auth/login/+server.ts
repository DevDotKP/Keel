import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import { createSession } from '$lib/server/auth';
import { verifyPassword } from '$lib/server/password';
import { ensureUserSetup } from '$lib/server/bootstrap';
import { rateLimited, clientIp } from '$lib/server/rate-limit';

const Schema = z.object({
	email: z.string().email().max(254),
	password: z.string().min(1).max(200)
});

export const POST: RequestHandler = async (event) => {
	const { platform, request } = event;
	const body = Schema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Enter your email and password');

	const db = getDb(platform);
	// Two buckets: per-IP stops broad spraying, per-email stops a targeted
	// brute force from many IPs.
	const email = body.data.email.toLowerCase().trim();
	if (
		(await rateLimited(db, `login:${clientIp(request)}`, 20, 15)) ||
		(await rateLimited(db, `login:${email}`, 10, 15))
	) {
		throw error(429, 'Too many attempts. Wait a few minutes and try again.');
	}

	const user = await db
		.prepare('SELECT id, google_sub, password_hash FROM users WHERE email = ? LIMIT 1')
		.bind(email)
		.first<{ id: string; google_sub: string | null; password_hash: string | null }>();

	// One generic failure message: never reveal whether the email exists.
	const fail = () => error(401, 'Wrong email or password.');

	if (!user) throw fail();
	if (!user.password_hash) {
		// Google-only account: no password to check. Same generic message would
		// strand a real owner, so route them to the right button instead.
		if (user.google_sub) {
			throw error(409, 'This email is registered with Google. Use "Continue with Google".');
		}
		throw fail();
	}
	if (!(await verifyPassword(body.data.password, user.password_hash))) throw fail();

	await ensureUserSetup(db, user.id, email);
	await createSession(db, event, user.id);

	return json({ ok: true });
};
