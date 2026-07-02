// Password hashing on Workers: PBKDF2-SHA256 via WebCrypto (bcrypt/argon2
// aren't available without WASM). 100k iterations is the OWASP floor for
// PBKDF2-SHA256 and stays well inside the Workers CPU budget.

const ITERATIONS = 100_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

function toHex(buf: ArrayBuffer | Uint8Array): string {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

function fromHex(hex: string): Uint8Array {
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
		key,
		KEY_BYTES * 8
	);
	return toHex(bits);
}

/** Hash a password for storage: pbkdf2:<iterations>:<salt-hex>:<hash-hex>. */
export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const hash = await derive(password, salt, ITERATIONS);
	return `pbkdf2:${ITERATIONS}:${toHex(salt)}:${hash}`;
}

/** Verify a password against a stored hash. Constant-time comparison. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const parts = stored.split(':');
	if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
	const iterations = parseInt(parts[1], 10);
	if (!Number.isFinite(iterations) || iterations < 1) return false;
	const computed = await derive(password, fromHex(parts[2]), iterations);
	const expected = parts[3];
	if (computed.length !== expected.length) return false;
	let r = 0;
	for (let i = 0; i < computed.length; i++) r |= computed.charCodeAt(i) ^ expected.charCodeAt(i);
	return r === 0;
}
