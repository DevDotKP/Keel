// BillingProvider interface. Swap the implementation without touching feature code.

export interface OrderResult {
	provider_ref: string; // e.g. Razorpay order_id
	checkout_url?: string;
	client_payload?: Record<string, unknown>; // passed to the client checkout SDK
}

export interface WebhookResult {
	user_id: string;
	provider_ref: string;
	paid: boolean;
}

export interface BillingProvider {
	/** Create a one-time payment order for the given user. */
	createOrder(user_id: string, amount_paise: number): Promise<OrderResult>;

	/** Verify and parse an inbound webhook payload. Returns null if invalid. */
	parseWebhook(rawBody: string, signature: string): Promise<WebhookResult | null>;
}
