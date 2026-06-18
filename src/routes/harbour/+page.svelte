<script lang="ts">
	import Spinner from '$lib/components/Spinner.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let submitting = $state(false);
	let balanceInput = $state('');

	// TODO(sonnet): implement handleHarbour — POST to /api/periods/[id]/harbour
	// with closing_balance_paise and fresh_start flag.
	async function handleHarbour(_freshStart: boolean) {
		throw new Error('Not implemented');
	}
</script>

<svelte:head>
	<title>Harbour - Keel</title>
</svelte:head>

<div class="harbour-page">
	<header class="page-header">
		<h1 class="section-head">Harbour</h1>
		<p class="page-sub">Squared the balance for this period.</p>
	</header>

	<!-- Period summary: grouped by category -->
	<!-- TODO(sonnet): render data.summary?.by_category as a category breakdown table.
	     Show categorized vs uncategorized totals.
	     Uncategorized: calm gold dot, no alarm language. -->
	<EmptyState
		heading="Nothing to harbour yet"
		body="Add some entries and come back to close the period."
	/>

	<!-- Drift: Keel's estimate vs real balance -->
	<section class="drift-section">
		<h2 class="section-head">Your actual balance</h2>
		<p class="drift-hint">Enter your balance from your bank or UPI app.</p>
		<div class="balance-input-row">
			<span class="currency-symbol" aria-hidden="true">Rs</span>
			<input
				type="text"
				inputmode="decimal"
				placeholder="0"
				bind:value={balanceInput}
				class="balance-input money"
				aria-label="Actual balance in rupees"
			/>
		</div>
		<!-- TODO(sonnet): show drift = input - keel_estimate, neutral language,
		     trending graph over past periods. -->
	</section>

	<!-- Amnesty: fresh-start (default) or settle what I missed -->
	<!-- TODO(sonnet): show amnesty section only when data.openPeriods > 1 -->

	<div class="actions">
		<button
			class="primary-btn"
			disabled={submitting || !balanceInput}
			onclick={() => handleHarbour(false)}
		>
			{#if submitting}
				<Spinner size={18} label="Closing period" />
			{:else}
				Close this period
			{/if}
		</button>
	</div>
</div>

<style>
	.harbour-page {
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-8);
	}

	.page-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.page-sub {
		color: var(--color-text-muted);
		font-size: 0.9375rem;
	}

	.drift-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.drift-hint {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.balance-input-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.currency-symbol {
		font-family: var(--font-display);
		font-size: 1.5rem;
		color: var(--color-text-muted);
	}

	.balance-input {
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 600;
		border: none;
		border-bottom: 2px solid var(--color-border);
		border-radius: 0;
		background: transparent;
		padding: var(--space-1) 0;
		flex: 1;
	}

	.balance-input:focus {
		outline: none;
		border-bottom-color: var(--color-gold);
	}

	.primary-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
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

	.primary-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
</style>
