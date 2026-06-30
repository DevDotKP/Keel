import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getDb, getReadDb } from '$lib/server/db';
import {
	listRecurringIncome,
	createRecurringIncome,
	createRecurringIncomeWithFrequency
} from '$lib/server/queries/recurring-income';

// Support both old anchor-kind style and new frequency-based style.
const CreateSchema = z
	.object({
		name: z.string().min(1).max(60),
		amount_paise: z.number().int().positive(),
		category_id: z.string().nullable().optional(),
		// New frequency-based fields
		frequency: z.enum(['daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'yearly']).optional(),
		start_date: z.string().optional(), // YYYY-MM-DD
		end_date: z.string().nullable().optional(), // YYYY-MM-DD
		occurrence_limit: z.number().int().positive().nullable().optional(),
		// Legacy anchor-kind fields (for backward compat)
		anchor_kind: z.enum(['end_of_month', 'start_of_month', 'day_of_month']).optional(),
		anchor_day: z.number().int().min(1).max(28).nullable().optional()
	})
	.refine(
		(d) => {
			// If frequency is provided, anchor_kind should not be
			if (d.frequency) return !d.anchor_kind;
			// If anchor_kind is provided, it must be valid
			if (d.anchor_kind === 'day_of_month') return d.anchor_day != null;
			return true;
		},
		{ message: 'Provide either frequency (new style) OR anchor_kind (legacy style), not both' }
	);

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

	const db = getDb(platform);
	let created;

	if (body.data.frequency) {
		// New frequency-based approach
		created = await createRecurringIncomeWithFrequency(db, {
			household_id: hid,
			user_id: locals.userId,
			name: body.data.name.trim(),
			amount_paise: body.data.amount_paise,
			category_id: body.data.category_id ?? null,
			frequency: body.data.frequency,
			start_date: body.data.start_date,
			end_date: body.data.end_date,
			occurrence_limit: body.data.occurrence_limit
		});
	} else {
		// Legacy anchor-kind approach
		created = await createRecurringIncome(db, {
			household_id: hid,
			user_id: locals.userId,
			name: body.data.name.trim(),
			amount_paise: body.data.amount_paise,
			anchor_kind: body.data.anchor_kind as 'end_of_month' | 'start_of_month' | 'day_of_month',
			anchor_day: body.data.anchor_day ?? null,
			category_id: body.data.category_id ?? null
		});
	}

	return json(created, { status: 201 });
};
