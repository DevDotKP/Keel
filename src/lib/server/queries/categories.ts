import type { Category, CategoryTree, NewCategory, CategoryBucket } from '$lib/types';

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
 * List categories as a two-level tree (top-level categories with their children).
 */
export async function listCategoryTree(db: D1Database, user_id: string): Promise<CategoryTree[]> {
	const all = await listCategories(db, user_id);
	const tops = all.filter((c) => !c.parent_id);
	const byParent = new Map<string, Category[]>();
	for (const c of all) {
		if (c.parent_id) {
			const arr = byParent.get(c.parent_id) ?? [];
			arr.push(c);
			byParent.set(c.parent_id, arr);
		}
	}
	return tops.map((t) => ({ ...t, children: byParent.get(t.id) ?? [] }));
}

/**
 * Create a new user-defined category. Subcategories may not themselves have
 * children (one level of nesting only).
 */
export async function createCategory(db: D1Database, cat: NewCategory): Promise<Category> {
	// Enforce single-level nesting: a parent must itself be top-level.
	if (cat.parent_id) {
		const parent = await db
			.prepare('SELECT parent_id FROM categories WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
			.bind(cat.parent_id, cat.user_id)
			.first<{ parent_id: string | null }>();
		if (!parent) throw new Error('Parent category not found');
		if (parent.parent_id) throw new Error('Categories can only nest one level deep');
	}

	const result = await db
		.prepare(
			`INSERT INTO categories
			   (user_id, name, color, is_system, sort_order, parent_id, bucket, daily_reserve_paise, kind)
			 VALUES (?, ?, ?, 0, 999, ?, ?, ?, ?) RETURNING *`
		)
		.bind(
			cat.user_id,
			cat.name,
			cat.color,
			cat.parent_id ?? null,
			cat.bucket ?? 'flexible',
			cat.daily_reserve_paise ?? 0,
			cat.kind ?? 'expense'
		)
		.first<Category>();

	if (!result) throw new Error('Failed to create category');
	return result;
}

/**
 * Update a category's classification: bucket and daily reserve. Name/color too.
 * System categories may have their bucket and reserve changed but not be deleted.
 */
export async function updateCategory(
	db: D1Database,
	id: string,
	user_id: string,
	fields: { bucket?: CategoryBucket; daily_reserve_paise?: number; name?: string; color?: string }
): Promise<Category> {
	const sets: string[] = [];
	const binds: unknown[] = [];
	if (fields.bucket !== undefined) {
		sets.push('bucket = ?');
		binds.push(fields.bucket);
	}
	if (fields.daily_reserve_paise !== undefined) {
		sets.push('daily_reserve_paise = ?');
		binds.push(fields.daily_reserve_paise);
	}
	if (fields.name !== undefined) {
		sets.push('name = ?');
		binds.push(fields.name);
	}
	if (fields.color !== undefined) {
		sets.push('color = ?');
		binds.push(fields.color);
	}
	if (sets.length === 0) throw new Error('No fields to update');

	binds.push(id, user_id);
	const result = await db
		.prepare(
			`UPDATE categories SET ${sets.join(', ')} WHERE id = ? AND user_id = ? AND deleted_at IS NULL RETURNING *`
		)
		.bind(...binds)
		.first<Category>();

	if (!result) throw new Error('Category not found');
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

	// Soft-delete the category and any subcategories under it, in one batch.
	await db.batch([
		db.prepare("UPDATE categories SET deleted_at = datetime('now') WHERE id = ?").bind(id),
		db
			.prepare("UPDATE categories SET deleted_at = datetime('now') WHERE parent_id = ? AND user_id = ?")
			.bind(id, user_id)
	]);
}
