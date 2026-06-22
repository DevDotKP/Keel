import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';

// ~150KB of base64. Avatars are resized to a small square client-side; this is a
// server-side backstop so a crafted request cannot store a huge blob.
const MAX_AVATAR = 200_000;

const PatchSchema = z.object({
	display_name: z.string().max(60).nullable().optional(),
	avatar: z
		.string()
		.max(MAX_AVATAR)
		.regex(/^data:image\/(png|jpeg|webp);base64,/, 'Invalid image')
		.nullable()
		.optional()
});

export const PATCH: RequestHandler = async ({ platform, locals, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const body = PatchSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid profile');
	const db = getDb(platform);

	const sets: string[] = [];
	const binds: unknown[] = [];
	if (body.data.display_name !== undefined) {
		sets.push('display_name = ?');
		binds.push(body.data.display_name?.trim() || null);
	}
	if (body.data.avatar !== undefined) {
		sets.push('avatar = ?');
		binds.push(body.data.avatar); // null removes it
	}
	if (sets.length === 0) return json({ ok: true });

	binds.push(locals.userId);
	await db
		.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`)
		.bind(...binds)
		.run();
	return json({ ok: true });
};
