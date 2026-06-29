<script lang="ts">
	import '../app.css';
	import { page, navigating } from '$app/state';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import OfflineBanner from '$lib/components/OfflineBanner.svelte';
	import ClarityLoader from '$lib/components/ClarityLoader.svelte';
	import InstallPrompt from '$lib/components/InstallPrompt.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { setCurrency } from '$lib/utils/money';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	// Sync the money formatter whenever the account's currency changes
	// (layout data re-runs after PATCH /api/account + invalidateAll).
	$effect(() => { setCurrency(data.currency ?? 'INR'); });

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

{#if data.isDemo && showChrome}
	<div class="demo-banner" role="status">
		<span class="demo-banner-text">Demo mode. Nothing here is saved.</span>
		<!-- Sign out first: a demo user is logged in, so a plain /auth link would
		     bounce straight back here. Signout clears the session, then lands on /auth. -->
		<form method="POST" action="/api/auth/signout" class="demo-banner-form">
			<button type="submit" class="demo-banner-btn">Sign up</button>
		</form>
	</div>
{/if}

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

	.demo-banner {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-3);
		padding: var(--space-2) var(--space-4);
		background: color-mix(in srgb, var(--color-gold) 16%, var(--color-bg));
		border-bottom: 1px solid color-mix(in srgb, var(--color-gold) 40%, transparent);
		font-size: 0.8125rem;
		color: var(--color-text);
		text-align: center;
	}

	.demo-banner-text {
		min-width: 0;
	}

	.demo-banner-form {
		display: flex;
		flex: none;
	}

	.demo-banner-btn {
		appearance: none;
		border: none;
		background: var(--color-gold);
		color: var(--color-ink);
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 700;
		padding: var(--space-1) var(--space-3);
		min-height: 28px;
		border-radius: var(--radius-full);
		cursor: pointer;
		white-space: nowrap;
	}

	.main {
		max-width: 480px;
		margin: 0 auto;
		/* svh, not dvh: dvh grows as the iOS toolbar hides, adding scroll past the page. */
		min-height: calc(100svh - var(--nav-height));
	}

	.main.full-height {
		min-height: 100svh;
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
