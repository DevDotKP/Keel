<script lang="ts">
	import { Plus, Trash2 } from 'lucide-svelte';
	import { invalidateAll } from '$app/navigation';
	import AddTransactionSheet from '$lib/components/AddTransactionSheet.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { formatPaise, formatPaiseLedger } from '$lib/utils/money';
	import { formatDisplayDate } from '$lib/utils/date';
	import type { PageData } from './$types';
	import type { TransactionDraft, ReconciliationPeriod } from '$lib/types';

	let { data }: { data: PageData } = $props();

	let sheetOpen = $state(false);

	// Lookup category metadata (colour, name) by id for ledger rows.
	let catById = $derived(new Map(data.categories.map((c) => [c.id, c])));

	function periodRange(p: ReconciliationPeriod): string {
		return `${formatDisplayDate(p.period_start)} to ${formatDisplayDate(p.period_end)}`;
	}

	// POST the draft, then refresh page data so the ledger and hero update.
	async function handleSubmit(draft: Required<TransactionDraft>): Promise<void> {
		const res = await fetch('/api/transactions', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				category_id: draft.category_id || undefined,
				amount_paise: draft.amount_paise,
				description: draft.description,
				occurred_at: draft.occurred_at,
				source: 'tap'
			})
		});
		if (!res.ok) throw new Error('Save failed');
		await invalidateAll();
	}

	async function handleDelete(id: string): Promise<void> {
		const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
		if (res.ok) await invalidateAll();
	}
</script>

<svelte:head>
	<title>Dashboard - Keel</title>
</svelte:head>

<div class="dashboard">
	<!-- Hero: money remaining this period -->
	<section class="hero" aria-label="Balance summary">
		<p class="hero-label">Remaining this period</p>
		<p class="money-hero" aria-live="polite" aria-atomic="true">
			{formatPaise(data.summary?.remaining_paise ?? 0)}
		</p>
		<p class="hero-sub">
			{#if data.summary}
				{periodRange(data.summary.current_period)}
			{/if}
		</p>
	</section>

	<!-- Harbour open-loop pull (Zeigarnik, not guilt). Shown once there is something to settle. -->
	{#if data.transactions.length > 0}
		<a href="/harbour" class="harbour-nudge" aria-label="Go to Harbour">
			Come to harbour <span aria-hidden="true">·</span> ~2 min
		</a>
	{/if}

	<!-- Recent transactions -->
	<section class="ledger-section">
		<h2 class="section-head">Recent</h2>

		{#if data.transactions.length === 0}
			<EmptyState heading="No entries yet" body="Add your first expense below." />
		{:else}
			<ul class="ledger">
				{#each data.transactions as tx (tx.id)}
					{@const cat = catById.get(tx.category_id)}
					{@const income = tx.amount_paise >= 0}
					<li class="ledger-row">
						<span
							class="cat-dot"
							style="background: {cat?.color ?? 'var(--color-neutral-300)'}"
							aria-hidden="true"
						></span>
						<span class="ledger-main">
							<span class="ledger-desc">{tx.description || cat?.name || 'Expense'}</span>
							<span class="ledger-date">{formatDisplayDate(tx.occurred_at)}</span>
						</span>
						<span class="money ledger-amount {income ? 'money--income' : 'money--expense'}">
							{income ? '+' : ''}{formatPaiseLedger(Math.abs(tx.amount_paise))}
						</span>
						<button
							class="row-delete"
							onclick={() => handleDelete(tx.id)}
							aria-label="Delete {tx.description || 'entry'}"
						>
							<Trash2 size={16} aria-hidden="true" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- FAB: add transaction -->
	<button class="fab" onclick={() => (sheetOpen = true)} aria-label="Add expense">
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
		min-height: 1.2em;
	}

	.harbour-nudge {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		background: var(--color-neutral-50);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		text-decoration: none;
		min-height: var(--tap-target);
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

	.ledger {
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.ledger-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.cat-dot {
		flex: none;
		width: 10px;
		height: 10px;
		border-radius: var(--radius-full);
	}

	.ledger-main {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}

	.ledger-desc {
		font-size: 0.9375rem;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ledger-date {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
	}

	.ledger-amount {
		flex: none;
		font-size: 0.9375rem;
		font-weight: 600;
	}

	/* Subtle, low-emphasis delete. 44px tap target, muted until hover. */
	.row-delete {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--tap-target);
		height: var(--tap-target);
		min-width: var(--tap-target);
		border: none;
		background: transparent;
		color: var(--color-text-subtle);
		border-radius: var(--radius-full);
		cursor: pointer;
		opacity: 0.5;
		transition:
			opacity var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.row-delete:hover {
		opacity: 1;
		color: var(--color-clay);
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
		transition:
			transform var(--duration-fast) var(--ease-out),
			box-shadow var(--duration-fast) var(--ease-out);
		z-index: var(--z-overlay);
	}

	.fab:active {
		transform: scale(0.95);
		box-shadow: 0 2px 8px rgba(224, 168, 46, 0.25);
	}
</style>
