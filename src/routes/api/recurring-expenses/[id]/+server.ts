import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb } from '$lib/server/db';
import { deleteRecurringExpense, updateRecurringExpense } from '$lib/server/queries/recurring-expenses';

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const hid = locals.householdId ?? locals.userId;

	await deleteRecurringExpense(getDb(platform), params.id!, hid);
	return new Response(null, { status: 204 });
};

const PatchSchema = z.object({
	name: z.string().min(1).max(60).optional(),
	amount_paise: z.number().int().positive().optional(),
	category_id: z.string().optional(),
	frequency: z.enum(['daily', 'weekly', 'bi_weekly', 'monthly', 'bi_monthly', 'quarterly', 'half_yearly', 'yearly']).optional(),
	start_date: z.string().optional(),
	end_date: z.string().nullable().optional(),
	occurrence_limit: z.number().int().positive().nullable().optional(),
	is_active: z.boolean().optional(),
	next_due_at: z.string().optional(),
	due_time: z.string().nullable().optional()
});

export const PATCH: RequestHandler = async ({ platform, locals, params, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const hid = locals.householdId ?? locals.userId;
	const body = PatchSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid update data');

	const updated = await updateRecurringExpense(getDb(platform), params.id!, hid, body.data);
	return json(updated);
};
