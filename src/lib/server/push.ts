// Web Push from a Cloudflare Worker, using only Web Crypto. No external service.
// VAPID auth per RFC 8292; payload encryption (aes128gcm) per RFC 8291 / RFC 8188.

export interface PushSub {
	endpoint: string;
	p256dh: string; // client public key, base64url (65 bytes)
	auth: string; // client auth secret, base64url (16 bytes)
}

export interface PushPayload {
	title: string;
	body: string;
	url?: string; // where notificationclick should navigate
	tag?: string; // collapses duplicate notifications
}

// ── base64url helpers ─────────────────────────────────────────────────────
// All byte arrays are pinned to Uint8Array<ArrayBuffer> so they satisfy the
// Web Crypto BufferSource / fetch BodyInit types (which reject ArrayBufferLike).
function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
	const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
	const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

function bytesToB64url(bytes: Uint8Array): string {
	let bin = '';
	for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...arrs: Uint8Array[]): Uint8Array<ArrayBuffer> {
	const len = arrs.reduce((n, a) => n + a.length, 0);
	const out = new Uint8Array(len);
	let off = 0;
	for (const a of arrs) {
		out.set(a, off);
		off += a.length;
	}
	return out;
}

const utf8 = (s: string): Uint8Array<ArrayBuffer> => new Uint8Array(new TextEncoder().encode(s));

// ── VAPID JWT (ES256) ─────────────────────────────────────────────────────
async function importVapidSigningKey(publicKey: string, privateKey: string): Promise<CryptoKey> {
	const pub = b64urlToBytes(publicKey); // 0x04 || x(32) || y(32)
	const jwk: JsonWebKey = {
		kty: 'EC',
		crv: 'P-256',
		x: bytesToB64url(pub.slice(1, 33)),
		y: bytesToB64url(pub.slice(33, 65)),
		d: privateKey, // already base64url (32-byte scalar)
		ext: true
	};
	return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
		'sign'
	]);
}

async function vapidAuthHeader(
	endpoint: string,
	publicKey: string,
	privateKey: string,
	subject: string
): Promise<string> {
	const aud = new URL(endpoint).origin;
	const header = bytesToB64url(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
	const payload = bytesToB64url(
		utf8(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }))
	);
	const signingInput = `${header}.${payload}`;
	const key = await importVapidSigningKey(publicKey, privateKey);
	const sig = new Uint8Array(
		await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(signingInput))
	);
	const jwt = `${signingInput}.${bytesToB64url(sig)}`;
	return `vapid t=${jwt}, k=${publicKey}`;
}

// ── Payload encryption (aes128gcm) ────────────────────────────────────────
async function hkdf(
	salt: Uint8Array<ArrayBuffer>,
	ikm: Uint8Array<ArrayBuffer>,
	info: Uint8Array<ArrayBuffer>,
	lengthBytes: number
): Promise<Uint8Array<ArrayBuffer>> {
	const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'HKDF', hash: 'SHA-256', salt, info },
		key,
		lengthBytes * 8
	);
	return new Uint8Array(bits);
}

async function encryptPayload(
	plaintext: Uint8Array<ArrayBuffer>,
	clientPublicKey: Uint8Array<ArrayBuffer>,
	clientAuth: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
	// Ephemeral server ECDH keypair.
	const serverKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
		'deriveBits'
	]);
	const serverPublic = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey));

	// Shared ECDH secret with the client's public key.
	const clientKey = await crypto.subtle.importKey(
		'raw',
		clientPublicKey,
		{ name: 'ECDH', namedCurve: 'P-256' },
		false,
		[]
	);
	const sharedSecret = new Uint8Array(
		await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, serverKeys.privateKey, 256)
	);

	const salt = crypto.getRandomValues(new Uint8Array(16));

	// RFC 8291: derive the IKM that RFC 8188 then uses.
	const keyInfo = concat(utf8('WebPush: info'), new Uint8Array([0]), clientPublicKey, serverPublic);
	const ikm = await hkdf(clientAuth, sharedSecret, keyInfo, 32);

	// RFC 8188: content encryption key and nonce from the random salt.
	const cek = await hkdf(salt, ikm, concat(utf8('Content-Encoding: aes128gcm'), new Uint8Array([0])), 16);
	const nonce = await hkdf(salt, ikm, concat(utf8('Content-Encoding: nonce'), new Uint8Array([0])), 12);

	// Single record: plaintext followed by the 0x02 last-record delimiter.
	const padded = concat(plaintext, new Uint8Array([2]));
	const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
	const ciphertext = new Uint8Array(
		await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, padded)
	);

	// aes128gcm header: salt(16) || rs(4) || idlen(1) || keyid(server public).
	const rs = new Uint8Array([0, 0, 0x10, 0]); // 4096
	const header = concat(salt, rs, new Uint8Array([serverPublic.length]), serverPublic);
	return concat(header, ciphertext);
}

// ── Send ──────────────────────────────────────────────────────────────────
export interface SendResult {
	ok: boolean;
	status: number;
	expired: boolean; // 404/410: the subscription is gone, prune it
}

export async function sendWebPush(
	sub: PushSub,
	payload: PushPayload,
	env: { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string }
): Promise<SendResult> {
	if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
		return { ok: false, status: 0, expired: false };
	}
	const subject = env.VAPID_SUBJECT || 'mailto:hello@keel.app';

	const body = await encryptPayload(
		utf8(JSON.stringify(payload)),
		b64urlToBytes(sub.p256dh),
		b64urlToBytes(sub.auth)
	);
	const authorization = await vapidAuthHeader(
		sub.endpoint,
		env.VAPID_PUBLIC_KEY,
		env.VAPID_PRIVATE_KEY,
		subject
	);

	const res = await fetch(sub.endpoint, {
		method: 'POST',
		headers: {
			Authorization: authorization,
			'Content-Encoding': 'aes128gcm',
			'Content-Type': 'application/octet-stream',
			TTL: '86400',
			Urgency: 'normal'
		},
		body
	});

	return { ok: res.ok, status: res.status, expired: res.status === 404 || res.status === 410 };
}

/**
 * Send a notification to every device a user has registered, pruning any
 * subscription the push service reports as gone. Safe to call from
 * ctx.waitUntil (never blocks the request). No-op if the user has no devices.
 */
export async function notifyUser(
	db: D1Database,
	userId: string,
	payload: PushPayload,
	env: { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string }
): Promise<void> {
	const { results } = await db
		.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?')
		.bind(userId)
		.all<PushSub>();
	if (!results.length) return;

	const dead: string[] = [];
	await Promise.all(
		results.map(async (sub) => {
			try {
				const r = await sendWebPush(sub, payload, env);
				if (r.expired) dead.push(sub.endpoint);
			} catch {
				/* a single failed device never breaks the others */
			}
		})
	);

	for (const endpoint of dead) {
		await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
	}
}
