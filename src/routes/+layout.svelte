<script lang="ts">
	import '../app.css';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import OfflineBanner from '$lib/components/OfflineBanner.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Keel</title>
</svelte:head>

<OfflineBanner />

<main class="main">
	{@render children()}
</main>

<BottomNav />

<style>
	.main {
		max-width: 480px;
		margin: 0 auto;
		min-height: calc(100dvh - var(--nav-height));
	}
</style>
