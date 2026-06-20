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
