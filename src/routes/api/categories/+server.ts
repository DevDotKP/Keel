import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import { listCategories, createCategory } from '$lib/server/queries/categories';

const NewCategorySchema = z.object({
	name: z.string().min(1).max(50),
	color: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
});

export const GET: RequestHandler = async ({ platform, locals }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const categories = await listCategories(db, locals.userId);
	return json(categories);
};

export const POST: RequestHandler = async ({ platform, locals, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const body = NewCategorySchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid name or colour');

	try {
		const cat = await createCategory(db, { user_id: locals.userId, ...body.data });
		return json(cat, { status: 201 });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Failed to create';
		if (msg.includes('UNIQUE')) {
			throw error(409, 'Category name already exists');
		}
		throw error(500, msg);
	}
};
