<script lang="ts">
	import { ArrowLeft, Trash2, ChevronRight, ChevronDown } from 'lucide-svelte';
	import { invalidateAll } from '$app/navigation';
	import { formatPaise, formatPaiseLedger, parseToPaise, formatAmountInput } from '$lib/utils/money';
	import { formatDisplayDate } from '$lib/utils/date';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { PageData } from './$types';
	import type { Holding, HoldingKind } from '$lib/types';

	let { data }: { data: PageData } = $props();

	const KIND_LABELS: Record<HoldingKind, string> = {
		mutual_fund: 'Mutual fund',
		stock: 'Stocks',
		fd_rd: 'FD / RD',
		ppf_epf: 'PPF / EPF',
		gold: 'Gold',
		crypto: 'Crypto',
		real_estate: 'Real estate',
		cash: 'Cash',
		other: 'Other'
	};
	const KIND_OPTIONS = Object.entries(KIND_LABELS) as [HoldingKind, string][];

	let open = $state(false); // breakdown collapsed by default
	let removedIds = $state<string[]>([]);
	let editingId = $state<string | null>(null);
	let error = $state<string | null>(null);
	let busy = $state(false);

	let fName = $state('');
	let fKind = $state<HoldingKind>('mutual_fund');
	let fValue = $state('');
	let fValuePaise = $derived(parseToPaise(fValue));

	let visible = $derived(data.holdings.filter((h) => !removedIds.includes(h.id)));

	function startEdit(h: Holding) {
		editingId = h.id;
		fName = h.name;
		fKind = h.kind;
		fValue = formatAmountInput((h.value_paise / 100).toString());
		error = null;
		open = true;
	}

	function resetForm() {
		editingId = null;
		fName = '';
		fKind = 'mutual_fund';
		fValue = '';
		error = null;
	}

	async function save(e: Event) {
		e.preventDefault();
		if (!fName.trim()) {
			error = 'Enter a name';
			return;
		}
		if (fValuePaise === null || fValuePaise < 0) {
			error = 'Enter a valid value';
			return;
		}
		busy = true;
		error = null;
		const payload = { name: fName.trim(), kind: fKind, value_paise: fValuePaise };
		const url = editingId ? `/api/portfolio/${editingId}` : '/api/portfolio';
		const method = editingId ? 'PATCH' : 'POST';
		const res = await fetch(url, {
			method,
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
		busy = false;
		if (!res.ok) {
			error = 'Could not save. Try again.';
			return;
		}
		resetForm();
		await invalidateAll();
	}

	async function remove(id: string) {
		if (!confirm('Remove this holding?')) return;
		removedIds = [...removedIds, id];
		const res = await fetch(`/api/portfolio/${id}`, { method: 'DELETE' });
		if (!res.ok) {
			removedIds = removedIds.filter((x) => x !== id);
			error = 'Could not remove. Try again.';
			return;
		}
		await invalidateAll();
		removedIds = removedIds.filter((x) => x !== id);
	}
</script>

<svelte:head>
	<title>Portfolio - Keel</title>
</svelte:head>

<div class="portfolio-page">
	<header class="page-header">
		<a href="/settings" class="back-btn" aria-label="Back to settings">
			<ArrowLeft size={20} aria-hidden="true" />
		</a>
		<h1 class="section-head">Portfolio</h1>
		<p class="page-sub">Your investments, tracked by hand. Private, and kept separate from your spending.</p>
	</header>

	<section class="total-card" aria-label="Total portfolio value">
		<p class="total-label">Total value</p>
		<p class="money-hero">{formatPaise(data.total_paise)}</p>
	</section>

	{#if data.snapshots.length >= 2}
		{@const maxT = Math.max(...data.snapshots.map((s) => s.total_paise), 1)}
		<section class="trend" aria-label="Value over time">
			<h2 class="group-head">Over time</h2>
			<div class="trend-chart" aria-hidden="true">
				{#each data.snapshots as s (s.snapshot_date)}
					{@const h = Math.max(4, Math.round((s.total_paise / maxT) * 48))}
					<div class="trend-col">
						<div class="trend-bar" style="height:{h}px"></div>
						<span class="trend-label">{formatDisplayDate(s.snapshot_date).slice(0, 6)}</span>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<section class="holdings">
		<button class="holdings-toggle" onclick={() => (open = !open)} aria-expanded={open}>
			<span>Holdings ({visible.length})</span>
			{#if open}<ChevronDown size={18} aria-hidden="true" />{:else}<ChevronRight size={18} aria-hidden="true" />{/if}
		</button>

		{#if open}
			{#if visible.length > 0}
				<ul class="holding-list">
					{#each visible as h (h.id)}
						<li class="holding-row">
							<button class="holding-main" onclick={() => startEdit(h)} aria-label="Edit {h.name}">
								<span class="holding-name">{h.name}</span>
								<span class="holding-kind">{KIND_LABELS[h.kind]}</span>
							</button>
							<span class="money holding-value">{formatPaiseLedger(h.value_paise)}</span>
							<button class="delete-btn" onclick={() => remove(h.id)} aria-label="Remove {h.name}">
								<Trash2 size={16} aria-hidden="true" />
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<EmptyState heading="No holdings yet" body="Add an investment below to start tracking." />
			{/if}

			<form class="add-form" onsubmit={save} novalidate>
				<h3 class="form-head">{editingId ? 'Edit holding' : 'Add holding'}</h3>
				<div class="field">
					<label for="h-name">Name</label>
					<input id="h-name" type="text" placeholder="e.g. Index fund" bind:value={fName} maxlength="60" required />
				</div>
				<div class="field">
					<label for="h-kind">Type</label>
					<select id="h-kind" bind:value={fKind}>
						{#each KIND_OPTIONS as [val, label] (val)}
							<option value={val}>{label}</option>
						{/each}
					</select>
				</div>
				<div class="field">
					<label for="h-value">Current value</label>
					<div class="amount-row">
						<span class="currency-symbol" aria-hidden="true">₹</span>
						<input
							id="h-value"
							type="text"
							inputmode="decimal"
							placeholder="0"
							value={fValue}
							oninput={(e) => (fValue = formatAmountInput(e.currentTarget.value))}
							class="money"
							required
						/>
					</div>
				</div>
				{#if error}<p class="error" role="alert">{error}</p>{/if}
				<div class="form-actions">
					{#if editingId}
						<button type="button" class="secondary-btn" onclick={resetForm}>Cancel</button>
					{/if}
					<button type="submit" class="submit-btn" disabled={busy || !fName.trim() || !fValuePaise}>
						{#if busy}<Spinner size={18} label="Saving" />{:else}{editingId ? 'Save' : 'Add holding'}{/if}
					</button>
				</div>
			</form>
		{/if}
	</section>
</div>

<style>
	.portfolio-page {
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
		padding-bottom: calc(var(--space-6) + var(--nav-height));
	}

	.back-btn {
		display: inline-flex;
		align-items: center;
		color: var(--color-text-muted);
		text-decoration: none;
		min-height: var(--tap-target);
		margin-left: calc(-1 * var(--space-1));
	}
	.back-btn:hover {
		color: var(--color-text);
	}

	.page-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.page-sub {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
	}

	.total-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.total-label {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.trend {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.group-head {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-subtle);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.trend-chart {
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);
		height: 64px;
	}

	.trend-col {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		height: 100%;
		justify-content: flex-end;
	}

	.trend-bar {
		width: 100%;
		background: var(--color-navy);
		border-radius: 2px 2px 0 0;
	}

	.trend-label {
		font-size: 0.6875rem;
		color: var(--color-text-subtle);
		white-space: nowrap;
	}

	.holdings {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.holdings-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		min-height: var(--tap-target);
		background: none;
		border: none;
		padding: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text);
		cursor: pointer;
		font-family: inherit;
	}

	.holding-list {
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.holding-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-border);
	}
	.holding-row:last-child {
		border-bottom: none;
	}

	.holding-main {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
		min-width: 0;
		background: none;
		border: none;
		padding: 0;
		text-align: left;
		cursor: pointer;
		font: inherit;
		color: inherit;
	}

	.holding-name {
		font-size: 0.9375rem;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.holding-kind {
		font-size: 0.75rem;
		color: var(--color-text-subtle);
	}

	.holding-value {
		flex: none;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.delete-btn {
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
	}
	.delete-btn:hover {
		opacity: 1;
		color: var(--color-clay);
	}

	.add-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-top: var(--space-2);
	}

	.form-head {
		font-size: 1rem;
		font-weight: 600;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.field label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.field input,
	.field select {
		height: 44px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 1rem;
		color: var(--color-text);
	}

	.field input:focus,
	.field select:focus {
		outline: none;
		border-color: var(--color-gold);
	}

	.amount-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.amount-row input {
		flex: 1;
	}

	.currency-symbol {
		font-family: var(--font-display);
		font-size: 1.25rem;
		color: var(--color-text-muted);
	}

	.form-actions {
		display: flex;
		gap: var(--space-3);
	}

	.secondary-btn {
		flex: none;
		height: 48px;
		padding: 0 var(--space-4);
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text-muted);
		cursor: pointer;
		font-family: inherit;
	}

	.submit-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 48px;
		background: var(--color-gold);
		color: var(--color-ink);
		font-weight: 700;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
	}
	.submit-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.error {
		color: var(--color-clay);
		font-size: 0.875rem;
	}
</style>
