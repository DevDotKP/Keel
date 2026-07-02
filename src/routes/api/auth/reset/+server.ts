import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import { createSession, sha256 } from '$lib/server/auth';
import {
	hashPassword,
	generateRecoveryCode,
	normalizeRecoveryCode
} from '$lib/server/password';
import { safeEqual } from '$lib/server/admin';
import { rateLimited, clientIp } from '$lib/server/rate-limit';

const Schema = z.object({
	email: z.string().email().max(254),
	recovery_code: z.string().min(1).max(50),
	new_password: z.string().min(8, 'Password must be at least 8 characters').max(200)
});

// Reset a lost password with the recovery code. The code is single-use: a
// successful reset rotates it and returns the new one. All existing sessions
// are revoked so a leaked code can't quietly ride along.
export const POST: RequestHandler = async (event) => {
	const { platform, request } = event;
	const body = Schema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, body.error.issues[0]?.message ?? 'Invalid request');

	const db = getDb(platform);
	const email = body.data.email.toLowerCase().trim();
	// Tight limits: a recovery code is 64 bits, but nobody honest tries ten times.
	if (
		(await rateLimited(db, `reset:${clientIp(request)}`, 10, 60)) ||
		(await rateLimited(db, `reset:${email}`, 5, 60))
	) {
		throw error(429, 'Too many attempts. Wait a while and try again.');
	}

	const user = await db
		.prepare('SELECT id, recovery_code_hash FROM users WHERE email = ? LIMIT 1')
		.bind(email)
		.first<{ id: string; recovery_code_hash: string | null }>();

	// One generic message: don't reveal whether the email or the code was wrong.
	const providedHash = await sha256(normalizeRecoveryCode(body.data.recovery_code));
	if (!user?.recovery_code_hash || !safeEqual(providedHash, user.recovery_code_hash)) {
		throw error(401, 'That email and recovery code do not match.');
	}

	const newCode = generateRecoveryCode();
	const newCodeHash = await sha256(normalizeRecoveryCode(newCode));
	const password_hash = await hashPassword(body.data.new_password);
	await db.batch([
		db
			.prepare('UPDATE users SET password_hash = ?, recovery_code_hash = ? WHERE id = ?')
			.bind(password_hash, newCodeHash, user.id),
		db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id)
	]);

	await createSession(db, event, user.id);
	return json({ ok: true, recovery_code: newCode });
};
