// Returns the D1 database binding from the Cloudflare platform context.

export function getDb(platform: App.Platform | undefined): D1Database {
	if (!platform?.env?.DB) {
		throw new Error('D1 binding not found. Check wrangler.jsonc and platformProxy config.');
	}
	return platform.env.DB;
}
