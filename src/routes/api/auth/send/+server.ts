import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { dev } from '$app/environment';
import { getDb } from '$lib/server/db';
import { issueMagicLink } from '$lib/server/auth';

const SendSchema = z.object({ email: z.string().email() });

export const POST: RequestHandler = async ({ platform, request, url }) => {
	const body = SendSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Valid email required');

	const db = getDb(platform);

	// Rate limit: max 3 magic-link requests per email per 10 minutes.
	const existing = await db
		.prepare(
			`SELECT COUNT(*) AS n FROM magic_link_tokens
			 WHERE user_id = (SELECT id FROM users WHERE email = ? LIMIT 1)
			   AND created_at > datetime('now', '-10 minutes')`
		)
		.bind(body.data.email)
		.first<{ n: number }>();
	if ((existing?.n ?? 0) >= 3) throw error(429, 'Too many requests. Wait a few minutes.');

	const baseUrl = platform?.env?.MAGIC_LINK_BASE_URL ?? url.origin;

	const result = await issueMagicLink(db, body.data.email, {
		baseUrl,
		resendApiKey: platform?.env?.RESEND_API_KEY,
		fromEmail: platform?.env?.MAGIC_LINK_FROM_EMAIL
	});

	// In dev only: return the token so the developer can paste it locally.
	// Reveal the link to the client only in dev or closed-testing reveal mode.
	// In normal production the email is the only delivery vector.
	const reveal = dev || platform?.env?.MAGIC_LINK_REVEAL === 'true';
	return json({ ok: true, ...(reveal && result.token ? { token: result.token } : {}) });
};
