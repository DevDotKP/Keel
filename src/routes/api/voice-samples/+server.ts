import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';

const Schema = z.object({
	raw_transcript: z.string().min(1).max(500),
	parsed_json: z.string(), // AnchorParseResult (no PII, no balances)
	final_json: z.string(), // TransactionDraft confirmed by user (no PII, no balances)
	was_corrected: z.boolean()
});

export const POST: RequestHandler = async ({ platform, request, locals }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');

	const body = Schema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid payload');

	const db = getDb(platform);
	const { raw_transcript, parsed_json, final_json, was_corrected } = body.data;

	await db
		.prepare(
			'INSERT INTO voice_samples (user_id, raw_transcript, parsed_json, final_json, was_corrected) VALUES (?, ?, ?, ?, ?)'
		)
		.bind(locals.userId, raw_transcript, parsed_json, final_json, was_corrected ? 1 : 0)
		.run();

	return json({ ok: true }, { status: 201 });
};
