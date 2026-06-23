import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';

const RoleSchema = z.object({ role: z.enum(['admin', 'member']) });

async function requireAdmin(db: D1Database, hid: string, userId: string) {
	const me = await db
		.prepare('SELECT role FROM household_members WHERE household_id = ? AND user_id = ? LIMIT 1')
		.bind(hid, userId)
		.first<{ role: string }>();
	if (me?.role !== 'admin') throw error(403, 'Only admins can manage members');
}

async function getTarget(db: D1Database, hid: string, rowId: string) {
	const t = await db
		.prepare('SELECT id, user_id, role FROM household_members WHERE id = ? AND household_id = ? LIMIT 1')
		.bind(rowId, hid)
		.first<{ id: string; user_id: string; role: string }>();
	if (!t) throw error(404, 'Member not found');
	return t;
}

async function adminCount(db: D1Database, hid: string): Promise<number> {
	const r = await db
		.prepare("SELECT COUNT(*) AS n FROM household_members WHERE household_id = ? AND role = 'admin'")
		.bind(hid)
		.first<{ n: number }>();
	return r?.n ?? 0;
}

// Change a member's role. Cannot demote the last admin.
export const PATCH: RequestHandler = async ({ platform, locals, params, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const hid = locals.householdId ?? locals.userId;
	const db = getDb(platform);
	await requireAdmin(db, hid, locals.userId);

	const body = RoleSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid role');

	const target = await getTarget(db, hid, params.id);
	if (target.role === 'admin' && body.data.role === 'member' && (await adminCount(db, hid)) <= 1) {
		throw error(409, 'The household needs at least one admin');
	}

	await db
		.prepare('UPDATE household_members SET role = ? WHERE id = ? AND household_id = ?')
		.bind(body.data.role, target.id, hid)
		.run();
	return json({ ok: true });
};

// Remove a member. Cannot remove the last admin. Their entries stay in the ledger.
export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const hid = locals.householdId ?? locals.userId;
	const db = getDb(platform);
	await requireAdmin(db, hid, locals.userId);

	const target = await getTarget(db, hid, params.id);
	if (target.role === 'admin' && (await adminCount(db, hid)) <= 1) {
		throw error(409, 'Cannot remove the last admin');
	}

	await db
		.prepare('DELETE FROM household_members WHERE id = ? AND household_id = ?')
		.bind(target.id, hid)
		.run();
	return new Response(null, { status: 204 });
};
