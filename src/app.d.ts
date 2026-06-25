// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	// Augment the auto-generated Env with secrets not tracked in wrangler.jsonc.
	// Add these via: wrangler secret put RESEND_API_KEY
	interface Env {
		RESEND_API_KEY?: string;
		MAGIC_LINK_BASE_URL?: string;
		MAGIC_LINK_FROM_EMAIL?: string;
		OPT_OUT_TOKEN?: string;
		// TEMPORARY closed-testing escape hatch. When 'true', the send endpoint
		// returns the sign-in link directly (no email needed). Anyone who knows an
		// email can then log in as them, so keep this OFF for any real launch.
		MAGIC_LINK_REVEAL?: string;
		// Google OAuth — set via: wrangler secret put GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
		GOOGLE_CLIENT_ID?: string;
		GOOGLE_CLIENT_SECRET?: string;
		// Owner-only admin panel (/admin). Set via: wrangler secret put ADMIN_USER / ADMIN_PASS
		ADMIN_USER?: string;
		ADMIN_PASS?: string;
		// Web Push (VAPID). Public key is also served to the client to subscribe.
		// Set via: wrangler pages secret put VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
		VAPID_PUBLIC_KEY?: string;
		VAPID_PRIVATE_KEY?: string;
		VAPID_SUBJECT?: string;
		// Shared secret for the scheduled Harbour-reminder endpoint (GitHub Action).
		CRON_SECRET?: string;
	}

	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		interface Locals {
			// Set by the auth hook after validating the session cookie.
			userId: string | null;
			// Resolved household for the session user (personal household id = user id).
			householdId: string | null;
		}

		interface Error {
			message: string;
			code?: string;
			// Reference id logged server-side, shown to the user so a failure is traceable.
			errorId?: string;
		}
	}
}

// BeforeInstallPromptEvent is not in the standard TS DOM lib.
declare global {
	interface BeforeInstallPromptEvent extends Event {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}
	interface WindowEventMap {
		beforeinstallprompt: BeforeInstallPromptEvent;
	}
}

export {};
