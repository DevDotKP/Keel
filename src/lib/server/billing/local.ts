// LocalProvider: no-op BillingProvider used in the MVP.
// Everyone is treated as entitled; no real payment is ever processed.
// When Razorpay lands: add billing/razorpay.ts implementing the same interface.

import type { BillingProvider, OrderResult, WebhookResult } from './provider';

export class LocalProvider implements BillingProvider {
	async createOrder(_user_id: string, _amount_paise: number): Promise<OrderResult> {
		// TODO(sonnet): replace with RazorpayProvider when payments land.
		return { provider_ref: 'local_noop' };
	}

	async parseWebhook(_rawBody: string, _signature: string): Promise<WebhookResult | null> {
		// TODO(sonnet): replace with RazorpayProvider when payments land.
		return null;
	}
}

export const billingProvider: BillingProvider = new LocalProvider();
