import type { Category, NewCategory } from '$lib/types';

/**
 * List all non-deleted categories for a user, sorted by sort_order then name.
 * System categories (Uncategorized, Income) are always included.
 */
export async function listCategories(db: D1Database, user_id: string): Promise<Category[]> {
	const { results } = await db
		.prepare(
			'SELECT * FROM categories WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, name ASC'
		)
		.bind(user_id)
		.all<Category>();
	return results ?? [];
}

/**
 * Create a new user-defined category.
 * Enforces the unique-name-per-user constraint (DB will throw on violation).
 */
export async function createCategory(db: D1Database, cat: NewCategory): Promise<Category> {
	// TODO(sonnet): implement with the /categories page. INSERT ... RETURNING *,
	// catch the UNIQUE constraint violation and surface a friendly error.
	throw new Error('Not implemented');
}

/**
 * Soft-delete a category. Refuses to delete system categories (is_system = 1).
 */
export async function deleteCategory(db: D1Database, id: string, user_id: string): Promise<void> {
	// TODO(sonnet): implement with the /categories page. Verify is_system = 0 and
	// user_id matches, then set deleted_at.
	throw new Error('Not implemented');
}
