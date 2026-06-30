import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb, getReadDb } from '$lib/server/db';
import {
	listRecurringExpenses,
	createRecurringExpense
} from '$lib/server/queries/recurring-expenses';

const CreateSchema = z.object({
	name: z.string().min(1).max(60),
	amount_paise: z.number().int().positive(),
	category_id: z.string(),
	frequency: z.enum(['daily', 'weekly', 'bi_weekly', 'monthly', 'bi_monthly', 'quarterly', 'half_yearly', 'yearly']),
	start_date: z.string().optional(), // YYYY-MM-DD
	end_date: z.string().nullable().optional(),
	occurrence_limit: z.number().int().positive().nullable().optional(),
	due_time: z.string().nullable().optional()
});

export const GET: RequestHandler = async ({ platform, locals }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const hid = locals.householdId ?? locals.userId;
	const items = await listRecurringExpenses(getReadDb(platform), hid);
	return json(items);
};

export const POST: RequestHandler = async ({ platform, locals, request }) => {
	if (!locals.userId) throw error(401, 'Unauthorised');
	const hid = locals.householdId ?? locals.userId;
	const body = CreateSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid recurring expense');

	// Get the default account for the household
	const rdb = getReadDb(platform);
	const accountRow = await rdb
		.prepare(`SELECT id FROM accounts WHERE household_id = ? AND deleted_at IS NULL LIMIT 1`)
		.bind(hid)
		.first<{ id: string }>();
	if (!accountRow) throw error(400, 'No account found for this household');

	const created = await createRecurringExpense(getDb(platform), {
		household_id: hid,
		user_id: locals.userId,
		account_id: accountRow.id,
		name: body.data.name.trim(),
		amount_paise: body.data.amount_paise,
		category_id: body.data.category_id,
		frequency: body.data.frequency,
		start_date: body.data.start_date,
		end_date: body.data.end_date,
		occurrence_limit: body.data.occurrence_limit,
		due_time: body.data.due_time
	});
	return json(created, { status: 201 });
};
