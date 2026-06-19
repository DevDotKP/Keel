import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { deleteCategory } from '$lib/server/queries/categories';

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);

	try {
		await deleteCategory(db, params.id, locals.userId);
		return new Response(null, { status: 204 });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Delete failed';
		if (msg.includes('system')) throw error(403, 'Cannot delete system category');
		if (msg.includes('not found')) throw error(404, 'Category not found');
		throw error(500, msg);
	}
};
