<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { invalidateAll } from '$app/navigation';
	import { formatPaise, formatPaiseLedger, parseToPaise } from '$lib/utils/money';
	import { formatDisplayDate } from '$lib/utils/date';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let editing = $state<string | null>(null); // category_id whose budget is being edited
	let editValue = $state('');
	let busy = $state(false);
	let overallEditing = $state(false);
	let overallValue = $state('');

	// Percent of budget used, capped at 100 for the bar width (over shows separately).
	function pct(spent: number, budget: number): number {
		if (budget <= 0) return 0;
		return Math.min(100, Math.round((spent / budget) * 100));
	}

	function startEdit(categoryId: string, current: number) {
		editing = categoryId;
		editValue = current ? (current / 100).toString() : '';
	}

	async function saveBudget(categoryId: string) {
		busy = true;
		const paise = parseToPaise(editValue) ?? 0;
		const res = await fetch(`/api/categories/${categoryId}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ budget_paise: paise })
		});
		busy = false;
		editing = null;
		if (res.ok) await invalidateAll();
	}

	async function saveOverall() {
		busy = true;
		const paise = parseToPaise(overallValue) ?? 0;
		const res = await fetch('/api/settings', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ cycle_budget_paise: paise })
		});
		busy = false;
		overallEditing = false;
		if (res.ok) await invalidateAll();
	}

	function startOverall(current: number) {
		overallEditing = true;
		overallValue = current ? (current / 100).toString() : '';
	}
</script>

<svelte:head>
	<title>Insights - Keel</title>
</svelte:head>

<div class="insights-page">
	<header class="page-header">
		<h1 class="section-head">Insights</h1>
		{#if data.overview}
			<p class="page-sub">
				{formatDisplayDate(data.overview.period.period_start)} to {formatDisplayDate(
					data.overview.period.period_end
				)}
			</p>
		{/if}
	</header>

	{#if !data.overview || (data.overview.by_category.length === 0 && data.overview.cycle_budget_paise === 0)}
		<EmptyState
			heading="Nothing to show yet"
			body="Add a few expenses, or set a budget below, to see where your money goes."
		/>
	{/if}

	{#if data.overview}
		{@const o = data.overview}
		<!-- Overall cycle target -->
		<section class="overall" aria-label="Overall budget">
			<div class="overall-head">
				<span class="overall-label">This cycle</span>
				{#if overallEditing}
					<span class="edit-row">
						<span class="currency-symbol" aria-hidden="true">₹</span>
						<input
							type="text"
							inputmode="decimal"
							class="budget-input money"
							bind:value={overallValue}
							placeholder="target"
							aria-label="Overall cycle target in rupees"
						/>
						<button class="save-btn" onclick={saveOverall} disabled={busy}>Save</button>
					</span>
				{:else}
					<button class="overall-amount" onclick={() => startOverall(o.cycle_budget_paise)}>
						{#if o.cycle_budget_paise > 0}
							<span class="money">{formatPaiseLedger(o.total_spent_paise)}</span>
							<span class="of">of {formatPaiseLedger(o.cycle_budget_paise)}</span>
						{:else}
							<span class="money">{formatPaiseLedger(o.total_spent_paise)} spent</span>
							<span class="set-link">Set a target</span>
						{/if}
					</button>
				{/if}
			</div>
			{#if o.cycle_budget_paise > 0}
				{@const over = o.total_spent_paise > o.cycle_budget_paise}
				<div class="bar" class:over>
					<div class="bar-fill" style="width:{pct(o.total_spent_paise, o.cycle_budget_paise)}%"></div>
				</div>
				{#if over}
					<p class="over-note">
						{formatPaiseLedger(o.total_spent_paise - o.cycle_budget_paise)} over your target. No problem, it is just a marker.
					</p>
				{/if}
			{/if}
		</section>

		<!-- Spend by category, with optional soft caps -->
		{#if o.by_category.length > 0}
			<section class="categories" aria-label="Spend by category">
				<h2 class="group-head">By category</h2>
				{#each o.by_category as c (c.category_id)}
					{@const over = c.budget_paise > 0 && c.spent_paise > c.budget_paise}
					<div class="cat-budget">
						<div class="cat-head">
							<span class="cat-name">{c.name}</span>
							{#if editing === c.category_id}
								<span class="edit-row">
									<span class="currency-symbol" aria-hidden="true">₹</span>
									<input
										type="text"
										inputmode="decimal"
										class="budget-input money"
										bind:value={editValue}
										placeholder="budget"
										aria-label="Budget for {c.name}"
									/>
									<button class="save-btn" onclick={() => saveBudget(c.category_id)} disabled={busy}
										>Save</button
									>
								</span>
							{:else}
								<button
									class="cat-amount"
									class:over
									onclick={() => startEdit(c.category_id, c.budget_paise)}
								>
									<span class="money">{formatPaiseLedger(c.spent_paise)}</span>
									{#if c.budget_paise > 0}
										<span class="of">of {formatPaiseLedger(c.budget_paise)}</span>
										{#if over}<span class="over-tag">over</span>{/if}
									{:else}
										<span class="set-link">Set budget</span>
									{/if}
								</button>
							{/if}
						</div>
						{#if c.budget_paise > 0}
							<div class="bar" class:over>
								<div class="bar-fill" style="width:{pct(c.spent_paise, c.budget_paise)}%"></div>
							</div>
						{/if}
					</div>
				{/each}
			</section>
		{/if}
	{/if}
</div>

<style>
	.insights-page {
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
		padding-bottom: calc(var(--space-6) + var(--nav-height));
	}

	.page-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.page-sub {
		font-size: 0.875rem;
		color: var(--color-text-subtle);
	}

	.group-head {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-bottom: var(--space-2);
	}

	.overall {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-5);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.overall-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.overall-label {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.overall-amount,
	.cat-amount {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		color: var(--color-text);
		font: inherit;
	}

	.overall-amount .money {
		font-size: 1.0625rem;
		font-weight: 700;
	}

	.of {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.set-link {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.categories {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.cat-budget {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.cat-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.cat-name {
		font-size: 0.9375rem;
		color: var(--color-text);
	}

	.cat-amount .money {
		font-size: 0.9375rem;
		font-weight: 600;
	}

	.cat-amount.over .money {
		color: var(--color-clay);
	}

	.over-tag {
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-clay);
		font-weight: 600;
	}

	/* Progress bar: ink fill on a calm track. Over budget tints clay, never red. */
	.bar {
		height: 6px;
		border-radius: var(--radius-full);
		background: var(--color-neutral-200);
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		border-radius: var(--radius-full);
		background: var(--color-text-muted);
		transition: width var(--duration-normal) var(--ease-out);
	}

	.bar.over .bar-fill {
		background: var(--color-clay);
	}

	.over-note {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.edit-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.currency-symbol {
		font-size: 1rem;
		color: var(--color-text-muted);
	}

	.budget-input {
		width: 90px;
		height: 36px;
		padding: 0 var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		font-size: 0.9375rem;
		color: var(--color-text);
	}

	.budget-input:focus {
		outline: none;
		border-color: var(--color-gold);
	}

	.save-btn {
		height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
	}

	.save-btn:disabled {
		opacity: 0.5;
	}
</style>
