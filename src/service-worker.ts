/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const CACHE = `keel-${version}`;

// Static assets: compiled bundles + everything in /static (fonts, icons, manifest).
// Exclude nothing — we want the app shell fully cached.
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}
	event.waitUntil(addFilesToCache());
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	async function activate() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
		// Take over open pages immediately so deploys land without every
		// tab/PWA window being closed first.
		await self.clients.claim();
	}
	event.waitUntil(activate());
});

// ── Web Push: harbour reminders ────────────────────────────────────────────
// These MUST live in this file: this is the service worker SvelteKit actually
// registers. A push with no handler here shows the user nothing.

interface KeelPush {
	title?: string;
	body?: string;
	url?: string;
	tag?: string;
}

self.addEventListener('push', (event) => {
	let data: KeelPush = {};
	try {
		if (event.data) data = event.data.json() as KeelPush;
	} catch {
		/* malformed payload: fall back to a generic notice below */
	}
	const title = data.title || 'Keel';
	event.waitUntil(
		self.registration.showNotification(title, {
			body: data.body || '',
			icon: '/icons/icon-192-v2.png',
			badge: '/icons/icon-192-v2.png',
			tag: data.tag,
			data: { url: data.url || '/' }
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = (event.notification.data as { url?: string } | undefined)?.url || '/';
	event.waitUntil(
		(async () => {
			const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			for (const client of clientList) {
				await client.focus();
				try {
					await client.navigate(target);
				} catch {
					/* navigation can fail across origins; focus is enough */
				}
				return;
			}
			await self.clients.openWindow(target);
		})()
	);
});

// On sign-out the auth page asks us to drop cached page navigations (they hold
// SSR'd balances). Pre-cached static assets stay — they're user-agnostic.
self.addEventListener('message', (event) => {
	if ((event.data as { type?: string } | null)?.type !== 'purge-pages') return;
	async function purgePages() {
		const cache = await caches.open(CACHE);
		for (const req of await cache.keys()) {
			const path = new URL(req.url).pathname;
			if (!ASSETS.includes(path)) await cache.delete(req);
		}
	}
	event.waitUntil(purgePages());
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Only intercept same-origin GET requests.
	// Leave API routes and auth routes to the network — they're auth-protected.
	if (
		event.request.method !== 'GET' ||
		url.origin !== self.location.origin ||
		url.pathname.startsWith('/api/') ||
		url.pathname.startsWith('/auth')
	) {
		return;
	}

	async function respond(): Promise<Response> {
		const cache = await caches.open(CACHE);

		// Cache-first for pre-cached assets (JS bundles, CSS, fonts, icons).
		if (ASSETS.includes(url.pathname)) {
			const cached = await cache.match(url.pathname);
			if (cached) return cached;
		}

		// Network-first for page navigations (HTML) — fall back to cache if offline.
		try {
			const response = await fetch(event.request);
			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}
			return response;
		} catch {
			const cached = await cache.match(event.request);
			if (cached) return cached;
			// No cache hit and offline: let it fail naturally.
			return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
		}
	}

	event.respondWith(respond());
});
