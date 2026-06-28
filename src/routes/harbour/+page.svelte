<script lang="ts">
	import { goto } from '$app/navigation';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import HelpTip from '$lib/components/HelpTip.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { formatPaise, formatPaiseLedger, parseToPaise, amountInWordsIndian } from '$lib/utils/money';
	import { formatDisplayDate } from '$lib/utils/date';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let submitting = $state(false);
	let balanceInput = $state(initialBalance());
	let error = $state<string | null>(null);

	// Prefill with Keel's estimate so the user confirms or adjusts, not types from zero.
	function initialBalance(): string {
		if (!data.period || data.estimatePaise <= 0) return '';
		return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(
			data.estimatePaise / 100
		);
	}

	let catById = $derived(new Map(data.categories.map((c) => [c.id, c])));
	let enteredPaise = $derived(parseToPaise(balanceInput));
	let drift = $derived(enteredPaise !== null ? enteredPaise - data.estimatePaise : null);

	function handleBalanceInput(e: Event) {
		const raw = (e.currentTarget as HTMLInputElement).value.replace(/[^\d.]/g, '');
		if (!raw) { balanceInput = ''; return; }
		const hasTrailingDot = raw.endsWith('.');
		const num = parseFloat(raw);
		if (isNaN(num)) { balanceInput = raw; return; }
		const grouped = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(num);
		balanceInput = hasTrailingDot ? grouped + '.' : grouped;
	}

	function periodRange(): string {
		if (!data.period) return '';
		return `${formatDisplayDate(data.period.period_start)} to ${formatDisplayDate(data.period.period_end)}`;
	}

	async function handleHarbour(freshStart: boolean) {
		if (!data.period || enteredPaise === null) {
			error = 'Enter your balance to close the period';
			return;
		}
		submitting = true;
		error = null;
		const res = await fetch(`/api/periods/${data.period.id}/harbour`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ closing_balance_paise: enteredPaise, fresh_start: freshStart })
		});
		submitting = false;
		if (!res.ok) {
			error = 'Could not close the period. Try again.';
			return;
		}
		await goto('/');
	}
</script>

<svelte:head>
	<title>Harbour - Keel</title>
</svelte:head>

<div class="harbour-page">
	<header class="page-header">
		<div class="harbour-title-row">
			<h1 class="section-head">Harbour</h1>
			<HelpTip
				term="Harbour"
				text="A quick check-in where you confirm your real balance. Keel squares any gap, so a missed entry never breaks your total."
			/>
			{#if data.harbourVisits > 0}
				<span class="visits-badge" aria-label="{data.harbourVisits} harbour visits">
					{data.harbourVisits} {data.harbourVisits === 1 ? 'visit' : 'visits'}
				</span>
			{/if}
		</div>
		<p class="page-sub">{periodRange()}</p>
		<p class="harbour-intro">
			Back to harbour. Confirm what's really in your account and Keel squares the difference, then seals the period.
		</p>
	</header>

	<!-- The reckoning: estimate → your real balance → the difference Keel squares. -->
	<section class="reconcile" aria-label="Reconcile your balance">
		<div class="rec-estimate">
			<span class="rec-label">Keel's estimate</span>
			<span class="rec-estimate-val money">{formatPaise(data.estimatePaise)}</span>
		</div>

		<div class="rec-field">
			<label for="actual-balance" class="rec-field-label">What's actually in your account?</label>
			<p class="rec-hint">Check your bank or UPI app. Prefilled with Keel's estimate, change it if it's off.</p>
			<div class="balance-input-row">
				<span class="currency-symbol" aria-hidden="true">₹</span>
				<input
					id="actual-balance"
					type="text"
					inputmode="decimal"
					placeholder="0"
					value={balanceInput}
					oninput={handleBalanceInput}
					class="balance-input money"
					aria-label="Actual balance in rupees"
				/>
			</div>
			{#if enteredPaise !== null && amountInWordsIndian(enteredPaise)}
				<p class="balance-words">{amountInWordsIndian(enteredPaise)}</p>
			{/if}
		</div>

		{#if drift !== null && drift !== 0}
			<div class="rec-drift">
				<span class="rec-label">Difference</span>
				<span class="rec-drift-val money">{drift > 0 ? '+' : '−'}{formatPaiseLedger(Math.abs(drift))}</span>
			</div>
			<p class="drift-note">Keel files this as Uncategorized so your total stays clean. No hunting for the gap.</p>
		{:else if drift === 0 && enteredPaise !== null}
			<p class="drift-note">Spot on. Nothing to reconcile.</p>
		{/if}
	</section>

	<section class="entries">
		<h2 class="entries-head">What you logged this period</h2>
		{#if data.transactions.length === 0}
			<EmptyState heading="Nothing logged yet" body="Add entries, then come back to settle." />
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
						<span class="money {income ? 'money--income' : 'money--expense'}">
							{income ? '+' : ''}{formatPaiseLedger(Math.abs(tx.amount_paise))}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	<div class="actions">
		{#if data.openPeriods > 1}
			<!-- Amnesty: behind by several periods. Start fresh is the recommended,
			     forgiving path; it seals them all at once. Settling one is secondary. -->
			<p class="amnesty-note">
				You're {data.openPeriods} periods behind. Starting fresh seals them all in one step, no need to settle each.
			</p>
			<button
				class="primary-btn"
				disabled={submitting || enteredPaise === null}
				onclick={() => handleHarbour(true)}
			>
				{#if submitting}
					<Spinner size={18} label="Starting fresh" />
				{:else}
					Start fresh from today
				{/if}
			</button>
			<button
				class="secondary-btn"
				disabled={submitting || enteredPaise === null}
				onclick={() => handleHarbour(false)}
			>
				Settle just this period
			</button>
		{:else}
			<button
				class="primary-btn"
				disabled={submitting || enteredPaise === null}
				onclick={() => handleHarbour(false)}
			>
				{#if submitting}
					<Spinner size={18} label="Closing period" />
				{:else}
					Close this period
				{/if}
			</button>
		{/if}
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

	.harbour-title-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	/* Harbour visit count: a warm total, never a streak. */
	.visits-badge {
		display: inline-flex;
		padding: 2px var(--space-3);
		border-radius: var(--radius-full);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
	}

	.harbour-intro {
		font-size: 0.9375rem;
		line-height: 1.5;
		color: var(--color-text-muted);
		margin-top: var(--space-1);
	}

	/* Reconcile card: the reckoning. Estimate vs your real balance vs difference. */
	.reconcile {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-5);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	.rec-estimate,
	.rec-drift {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.rec-label {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.rec-estimate-val {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums lining-nums;
	}

	.rec-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4) 0;
		border-top: 1px solid var(--color-border);
		border-bottom: 1px solid var(--color-border);
	}

	.rec-field-label {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.rec-hint {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
		line-height: 1.4;
	}

	.rec-drift-val {
		font-family: var(--font-display);
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-text);
		font-variant-numeric: tabular-nums lining-nums;
	}

	.entries {
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
		padding: var(--space-3) 0;
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

	.entries-head {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-subtle);
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

	.balance-words {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
		padding-top: var(--space-1);
	}

	.drift-note {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.error {
		color: var(--color-clay);
		font-size: 0.875rem;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.amnesty-note {
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--color-text-muted);
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

	.secondary-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 48px;
		background: transparent;
		color: var(--color-text-muted);
		font-weight: 500;
		font-size: 0.9375rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
	}

	.secondary-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
