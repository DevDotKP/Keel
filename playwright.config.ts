import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		// The preview server (wrangler pages dev) uses a local D1 that starts
		// empty — apply migrations first or every request 500s on missing tables.
		command:
			'npm run build && npx wrangler d1 migrations apply keel-prod --local && npm run preview',
		port: 4173,
		timeout: 180_000
	},
	use: { baseURL: 'http://localhost:4173' },
	testMatch: '**/*.e2e.{ts,js}'
});
