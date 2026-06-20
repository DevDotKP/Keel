// IndexedDB offline queue for transactions added while the device is offline.
// On reconnect, the caller flushes the queue by posting each entry to the API.

const DB_NAME = 'keel-offline';
const STORE = 'pending-transactions';
const DB_VERSION = 1;

interface PendingEntry {
	id: string;
	payload: Record<string, unknown>;
	queued_at: string;
}

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = (e) => {
			const db = (e.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE)) {
				db.createObjectStore(STORE, { keyPath: 'id' });
			}
		};
		req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
		req.onerror = () => reject(req.error);
	});
}

export async function enqueueTransaction(payload: Record<string, unknown>): Promise<void> {
	const db = await openDb();
	const entry: PendingEntry = {
		id: crypto.randomUUID(),
		payload,
		queued_at: new Date().toISOString()
	};
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).put(entry);
		tx.oncomplete = () => {
			db.close();
			resolve();
		};
		tx.onerror = () => {
			db.close();
			reject(tx.error);
		};
	});
}

export async function getPendingCount(): Promise<number> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly');
		const req = tx.objectStore(STORE).count();
		req.onsuccess = () => {
			db.close();
			resolve(req.result);
		};
		req.onerror = () => {
			db.close();
			reject(req.error);
		};
	});
}

/** Post all queued entries to the API. Returns the number successfully synced. */
export async function flushQueue(): Promise<number> {
	const db = await openDb();

	const entries: PendingEntry[] = await new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly');
		const req = tx.objectStore(STORE).getAll();
		req.onsuccess = () => resolve(req.result as PendingEntry[]);
		req.onerror = () => reject(req.error);
	});

	let synced = 0;
	for (const entry of entries) {
		try {
			const res = await fetch('/api/transactions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(entry.payload)
			});
			if (!res.ok) continue;
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction(STORE, 'readwrite');
				tx.objectStore(STORE).delete(entry.id);
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
			synced++;
		} catch {
			// Network failure mid-flush: stop and let the next online event retry.
			break;
		}
	}

	db.close();
	return synced;
}
