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
	const baseUrl =
		platform?.env?.MAGIC_LINK_BASE_URL ?? (dev ? url.origin : 'https://keel.pages.dev');

	const result = await issueMagicLink(db, body.data.email, {
		baseUrl,
		resendApiKey: platform?.env?.RESEND_API_KEY,
		fromEmail: platform?.env?.MAGIC_LINK_FROM_EMAIL
	});

	// In dev only: return the token so the developer can paste it locally.
	// In production the email is the only delivery vector — token never leaves the server.
	return json({ ok: true, ...(dev && result.token ? { token: result.token } : {}) });
};
