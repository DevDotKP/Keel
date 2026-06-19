<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import OfflineBanner from '$lib/components/OfflineBanner.svelte';

	let { children } = $props();

	// Auth pages don't use the app chrome.
	const showChrome = $derived(!page.url.pathname.startsWith('/auth'));
</script>

<svelte:head>
	<title>Keel</title>
</svelte:head>

<OfflineBanner />

<main class="main" class:full-height={!showChrome}>
	{@render children()}
</main>

{#if showChrome}
	<BottomNav />
{/if}

<style>
	.main {
		max-width: 480px;
		margin: 0 auto;
		min-height: calc(100dvh - var(--nav-height));
	}

	.main.full-height {
		min-height: 100dvh;
		max-width: 100%;
	}
</style>
