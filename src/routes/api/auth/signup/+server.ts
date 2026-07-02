import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import { createSession } from '$lib/server/auth';
import { hashPassword } from '$lib/server/password';
import { ensureUserSetup } from '$lib/server/bootstrap';
import { rateLimited, clientIp } from '$lib/server/rate-limit';

const Schema = z.object({
	email: z.string().email().max(254),
	password: z.string().min(8, 'Password must be at least 8 characters').max(200)
});

// Create an account with email + password and start a session.
// No email verification: without a sending domain we cannot deliver mail, so
// possession of the inbox is not provable. Acceptable trade-off: the email is
// only an identity label here, never a recovery or notification channel.
export const POST: RequestHandler = async (event) => {
	const { platform, request } = event;
	const body = Schema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, body.error.issues[0]?.message ?? 'Invalid email or password');

	const db = getDb(platform);
	if (await rateLimited(db, `signup:${clientIp(request)}`, 10, 60)) {
		throw error(429, 'Too many sign-ups from your network. Try again in a while.');
	}

	const email = body.data.email.toLowerCase().trim();
	const existing = await db
		.prepare('SELECT id, google_sub, password_hash FROM users WHERE email = ? LIMIT 1')
		.bind(email)
		.first<{ id: string; google_sub: string | null; password_hash: string | null }>();

	if (existing) {
		// Don't leak which auth method the account uses beyond what's needed to
		// route the user to the right button.
		if (existing.google_sub && !existing.password_hash) {
			throw error(409, 'This email is registered with Google. Use "Continue with Google".');
		}
		throw error(409, 'An account with this email already exists. Sign in instead.');
	}

	const password_hash = await hashPassword(body.data.password);
	await db
		.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
		.bind(email, password_hash)
		.run();
	const user = await db
		.prepare('SELECT id FROM users WHERE email = ? LIMIT 1')
		.bind(email)
		.first<{ id: string }>();
	if (!user) throw error(500, 'Could not create the account. Try again.');

	await ensureUserSetup(db, user.id, email);
	await createSession(db, event, user.id);

	return json({ ok: true }, { status: 201 });
};
