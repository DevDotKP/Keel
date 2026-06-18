<script lang="ts">
	import { Plus } from 'lucide-svelte';
	import AddTransactionSheet from '$lib/components/AddTransactionSheet.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let sheetOpen = $state(false);

	// TODO(sonnet): implement onsubmit — POST to /api/transactions,
	// invalidate the page data, close the sheet.
	async function handleSubmit() {
		throw new Error('Not implemented');
	}
</script>

<svelte:head>
	<title>Dashboard - Keel</title>
</svelte:head>

<div class="dashboard">
	<!-- Hero: money remaining this period -->
	<section class="hero" aria-label="Balance summary">
		<p class="hero-label">Remaining this period</p>
		<!-- aria-live so screen readers announce balance updates after add -->
		<p class="money-hero" aria-live="polite" aria-atomic="true">
			<!-- TODO(sonnet): render data.summary.remaining_paise via formatPaise() -->
			<span class="placeholder">--</span>
		</p>
		<p class="hero-sub">
			<!-- TODO(sonnet): render period date range from data.summary.current_period -->
			<span class="placeholder-text">Loading period...</span>
		</p>
	</section>

	<!-- Harbour open-loop pull (Zeigarnik, not guilt) -->
	<!-- TODO(sonnet): show only when data.summary.open_periods > 0 -->
	<a href="/harbour" class="harbour-nudge" aria-label="Go to Harbour">
		Come to harbour <span aria-hidden="true">·</span> ~2 min
	</a>

	<!-- Recent transactions -->
	<section class="ledger-section">
		<h2 class="section-head">Recent</h2>

		<!-- TODO(sonnet): render data.transactions as a ledger list.
		     Each row: description, category dot, date, amount right-aligned.
		     Amount color: income = teal, expense = ink.
		     Uncategorized = calm gold dot, not an alarm. -->
		<EmptyState
			heading="No entries yet"
			body="Add your first expense below."
		/>
	</section>

	<!-- FAB: add transaction -->
	<button
		class="fab"
		onclick={() => (sheetOpen = true)}
		aria-label="Add expense"
	>
		<Plus size={24} aria-hidden="true" />
	</button>
</div>

<AddTransactionSheet
	open={sheetOpen}
	categories={data.categories ?? []}
	onclose={() => (sheetOpen = false)}
	onsubmit={handleSubmit}
/>

<style>
	.dashboard {
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.hero {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-6) 0;
	}

	.hero-label {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.hero-sub {
		font-size: 0.875rem;
		color: var(--color-text-subtle);
	}

	.placeholder {
		color: var(--color-neutral-300);
	}

	.placeholder-text {
		color: var(--color-neutral-300);
	}

	.harbour-nudge {
		display: block;
		padding: var(--space-3) var(--space-4);
		background: var(--color-neutral-50);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		text-decoration: none;
		min-height: var(--tap-target);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		transition: background var(--duration-fast) var(--ease-out);
	}

	.harbour-nudge:hover {
		background: var(--color-neutral-100);
	}

	.ledger-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	/* FAB: gold, bottom-right above nav */
	.fab {
		position: fixed;
		bottom: calc(var(--nav-height) + var(--space-4));
		right: var(--space-6);
		width: 56px;
		height: 56px;
		min-width: 56px;
		border-radius: var(--radius-full);
		background: var(--color-gold);
		color: var(--color-ink);
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 4px 16px rgba(224, 168, 46, 0.35);
		transition: transform var(--duration-fast) var(--ease-out),
		            box-shadow var(--duration-fast) var(--ease-out);
		z-index: var(--z-overlay);
	}

	.fab:active {
		transform: scale(0.95);
		box-shadow: 0 2px 8px rgba(224, 168, 46, 0.25);
	}
</style>
