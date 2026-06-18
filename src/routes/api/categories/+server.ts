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
	void db;
	// TODO(sonnet): call listCategories(db, locals.userId) and return json.
	throw error(501, 'Not implemented');
};

export const POST: RequestHandler = async ({ platform, locals, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const body = NewCategorySchema.safeParse(await request.json());
	if (!body.success) throw error(400, body.error.message);
	void db;
	// TODO(sonnet): call createCategory, return 201.
	throw error(501, 'Not implemented');
};
