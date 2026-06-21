import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb, getReadDb } from '$lib/server/db';
import {
	listRecurringIncome,
	createRecurringIncome
} from '$lib/server/queries/recurring-income';

const CreateSchema = z
	.object({
		name: z.string().min(1).max(60),
		amount_paise: z.number().int().positive(),
		anchor_kind: z.enum(['end_of_month', 'start_of_month', 'day_of_month']),
		anchor_day: z.number().int().min(1).max(28).nullable().optional(),
		category_id: z.string().nullable().optional()
	})
	.refine((d) => d.anchor_kind !== 'day_of_month' || d.anchor_day != null, {
		message: 'anchor_day is required when anchor_kind is day_of_month',
		path: ['anchor_day']
	});

export const GET: RequestHandler = async ({ platform, locals }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const hid = locals.householdId ?? locals.userId;
	const items = await listRecurringIncome(getReadDb(platform), hid);
	return json(items);
};

export const POST: RequestHandler = async ({ platform, locals, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const hid = locals.householdId ?? locals.userId;
	const body = CreateSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid recurring income');

	const created = await createRecurringIncome(getDb(platform), {
		household_id: hid,
		user_id: locals.userId,
		name: body.data.name.trim(),
		amount_paise: body.data.amount_paise,
		anchor_kind: body.data.anchor_kind,
		anchor_day: body.data.anchor_day ?? null,
		category_id: body.data.category_id ?? null
	});
	return json(created, { status: 201 });
};
