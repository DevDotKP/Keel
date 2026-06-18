import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { billingProvider } from '$lib/server/billing/local';

export const POST: RequestHandler = async ({ platform, request }) => {
	// No-op in MVP. LocalProvider.parseWebhook always returns null.
	// TODO(sonnet): when Razorpay lands, verify the webhook signature,
	// parse the event, look up the user by provider_ref, and UPDATE
	// entitlements SET status='owned', purchased_at=now WHERE user_id = ?.
	const db = getDb(platform);
	const rawBody = await request.text();
	const sig = request.headers.get('x-razorpay-signature') ?? '';
	const result = await billingProvider.parseWebhook(rawBody, sig);
	void db; void result;
	return json({ ok: true });
};
