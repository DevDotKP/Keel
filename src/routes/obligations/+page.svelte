<script lang="ts">
	import { Trash2, Check } from 'lucide-svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { invalidateAll } from '$app/navigation';
	import { formatPaiseLedger, parseToPaise } from '$lib/utils/money';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let newName = $state('');
	let newAmount = $state('');
	let newCategory = $state('');
	let newCadence = $state<'weekly' | 'fortnightly' | 'monthly'>('monthly');
	let submitting = $state(false);
	let busyId = $state<string | null>(null);
	let error = $state<string | null>(null);

	let newAmountPaise = $derived(parseToPaise(newAmount));

	let totalDue = $derived(
		data.obligations.filter((o) => !o.paid && o.is_active).reduce((sum, o) => sum + o.amount_paise, 0)
	);

	async function handleCreate(e: Event) {
		e.preventDefault();
		if (newAmountPaise === null || newAmountPaise <= 0) {
			error = 'Enter a valid amount';
			return;
		}
		submitting = true;
		error = null;

		const res = await fetch('/api/obligations', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: newName.trim(),
				amount_paise: newAmountPaise,
				category_id: newCategory || null,
				cadence: newCadence
			})
		});

		submitting = false;
		if (!res.ok) {
			error = 'Could not add. Try again.';
			return;
		}
		newName = '';
		newAmount = '';
		newCategory = '';
		await invalidateAll();
	}

	async function togglePaid(id: string, paid: boolean) {
		busyId = id;
		error = null;
		const res = await fetch(`/api/obligations/${id}/settle`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ paid })
		});
		busyId = null;
		if (!res.ok) {
			error = 'Could not update. Try again.';
			return;
		}
		await invalidateAll();
	}

	async function handleDelete(id: string) {
		if (!confirm('Delete this obligation? Past payments stay in your ledger.')) return;
		busyId = id;
		const res = await fetch(`/api/obligations/${id}`, { method: 'DELETE' });
		busyId = null;
		if (res.ok) await invalidateAll();
	}

	function categoryName(id: string | null): string {
		if (!id) return 'Uncategorized';
		return data.categories.find((c) => c.id === id)?.name ?? 'Uncategorized';
	}
</script>

<svelte:head>
	<title>Recurring - Keel</title>
</svelte:head>

<div class="obligations-page">
	<header class="page-header">
		<h1 class="section-head">Recurring &amp; obligations</h1>
		<p class="page-sub">Rent, bills, EMIs. Mark them paid and Keel logs the spend for you.</p>
	</header>

	{#if totalDue > 0}
		<div class="due-summary">
			<span class="due-label">Still due this period</span>
			<span class="money due-amount">{formatPaiseLedger(totalDue)}</span>
		</div>
	{/if}

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	{#if data.obligations.length > 0}
		<ul class="obligation-list" aria-label="Your obligations">
			{#each data.obligations as obl (obl.id)}
				<li class="obligation-row" class:paid={obl.paid}>
					<button
						class="check-btn"
						class:checked={obl.paid}
						onclick={() => togglePaid(obl.id, !obl.paid)}
						disabled={busyId === obl.id}
						aria-label={obl.paid ? `Mark ${obl.name} unpaid` : `Mark ${obl.name} paid`}
						aria-pressed={obl.paid}
					>
						{#if busyId === obl.id}
							<Spinner size={16} label="Updating" />
						{:else if obl.paid}
							<Check size={16} aria-hidden="true" />
						{/if}
					</button>

					<span class="obligation-main">
						<span class="obligation-name">{obl.name}</span>
						<span class="obligation-meta">
							{categoryName(obl.category_id)} · {obl.cadence}
						</span>
					</span>

					<span class="money obligation-amount">{formatPaiseLedger(obl.amount_paise)}</span>

					<button
						class="delete-btn"
						onclick={() => handleDelete(obl.id)}
						disabled={busyId === obl.id}
						aria-label="Delete {obl.name}"
					>
						<Trash2 size={16} aria-hidden="true" />
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<EmptyState
			heading="No obligations yet"
			body="Add rent or a bill below. They reserve money before you spend it."
		/>
	{/if}

	<!-- Add obligation -->
	<form class="add-form" onsubmit={handleCreate} novalidate>
		<h2 class="form-head">New obligation</h2>

		<div class="field">
			<label for="obl-name">Name</label>
			<input
				id="obl-name"
				type="text"
				placeholder="e.g. Rent"
				bind:value={newName}
				maxlength="60"
				required
			/>
		</div>

		<div class="field">
			<label for="obl-amount">Amount</label>
			<div class="amount-row">
				<span class="currency-symbol" aria-hidden="true">₹</span>
				<input
					id="obl-amount"
					type="text"
					inputmode="decimal"
					placeholder="0"
					bind:value={newAmount}
					class="money"
					required
				/>
			</div>
		</div>

		<div class="field">
			<label for="obl-category">Category</label>
			<select id="obl-category" bind:value={newCategory}>
				<option value="">Uncategorized</option>
				{#each data.categories.filter((c) => !c.is_system) as cat}
					<option value={cat.id}>{cat.name}</option>
				{/each}
			</select>
		</div>

		<div class="field">
			<label for="obl-cadence">How often</label>
			<select id="obl-cadence" bind:value={newCadence}>
				<option value="weekly">Weekly</option>
				<option value="fortnightly">Fortnightly</option>
				<option value="monthly">Monthly</option>
			</select>
		</div>

		<button type="submit" class="submit-btn" disabled={submitting || !newName.trim() || !newAmountPaise}>
			{#if submitting}<Spinner size={18} label="Adding" />{:else}Add obligation{/if}
		</button>
	</form>
</div>

<style>
	.obligations-page {
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
		font-size: 0.9375rem;
		color: var(--color-text-muted);
	}

	.due-summary {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: var(--space-4) var(--space-5);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.due-label {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
	}

	.due-amount {
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.obligation-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.obligation-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--color-border);
		min-height: var(--tap-target);
	}

	.obligation-row:last-child {
		border-bottom: none;
	}

	.obligation-row.paid .obligation-name {
		color: var(--color-text-muted);
		text-decoration: line-through;
	}

	.check-btn {
		flex: none;
		width: 28px;
		height: 28px;
		min-width: 28px;
		border: 2px solid var(--color-border);
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--color-ink);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	/* Paid = muted teal (income/positive), never gold. */
	.check-btn.checked {
		background: var(--color-positive, #2f7e72);
		border-color: var(--color-positive, #2f7e72);
		color: #fff;
	}

	.check-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.obligation-main {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}

	.obligation-name {
		font-size: 0.9375rem;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.obligation-meta {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
		text-transform: capitalize;
	}

	.obligation-amount {
		flex: none;
		font-size: 0.9375rem;
		font-weight: 600;
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
		transition:
			opacity var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
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

	.submit-btn {
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
