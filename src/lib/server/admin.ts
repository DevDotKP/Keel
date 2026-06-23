// Owner-only admin auth for /admin. Completely separate from user auth: a single
// username+password from env (ADMIN_USER / ADMIN_PASS), and a stateless signed
// cookie with an expiry. No DB session, no PII.

export const ADMIN_COOKIE = 'keel_admin';
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

async function sha256Hex(s: string): Promise<string> {
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
	return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
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

/** Mint a signed session token bound to the password, with an expiry. */
export async function makeToken(envPass: string): Promise<string> {
	const exp = Date.now() + TTL_MS;
	const sig = await sha256Hex(`${exp}.${envPass}`);
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
	const expected = await sha256Hex(`${exp}.${envPass}`);
	return safeEqual(sig, expected);
}
