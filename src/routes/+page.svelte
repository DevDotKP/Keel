<script lang="ts">
	import { Plus, Trash2, Anchor, ChevronRight, ChevronDown } from 'lucide-svelte';
	import { invalidateAll } from '$app/navigation';
	import AddTransactionSheet from '$lib/components/AddTransactionSheet.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { formatPaise, formatPaiseLedger } from '$lib/utils/money';
	import { formatDisplayDate } from '$lib/utils/date';
	import type { PageData } from './$types';
	import type { TransactionDraft, ReconciliationPeriod } from '$lib/types';

	let { data }: { data: PageData } = $props();

	let sheetOpen = $state(false);
	let essentialsOpen = $state(false);

	// Lookup category metadata (colour, name) by id for ledger rows.
	let catById = $derived(new Map(data.categories.map((c) => [c.id, c])));

	// The essentials the reserve is made of: committed categories with a daily rate.
	let reservedEssentials = $derived(
		data.categories
			.filter((c) => c.bucket === 'committed' && c.daily_reserve_paise > 0)
			.sort((a, b) => b.daily_reserve_paise - a.daily_reserve_paise)
	);

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
				note: draft.note,
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
	<!-- Hero: what is actually safe to spend, after obligations and essentials -->
	<section class="hero" aria-label="Safe to spend">
		<p class="hero-label">Safe to spend</p>
		<p
			class="money-hero"
			class:over-committed={(data.summary?.safe_to_spend_paise ?? 0) < 0}
			aria-live="polite"
			aria-atomic="true"
		>
			{formatPaise(data.summary?.safe_to_spend_paise ?? 0)}
		</p>
		<p class="hero-sub">
			{#if data.summary}
				{#if data.summary.safe_to_spend_paise < 0}
					Your commitments run ahead of your balance this period.
				{:else}
					Free to spend before your next harbour · {periodRange(data.summary.current_period)}
				{/if}
			{/if}
		</p>
	</section>

	<!-- The breakdown: how safe-to-spend is derived. Calm, never scolding. -->
	{#if data.summary && (data.summary.locked_obligations_paise > 0 || data.summary.locked_reserve_paise > 0)}
		<section class="breakdown" aria-label="How safe to spend is calculated">
			<div class="breakdown-row">
				<span class="breakdown-label">Remaining this period</span>
				<span class="money breakdown-amount">{formatPaiseLedger(data.summary.remaining_paise)}</span>
			</div>
			{#if data.summary.locked_obligations_paise > 0}
				<div class="breakdown-row">
					<span class="breakdown-label">Obligations still due</span>
					<span class="money breakdown-amount muted"
						>−{formatPaiseLedger(data.summary.locked_obligations_paise)}</span
					>
				</div>
			{/if}
			{#if data.summary.locked_reserve_paise > 0}
				<div class="breakdown-row">
					<button
						class="breakdown-label breakdown-toggle"
						class:open={essentialsOpen}
						onclick={() => (essentialsOpen = !essentialsOpen)}
						aria-expanded={essentialsOpen}
						aria-controls="essentials-list"
						disabled={reservedEssentials.length === 0}
					>
						<span class="toggle-head">
							Reserved for essentials
							{#if reservedEssentials.length > 0}
								<span class="toggle-chevron" aria-hidden="true">
									{#if essentialsOpen}<ChevronDown size={14} />{:else}<ChevronRight size={14} />{/if}
								</span>
							{/if}
						</span>
						<span class="breakdown-note">
							{formatPaise(data.summary.daily_reserve_paise)}/day for
							{data.summary.days_remaining}
							{data.summary.days_remaining === 1 ? 'day' : 'days'} left this cycle
						</span>
					</button>
					<span class="money breakdown-amount muted"
						>−{formatPaiseLedger(data.summary.locked_reserve_paise)}</span
					>
				</div>
				{#if essentialsOpen && reservedEssentials.length > 0}
					<ul class="essentials-list" id="essentials-list">
						{#each reservedEssentials as ess (ess.id)}
							<li class="essential-row">
								<span class="essential-name">{ess.name}</span>
								<span class="money essential-amount"
									>{formatPaise(ess.daily_reserve_paise)}/day</span
								>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
			<div class="breakdown-row breakdown-total">
				<span class="breakdown-label">Safe to spend</span>
				<span class="money breakdown-amount total-amount"
					>{formatPaiseLedger(data.summary.safe_to_spend_paise)}</span
				>
			</div>
		</section>
	{/if}

	<!-- Harbour open-loop pull (Zeigarnik, not guilt). Shown once there is something to settle. -->
	{#if data.transactions.length > 0}
		<a href="/harbour" class="harbour-nudge" aria-label="Come to harbour, about two minutes">
			<span class="harbour-disc" aria-hidden="true">
				<Anchor size={18} />
			</span>
			<span class="harbour-text">
				<span class="harbour-title">Come to harbour</span>
				<span class="harbour-sub">Settle this cycle · about 2 min</span>
			</span>
			<ChevronRight class="harbour-chevron" size={20} aria-hidden="true" />
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
					{@const uncategorized = cat?.name === 'Uncategorized' || tx.is_uncategorized_fallback === 1}
					<li class="ledger-row">
						<span class="ledger-main">
							<span class="ledger-desc">{tx.description || cat?.name || 'Expense'}</span>
							<span class="ledger-meta">
								{#if uncategorized}
									<span class="uncat-dot" aria-hidden="true"></span>
								{/if}
								{#if tx.description}
									<span class="ledger-cat">{cat?.name ?? 'Uncategorized'}</span>
									<span class="meta-sep" aria-hidden="true">·</span>
								{/if}
								<span class="ledger-date">{formatDisplayDate(tx.occurred_at)}</span>
							</span>
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

	/* Over-committed is a genuine attention state: clay, never red alarm. */
	.money-hero.over-committed {
		color: var(--color-clay);
	}

	.breakdown {
		display: flex;
		flex-direction: column;
		padding: var(--space-4) var(--space-5);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.breakdown-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-2) 0;
	}

	.breakdown-label {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		display: flex;
		flex-direction: column;
	}

	.breakdown-note {
		font-size: 0.75rem;
		color: var(--color-text-subtle);
	}

	.breakdown-amount {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
		white-space: nowrap;
	}

	.breakdown-amount.muted {
		color: var(--color-text-muted);
		font-weight: 500;
	}

	/* Expandable "Reserved for essentials" toggle */
	.breakdown-toggle {
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		text-align: left;
		cursor: pointer;
		font: inherit;
		color: var(--color-text-muted);
	}

	.breakdown-toggle:disabled {
		cursor: default;
	}

	.toggle-head {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-size: 0.9375rem;
	}

	.toggle-chevron {
		display: inline-flex;
		color: var(--color-text-subtle);
	}

	.essentials-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin: 0 0 var(--space-2) var(--space-3);
		padding: var(--space-2) 0 var(--space-1) var(--space-3);
		border-left: 2px solid var(--color-border);
	}

	.essential-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-4);
	}

	.essential-name {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.essential-amount {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
		white-space: nowrap;
	}

	/* The answer dominates: Fraunces, larger, full ink. */
	.breakdown-total {
		margin-top: var(--space-2);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border);
		align-items: center;
	}

	.breakdown-total .breakdown-label {
		font-size: 1.0625rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.breakdown-amount.total-amount {
		font-family: var(--font-display);
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--color-text);
	}

	/* Harbour: the open-loop invitation. Icon disc, two lines, chevron. Not gold. */
	.harbour-nudge {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		text-decoration: none;
		min-height: var(--tap-target);
		transition:
			border-color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.harbour-nudge:hover {
		border-color: var(--color-text-subtle);
	}

	.harbour-nudge:active {
		transform: scale(0.99);
	}

	.harbour-disc {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-full);
		background: var(--color-surface-subtle);
		color: var(--color-text);
	}

	.harbour-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
		min-width: 0;
	}

	.harbour-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.harbour-sub {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.harbour-nudge :global(.harbour-chevron) {
		flex: none;
		color: var(--color-text-subtle);
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

	.ledger-meta {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
	}

	/* The one meaningful dot: gold = uncategorized, settle it at Harbour. */
	.uncat-dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		background: var(--color-gold);
	}

	.ledger-cat {
		color: var(--color-text-muted);
	}

	.meta-sep {
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
