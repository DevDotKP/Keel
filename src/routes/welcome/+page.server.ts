import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { getDb, getReadDb } from '$lib/server/db';
import { parseToPaise } from '$lib/utils/money';
import type { Settings } from '$lib/types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!locals.userId) redirect(302, '/auth');
	const settings = await getReadDb(platform)
		.prepare('SELECT harbour_cadence, harbour_day, onboarded FROM settings WHERE user_id = ?')
		.bind(locals.userId)
		.first<Pick<Settings, 'harbour_cadence' | 'harbour_day' | 'onboarded'>>();

	// Already set up: nothing to do here.
	if (settings?.onboarded === 1) redirect(302, '/');

	return {
		cadence: settings?.harbour_cadence ?? 'monthly',
		harbourDay: settings?.harbour_day ?? 'sunday'
	};
};

const CADENCES = new Set(['weekly', 'fortnightly', 'monthly']);

export const actions: Actions = {
	default: async ({ platform, locals, request }) => {
		if (!locals.userId) redirect(302, '/auth');
		const db = getDb(platform);
		const hid = locals.householdId ?? locals.userId;
		const form = await request.formData();

		// Skip: mark onboarded, set nothing else, go to the dashboard.
		if (form.get('skip') === '1') {
			await db
				.prepare('UPDATE settings SET onboarded = 1 WHERE user_id = ?')
				.bind(locals.userId)
				.run();
			redirect(303, '/');
		}

		const cadence = String(form.get('cadence') ?? 'monthly');
		if (!CADENCES.has(cadence)) return fail(400, { message: 'Pick how often to settle up.' });

		// Payday alignment only applies to monthly. A numeric harbour_day means payday.
		let harbourDay = 'sunday';
		if (cadence === 'monthly' && form.get('payday') === 'on') {
			const day = parseInt(String(form.get('payday_day') ?? ''), 10);
			if (isNaN(day) || day < 1 || day > 28) return fail(400, { message: 'Pick a payday between 1 and 28.' });
			harbourDay = String(day);
		}

		// Starting balance is optional. Empty or zero just skips the anchor.
		const balanceRaw = String(form.get('balance') ?? '').trim();
		const balancePaise = balanceRaw ? parseToPaise(balanceRaw) : null;
		if (balanceRaw && (balancePaise === null || balancePaise < 0)) {
			return fail(400, { message: 'Enter a valid balance, or leave it blank.' });
		}

		await db
			.prepare('UPDATE settings SET harbour_cadence = ?, harbour_day = ?, onboarded = 1 WHERE user_id = ?')
			.bind(cadence, harbourDay, locals.userId)
			.run();

		if (balancePaise !== null) {
			const acct = await db
				.prepare(
					'SELECT id FROM accounts WHERE household_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1'
				)
				.bind(hid)
				.first<{ id: string }>();
			if (acct) {
				// Seed the account balance and, if a period is already open, its opening
				// balance, so "safe to spend" is real immediately. A brand-new user has no
				// period yet; the dashboard creates it from this account balance on first load.
				await db.batch([
					db.prepare('UPDATE accounts SET balance_paise = ? WHERE id = ?').bind(balancePaise, acct.id),
					db
						.prepare(
							'UPDATE reconciliation_periods SET opening_balance_paise = ? WHERE account_id = ? AND harboured_at IS NULL'
						)
						.bind(balancePaise, acct.id)
				]);
			}
		}

		redirect(303, '/');
	}
};
