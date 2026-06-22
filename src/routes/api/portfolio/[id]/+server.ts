import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import { updateHolding, deleteHolding, snapshotToday } from '$lib/server/queries/portfolio';
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

const PatchSchema = z.object({
	name: z.string().min(1).max(60),
	kind: z.enum(KINDS),
	value_paise: z.number().int().min(0)
});

export const PATCH: RequestHandler = async ({ platform, locals, params, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const hid = locals.householdId ?? locals.userId;
	const body = PatchSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid holding');
	const db = getDb(platform);
	await updateHolding(db, params.id, hid, body.data);
	await snapshotToday(db, hid, today());
	return new Response(null, { status: 204 });
};

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const hid = locals.householdId ?? locals.userId;
	const db = getDb(platform);
	await deleteHolding(db, params.id, hid);
	await snapshotToday(db, hid, today());
	return new Response(null, { status: 204 });
};
