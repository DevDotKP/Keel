import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import { INDIAN_STATES } from '$lib/holidays';
import type { Settings } from '$lib/types';

const PatchSettingsSchema = z.object({
	harbour_cadence: z.enum(['weekly', 'fortnightly', 'monthly']).optional(),
	harbour_day: z.string().optional(),
	harbour_notify_at: z.string().regex(/^\d{2}:\d{2}$/).optional(),
	cycle_budget_paise: z.number().int().min(0).optional(),
	home_state: z.enum(INDIAN_STATES).nullable().optional()
});

export const GET: RequestHandler = async ({ platform, locals }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);

	const settings = await db
		.prepare('SELECT * FROM settings WHERE user_id = ? LIMIT 1')
		.bind(locals.userId)
		.first<Settings>();

	if (!settings) return json({ error: 'Settings not found' }, { status: 404 });
	return json(settings);
};

export const PATCH: RequestHandler = async ({ platform, locals, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const db = getDb(platform);
	const body = PatchSettingsSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid payload');

	const updates = body.data;
	const setClauses: string[] = [];
	const bindings: unknown[] = [];

	if (updates.harbour_cadence !== undefined) {
		setClauses.push('harbour_cadence = ?');
		bindings.push(updates.harbour_cadence);
	}
	if (updates.harbour_day !== undefined) {
		setClauses.push('harbour_day = ?');
		bindings.push(updates.harbour_day);
	}
	if (updates.harbour_notify_at !== undefined) {
		setClauses.push('harbour_notify_at = ?');
		bindings.push(updates.harbour_notify_at);
	}
	if (updates.cycle_budget_paise !== undefined) {
		setClauses.push('cycle_budget_paise = ?');
		bindings.push(updates.cycle_budget_paise);
	}
	if (updates.home_state !== undefined) {
		setClauses.push('home_state = ?');
		bindings.push(updates.home_state);
	}

	if (setClauses.length === 0) {
		return json({ error: 'No fields to update' }, { status: 400 });
	}

	bindings.push(locals.userId);
	const sql = `UPDATE settings SET ${setClauses.join(', ')} WHERE user_id = ?`;

	await db.prepare(sql).bind(...bindings).run();

	const updated = await db
		.prepare('SELECT * FROM settings WHERE user_id = ? LIMIT 1')
		.bind(locals.userId)
		.first<Settings>();

	return json(updated);
};
