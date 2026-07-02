import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { sha256 } from '$lib/server/auth';
import { generateRecoveryCode, normalizeRecoveryCode } from '$lib/server/password';
import { isDemoUser } from '$lib/server/demo';

// Generate (or rotate) the signed-in user's recovery code. Covers accounts
// created before recovery codes existed, and anyone who lost theirs while
// still signed in. Shown once; only the hash is stored.
export const POST: RequestHandler = async ({ platform, locals }) => {
	if (!locals.userId) throw error(401, 'Sign in required');
	if (isDemoUser(locals.userId)) throw error(403, 'Not available in the demo');

	const db = getDb(platform);
	const code = generateRecoveryCode();
	const hash = await sha256(normalizeRecoveryCode(code));
	await db
		.prepare('UPDATE users SET recovery_code_hash = ? WHERE id = ?')
		.bind(hash, locals.userId)
		.run();

	return json({ ok: true, recovery_code: code });
};
