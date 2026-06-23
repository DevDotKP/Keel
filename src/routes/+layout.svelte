<script lang="ts">
	import '../app.css';
	import { page, navigating } from '$app/state';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import OfflineBanner from '$lib/components/OfflineBanner.svelte';
	import ClarityLoader from '$lib/components/ClarityLoader.svelte';
	import InstallPrompt from '$lib/components/InstallPrompt.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { children } = $props();

	const showChrome = $derived(
		!page.url.pathname.startsWith('/auth') &&
			!page.url.pathname.startsWith('/opt-out') &&
			!page.url.pathname.startsWith('/admin')
	);
</script>

<svelte:head>
	<title>Keel</title>
</svelte:head>

{#if navigating.to}
	<div class="nav-bar" aria-hidden="true"></div>
{/if}

<OfflineBanner />

<main class="main" class:full-height={!showChrome}>
	{@render children()}
</main>

<InstallPrompt />
<Toast />

{#if showChrome}
	<BottomNav />
	<ClarityLoader />
{/if}

<style>
	.nav-bar {
		position: fixed;
		top: 0;
		left: 0;
		height: 2px;
		background: var(--color-gold);
		z-index: 9999;
		animation: nav-advance 2s ease-out forwards;
	}

	@keyframes nav-advance {
		0%   { width: 0%;  opacity: 1; }
		60%  { width: 75%; opacity: 1; }
		100% { width: 90%; opacity: 0.9; }
	}

	.main {
		max-width: 480px;
		margin: 0 auto;
		min-height: calc(100dvh - var(--nav-height));
	}

	.main.full-height {
		min-height: 100dvh;
		max-width: 100%;
	}

	@media (min-width: 768px) {
		.main {
			max-width: min(960px, calc(100vw - var(--sidebar-width)));
			margin-left: var(--sidebar-width);
			margin-right: auto;
			min-height: 100dvh;
		}

		.main.full-height {
			margin-left: 0;
			max-width: 100%;
		}
	}
</style>
