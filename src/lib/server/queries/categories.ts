import type { Category, NewCategory } from '$lib/types';

/**
 * List all non-deleted categories for a user, sorted by sort_order then name.
 * System categories (Uncategorized, Income) are always included.
 */
export async function listCategories(db: D1Database, user_id: string): Promise<Category[]> {
	// TODO(sonnet): SELECT * FROM categories WHERE user_id = ? AND deleted_at IS NULL
	// ORDER BY sort_order ASC, name ASC
	throw new Error('Not implemented');
}

/**
 * Create a new user-defined category.
 * Enforces the unique-name-per-user constraint (DB will throw on violation).
 * Returns the created row.
 */
export async function createCategory(db: D1Database, cat: NewCategory): Promise<Category> {
	// TODO(sonnet): INSERT INTO categories with generated id, is_system = 0.
	// Catch UNIQUE constraint violation and surface as a friendly error.
	throw new Error('Not implemented');
}

/**
 * Soft-delete a category.
 * Refuses to delete system categories (is_system = 1).
 * Leaves existing transactions pointing to this category intact.
 */
export async function deleteCategory(
	db: D1Database,
	id: string,
	user_id: string
): Promise<void> {
	// TODO(sonnet): verify is_system = 0 and user_id matches, then
	// UPDATE categories SET deleted_at = datetime('now') WHERE id = ? AND user_id = ?
	throw new Error('Not implemented');
}
