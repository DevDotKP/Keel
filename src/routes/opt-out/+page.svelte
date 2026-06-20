<script lang="ts">
	import { onMount } from 'svelte';

	const STORAGE_KEY = 'keel-no-clarity';

	let excluded = $state(false);
	let mounted = $state(false);

	onMount(() => {
		excluded = localStorage.getItem(STORAGE_KEY) === '1';
		mounted = true;
	});

	function enable() {
		localStorage.setItem(STORAGE_KEY, '1');
		excluded = true;
	}

	function disable() {
		localStorage.removeItem(STORAGE_KEY);
		excluded = false;
	}
</script>

<svelte:head>
	<title>Analytics exclusion — Keel</title>
</svelte:head>

{#if mounted}
	<div class="opt-out-page">
		{#if excluded}
			<div class="icon-wrap confirmed" aria-hidden="true">
				<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="20 6 9 17 4 12" />
				</svg>
			</div>
			<h1 class="heading">This browser is excluded</h1>
			<p class="body">Visits from this browser will not be counted in Clarity. Bookmark this page and revisit it on any other device or browser you want excluded.</p>
			<p class="note">This is stored in your browser. Clearing site data or using a different browser requires visiting this page again.</p>
			<button class="undo-btn" onclick={disable}>Count this browser again</button>
		{:else}
			<div class="icon-wrap" aria-hidden="true">
				<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="8" x2="12" y2="12" />
					<line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
			</div>
			<h1 class="heading">This browser is counted</h1>
			<p class="body">Clarity is currently tracking visits from this browser.</p>
			<button class="exclude-btn" onclick={enable}>Exclude this browser</button>
		{/if}
		<a href="/" class="home-link">Back to home</a>
	</div>
{/if}

<style>
	.opt-out-page {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-5);
		padding: var(--space-8) var(--space-6);
		max-width: 400px;
		margin: 0 auto;
		text-align: center;
	}

	.icon-wrap {
		width: 64px;
		height: 64px;
		border-radius: var(--radius-full);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-muted);
	}

	.icon-wrap.confirmed {
		background: color-mix(in srgb, var(--color-positive, #2f7e72) 12%, transparent);
		border-color: color-mix(in srgb, var(--color-positive, #2f7e72) 30%, transparent);
		color: var(--color-positive, #2f7e72);
	}

	.heading {
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--color-text);
		line-height: 1.25;
	}

	.body {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		line-height: 1.6;
	}

	.note {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
		line-height: 1.5;
	}

	.exclude-btn {
		width: 100%;
		height: 52px;
		background: var(--color-gold);
		color: var(--color-ink);
		font-weight: 700;
		font-size: 1rem;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
	}

	.undo-btn {
		width: 100%;
		height: 52px;
		background: transparent;
		color: var(--color-text-muted);
		font-weight: 500;
		font-size: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
	}

	.home-link {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
</style>
