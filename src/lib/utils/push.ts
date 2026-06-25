// Client-side Web Push subscription helpers. Talks to /api/push/subscribe.

export function isPushSupported(): boolean {
	if (typeof window === 'undefined') return false;
	return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** iOS needs the PWA installed to the home screen before push will work. */
export function iosNeedsInstall(): boolean {
	if (typeof window === 'undefined') return false;
	const ua = navigator.userAgent;
	const isIOS = /iphone|ipad|ipod/i.test(ua);
	// matchMedia standalone (or navigator.standalone on older iOS) means installed.
	const standalone =
		window.matchMedia?.('(display-mode: standalone)').matches ||
		(navigator as unknown as { standalone?: boolean }).standalone === true;
	return isIOS && !standalone;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4);
	const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(b64);
	const out = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}

/** Is this browser already subscribed to push? */
export async function isSubscribed(): Promise<boolean> {
	if (!isPushSupported()) return false;
	const reg = await navigator.serviceWorker.ready;
	return (await reg.pushManager.getSubscription()) !== null;
}

export type SubscribeResult = 'ok' | 'denied' | 'unsupported' | 'error';

export async function subscribeToPush(vapidPublicKey: string): Promise<SubscribeResult> {
	if (!isPushSupported() || !vapidPublicKey) return 'unsupported';

	const permission = await Notification.requestPermission();
	if (permission !== 'granted') return 'denied';

	try {
		const reg = await navigator.serviceWorker.ready;
		let sub = await reg.pushManager.getSubscription();
		if (!sub) {
			sub = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
			});
		}
		const raw = sub.toJSON();
		const res = await fetch('/api/push/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ endpoint: sub.endpoint, keys: raw.keys })
		});
		return res.ok ? 'ok' : 'error';
	} catch {
		return 'error';
	}
}

export async function unsubscribeFromPush(): Promise<boolean> {
	if (!isPushSupported()) return false;
	try {
		const reg = await navigator.serviceWorker.ready;
		const sub = await reg.pushManager.getSubscription();
		if (!sub) return true;
		const endpoint = sub.endpoint;
		await sub.unsubscribe();
		await fetch('/api/push/subscribe', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ endpoint })
		});
		return true;
	} catch {
		return false;
	}
}
