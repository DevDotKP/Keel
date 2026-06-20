import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import { deleteCategory, updateCategory } from '$lib/server/queries/categories';

const PatchSchema = z.object({
	bucket: z.enum(['committed', 'flexible']).optional(),
	daily_reserve_paise: z.number().int().min(0).optional(),
	budget_paise: z.number().int().min(0).optional(),
	name: z.string().min(1).max(50).optional(),
	color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
});

export const PATCH: RequestHandler = async ({ platform, locals, params, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const body = PatchSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid payload');

	const hid = locals.householdId ?? locals.userId!;
	try {
		const updated = await updateCategory(db, params.id, hid, body.data);
		return json(updated);
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Update failed';
		if (msg.includes('not found')) throw error(404, 'Category not found');
		throw error(500, msg);
	}
};

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);

	const hid = locals.householdId ?? locals.userId!;
	try {
		await deleteCategory(db, params.id, hid);
		return new Response(null, { status: 204 });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Delete failed';
		if (msg.includes('system')) throw error(403, 'Cannot delete system category');
		if (msg.includes('not found')) throw error(404, 'Category not found');
		throw error(500, msg);
	}
};
