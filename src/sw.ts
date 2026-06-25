/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Custom service worker (vite-plugin-pwa injectManifest). Keeps the offline
// precache and API caching that generateSW gave us, and adds Web Push on top.
declare const self: ServiceWorkerGlobalScope & {
	__WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Activate a new version immediately and take control of open pages, instead of
// waiting for every tab/PWA window to close. Without this, an installed PWA kept
// serving the old cached app, so deploys appeared not to land. Pairs with
// registerType 'autoUpdate', which then reloads the page onto the new version.
self.skipWaiting();
self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

// API: network-first with a short timeout, so repeat views and brief offline
// windows still resolve. Mirrors the previous generateSW runtimeCaching rule.
registerRoute(
	({ url }) => url.pathname.startsWith('/api/'),
	new NetworkFirst({
		cacheName: 'api-cache',
		networkTimeoutSeconds: 4,
		plugins: [new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 })]
	})
);

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
			icon: '/icons/icon-192.png',
			badge: '/icons/icon-192.png',
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
			const clientList = await self.clients.matchAll({
				type: 'window',
				includeUncontrolled: true
			});
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
