<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { WifiOff, CheckCircle } from 'lucide-svelte';
	import { flushQueue, getPendingCount } from '$lib/utils/offline-queue';

	let offline = $state(false);
	let pending = $state(0);
	let syncing = $state(false);
	let justSynced = $state(0);

	async function refreshCount() {
		pending = await getPendingCount();
	}

	async function flush() {
		syncing = true;
		const count = await flushQueue();
		syncing = false;
		if (count > 0) {
			justSynced = count;
			await refreshCount();
			await invalidateAll();
			setTimeout(() => (justSynced = 0), 3000);
		}
	}

	onMount(() => {
		offline = !navigator.onLine;
		refreshCount();

		const onOnline = async () => {
			offline = false;
			await refreshCount();
			if (pending > 0) flush();
		};
		const onOffline = () => {
			offline = true;
			refreshCount();
		};

		window.addEventListener('online', onOnline);
		window.addEventListener('offline', onOffline);
		return () => {
			window.removeEventListener('online', onOnline);
			window.removeEventListener('offline', onOffline);
		};
	});

	// Export so the add-while-offline path can notify this banner.
	export function notifyQueued() {
		refreshCount();
	}
</script>

{#if justSynced > 0}
	<div class="banner banner--synced" role="status" aria-live="polite">
		<CheckCircle size={16} aria-hidden="true" />
		<span>{justSynced} {justSynced === 1 ? 'entry' : 'entries'} synced.</span>
	</div>
{:else if offline}
	<div class="banner" role="status" aria-live="polite">
		<WifiOff size={16} aria-hidden="true" />
		{#if pending > 0}
			<span>{pending} {pending === 1 ? 'entry' : 'entries'} queued, will sync when you're back online.</span>
		{:else}
			<span>You are offline. New entries will queue until you reconnect.</span>
		{/if}
	</div>
{:else if pending > 0 && !syncing}
	<!-- Back online with a non-empty queue: flush just triggered, briefly show status. -->
	<div class="banner banner--syncing" role="status" aria-live="polite">
		<span>Syncing {pending} queued {pending === 1 ? 'entry' : 'entries'}…</span>
	</div>
{/if}

<style>
	.banner {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4);
		background: var(--color-surface-subtle);
		color: var(--color-text-muted);
		font-size: 0.875rem;
		border-bottom: 1px solid var(--color-border);
	}

	.banner--synced {
		background: color-mix(in srgb, var(--color-positive) 10%, transparent);
		color: var(--color-positive);
		border-bottom-color: color-mix(in srgb, var(--color-positive) 25%, transparent);
	}

	.banner--syncing {
		background: var(--color-surface-subtle);
		color: var(--color-text-subtle);
	}
</style>
