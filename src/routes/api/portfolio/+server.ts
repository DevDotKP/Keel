import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb, getReadDb } from '$lib/server/db';
import { listHoldings, listSnapshots, createHolding, snapshotToday } from '$lib/server/queries/portfolio';
import { today } from '$lib/utils/date';

const KINDS = [
	'mutual_fund',
	'stock',
	'fd_rd',
	'ppf_epf',
	'gold',
	'crypto',
	'real_estate',
	'cash',
	'other'
] as const;

const CreateSchema = z.object({
	name: z.string().min(1).max(60),
	kind: z.enum(KINDS),
	value_paise: z.number().int().min(0)
});

export const GET: RequestHandler = async ({ platform, locals }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const hid = locals.householdId ?? locals.userId;
	const rdb = getReadDb(platform);
	const [holdings, snapshots] = await Promise.all([listHoldings(rdb, hid), listSnapshots(rdb, hid)]);
	const total_paise = holdings.reduce((s, h) => s + h.value_paise, 0);
	return json({ holdings, total_paise, snapshots });
};

export const POST: RequestHandler = async ({ platform, locals, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const hid = locals.householdId ?? locals.userId;
	const body = CreateSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid holding');
	const db = getDb(platform);
	const created = await createHolding(db, { household_id: hid, user_id: locals.userId, ...body.data });
	await snapshotToday(db, hid, today());
	return json(created, { status: 201 });
};
