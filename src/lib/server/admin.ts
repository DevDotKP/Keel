// Owner-only admin auth for /admin. Completely separate from user auth: a single
// username+password from env (ADMIN_USER / ADMIN_PASS), and a stateless signed
// cookie with an expiry. No DB session, no PII.

export const ADMIN_COOKIE = 'keel_admin';
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let r = 0;
	for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return r === 0;
}

/** Validate the typed credentials against the configured owner credentials. */
export function checkCredentials(
	user: string,
	pass: string,
	envUser: string | undefined,
	envPass: string | undefined
): boolean {
	if (!envUser || !envPass) return false; // admin not configured
	return safeEqual(user, envUser) && safeEqual(pass, envPass);
}

// Proper keyed MAC (not sha256(exp + password), which is an unkeyed construction).
async function hmacHex(key: string, message: string): Promise<string> {
	const k = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(key),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(message));
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Mint a signed session token keyed by the password, with an expiry. */
export async function makeToken(envPass: string): Promise<string> {
	const exp = Date.now() + TTL_MS;
	const sig = await hmacHex(envPass, String(exp));
	return `${exp}.${sig}`;
}

/** Verify a session cookie: not expired and signature matches the password. */
export async function verifyToken(
	token: string | undefined,
	envPass: string | undefined
): Promise<boolean> {
	if (!token || !envPass) return false;
	const dot = token.indexOf('.');
	if (dot < 0) return false;
	const expStr = token.slice(0, dot);
	const sig = token.slice(dot + 1);
	const exp = Number(expStr);
	if (!Number.isFinite(exp) || Date.now() > exp) return false;
	const expected = await hmacHex(envPass, expStr);
	return safeEqual(sig, expected);
}
