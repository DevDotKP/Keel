// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	// Augment the auto-generated Env with secrets not tracked in wrangler.jsonc.
	// Add these via: wrangler secret put RESEND_API_KEY
	interface Env {
		RESEND_API_KEY?: string;
		MAGIC_LINK_BASE_URL?: string;
		MAGIC_LINK_FROM_EMAIL?: string;
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
		}

		interface Error {
			message: string;
			code?: string;
		}
	}
}

// BeforeInstallPromptEvent is not in the standard TS DOM lib.
interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
declare global {
	interface WindowEventMap {
		beforeinstallprompt: BeforeInstallPromptEvent;
	}
}

export {};
