// Returns the D1 database binding from the Cloudflare platform context.

export function getDb(platform: App.Platform | undefined): D1Database {
	if (!platform?.env?.DB) {
		throw new Error('D1 binding not found. Check wrangler.jsonc and platformProxy config.');
	}
	return platform.env.DB;
}

/**
 * Read-optimised handle. Routes reads to the nearest D1 replica when read
 * replication is enabled on the database. Writes must still use getDb().
 * 'first-unconstrained' = serve from any available replica, no staleness
 * guarantee needed (fine for a dashboard that refreshes on every load).
 */
export function getReadDb(platform: App.Platform | undefined): D1Database {
	const db = getDb(platform);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (db as any).withSession?.('first-unconstrained') ?? db;
}
