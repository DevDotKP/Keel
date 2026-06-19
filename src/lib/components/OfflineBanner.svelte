<script lang="ts">
	import { onMount } from 'svelte';
	import { WifiOff } from 'lucide-svelte';

	let offline = $state(false);

	onMount(() => {
		offline = !navigator.onLine;
		const on = () => (offline = false);
		const off = () => (offline = true);
		window.addEventListener('online', on);
		window.addEventListener('offline', off);
		return () => {
			window.removeEventListener('online', on);
			window.removeEventListener('offline', off);
		};
	});
</script>

{#if offline}
	<div class="banner" role="status" aria-live="polite">
		<WifiOff size={16} aria-hidden="true" />
		<span>You are offline. Entries will sync when you reconnect.</span>
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
</style>
