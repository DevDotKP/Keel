import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { deleteRecurringExpense, toggleRecurringExpense } from '$lib/server/queries/recurring-expenses';
import { z } from 'zod';

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const hid = locals.householdId ?? locals.userId;

	await deleteRecurringExpense(getDb(platform), params.id!, hid);
	return new Response(null, { status: 204 });
};

const PatchSchema = z.object({
	is_active: z.boolean().optional()
});

export const PATCH: RequestHandler = async ({ platform, locals, params, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const hid = locals.householdId ?? locals.userId;
	const body = PatchSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid patch data');

	if (body.data.is_active !== undefined) {
		await toggleRecurringExpense(getDb(platform), params.id!, hid, body.data.is_active);
	}

	return json({ success: true });
};
