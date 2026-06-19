import type { Category, NewCategory } from '$lib/types';

/**
 * List all non-deleted categories for a user, sorted by sort_order then name.
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
 */
export async function createCategory(db: D1Database, cat: NewCategory): Promise<Category> {
	const result = await db
		.prepare(
			'INSERT INTO categories (user_id, name, color, is_system, sort_order) VALUES (?, ?, ?, 0, 999) RETURNING *'
		)
		.bind(cat.user_id, cat.name, cat.color)
		.first<Category>();

	if (!result) throw new Error('Failed to create category');
	return result;
}

/**
 * Soft-delete a category. Refuses to delete system categories.
 */
export async function deleteCategory(db: D1Database, id: string, user_id: string): Promise<void> {
	const cat = await db
		.prepare(
			'SELECT is_system FROM categories WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1'
		)
		.bind(id, user_id)
		.first<{ is_system: 0 | 1 }>();

	if (!cat) throw new Error('Category not found');
	if (cat.is_system) throw new Error('Cannot delete system category');

	await db
		.prepare("UPDATE categories SET deleted_at = datetime('now') WHERE id = ?")
		.bind(id)
		.run();
}
