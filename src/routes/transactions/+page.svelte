<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { Trash2, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import AddTransactionSheet from '$lib/components/AddTransactionSheet.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { formatPaiseLedger } from '$lib/utils/money';
	import { formatDisplayDate } from '$lib/utils/date';
	import type { PageData } from './$types';
	import type { TransactionDraft, Transaction } from '$lib/types';

	let { data }: { data: PageData } = $props();

	let sheetOpen = $state(false);
	let editingTx = $state<Transaction | null>(null);
	let busyId = $state<string | null>(null);

	let totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));

	function navigate(p: number, catId?: string) {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('page', String(p));
		if (catId !== undefined) {
			if (catId) params.set('category', catId);
			else params.delete('category');
		}
		goto(`/transactions?${params}`, { replaceState: true });
	}

	async function handleSubmit(draft: Required<TransactionDraft>): Promise<void> {
		if (!editingTx) return;
		const res = await fetch(`/api/transactions/${editingTx.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				amount_paise: Math.abs(draft.amount_paise!),
				category_id: draft.category_id,
				description: draft.description,
				note: draft.note,
				occurred_at: draft.occurred_at
			})
		});
		if (!res.ok) throw new Error('Update failed');
		editingTx = null;
		await invalidateAll();
	}

	async function handleDelete(id: string) {
		busyId = id;
		const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
		busyId = null;
		if (res.ok) await invalidateAll();
	}
</script>

<svelte:head>
	<title>All entries - Keel</title>
</svelte:head>

<div class="tx-page">
	<header class="page-header">
		<h1 class="section-head">All entries</h1>
		<p class="count-sub" aria-live="polite">{data.total} {data.total === 1 ? 'entry' : 'entries'}</p>
	</header>

	<!-- Category filter -->
	<div class="filter-row">
		<label for="cat-filter" class="sr-only">Filter by category</label>
		<select
			id="cat-filter"
			value={data.categoryId}
			onchange={(e) => navigate(1, e.currentTarget.value)}
		>
			<option value="">All categories</option>
			{#each data.categories as cat}
				<option value={cat.id}>{cat.name}</option>
			{/each}
		</select>
	</div>

	{#if data.transactions.length === 0}
		<EmptyState heading="No entries" body={data.categoryId ? 'None in this category yet.' : 'Add your first expense below.'} />
	{:else}
		{@const catById = new Map(data.categories.map((c) => [c.id, c]))}
		<ul class="ledger">
			{#each data.transactions as tx (tx.id)}
				{@const cat = catById.get(tx.category_id)}
				{@const income = tx.amount_paise >= 0}
				{@const uncategorized = cat?.name === 'Uncategorized' || tx.is_uncategorized_fallback === 1}
				{@const addedByOther = tx.entered_by && tx.entered_by !== data.currentUserId}
				{@const byEmail = addedByOther ? (data.memberEmails[tx.entered_by!] ?? '') : ''}
				{@const byLabel = byEmail ? byEmail.split('@')[0] : ''}
				<li class="ledger-row">
					<button
						class="row-tap"
						onclick={() => { editingTx = tx; sheetOpen = true; }}
						aria-label="Edit {tx.description || 'entry'}"
					>
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
								{#if addedByOther && byLabel}
									<span class="meta-sep" aria-hidden="true">·</span>
									<span class="ledger-by" title="Added by {byEmail}">by {byLabel}</span>
								{/if}
								{#if tx.note}
									<span class="meta-sep" aria-hidden="true">·</span>
									<span class="ledger-note-inline">{tx.note}</span>
								{/if}
							</span>
						</span>
						<span class="ledger-amount money {income ? 'money--income' : 'money--expense'}">
							{income ? '+' : ''}{formatPaiseLedger(Math.abs(tx.amount_paise))}
						</span>
					</button>
					<button
						class="row-delete"
						onclick={() => handleDelete(tx.id)}
						disabled={busyId === tx.id}
						aria-label="Delete {tx.description || 'entry'}"
					>
						<Trash2 size={16} aria-hidden="true" />
					</button>
				</li>
			{/each}
		</ul>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="pagination" aria-label="Pagination">
				<button
					class="page-btn"
					onclick={() => navigate(data.page - 1)}
					disabled={data.page <= 1}
					aria-label="Previous page"
				>
					<ChevronLeft size={18} aria-hidden="true" />
					Older
				</button>
				<span class="page-info">{data.page} of {totalPages}</span>
				<button
					class="page-btn page-btn--right"
					onclick={() => navigate(data.page + 1)}
					disabled={data.page >= totalPages}
					aria-label="Next page"
				>
					Newer
					<ChevronRight size={18} aria-hidden="true" />
				</button>
			</div>
		{/if}
	{/if}
</div>

<AddTransactionSheet
	open={sheetOpen}
	categories={data.categories}
	{editingTx}
	onclose={() => { sheetOpen = false; editingTx = null; }}
	onsubmit={handleSubmit}
/>

<style>
	.tx-page {
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-bottom: calc(var(--space-6) + var(--nav-height));
	}

	.page-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.count-sub {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.filter-row {
		display: flex;
	}

	.filter-row select {
		height: 40px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 0.9375rem;
		color: var(--color-text);
		min-width: 180px;
	}

	.filter-row select:focus {
		outline: none;
		border-color: var(--color-gold);
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

	.row-tap {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex: 1;
		min-width: 0;
		background: none;
		border: none;
		padding: 0;
		text-align: left;
		cursor: pointer;
		color: inherit;
		font: inherit;
		min-height: var(--tap-target);
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

	.uncat-dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		background: var(--color-gold);
	}

	.ledger-cat { color: var(--color-text-muted); }
	.meta-sep   { color: var(--color-text-subtle); }

	.ledger-by {
		color: var(--color-text-subtle);
		font-size: 0.75rem;
	}

	.ledger-note-inline {
		color: var(--color-text-subtle);
		font-style: italic;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 120px;
	}

	.ledger-amount {
		flex: none;
		font-size: 0.9375rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums lining-nums;
		white-space: nowrap;
	}

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

	.row-delete:hover { opacity: 1; color: var(--color-clay); }
	.row-delete:disabled { cursor: not-allowed; }

	.pagination {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-4) 0;
	}

	.page-btn {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		height: 40px;
		padding: 0 var(--space-3);
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		cursor: pointer;
		transition: border-color var(--duration-fast) var(--ease-out);
	}

	.page-btn:hover:not(:disabled) { border-color: var(--color-text-subtle); color: var(--color-text); }
	.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

	.page-info {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.sr-only {
		position: absolute;
		width: 1px; height: 1px;
		padding: 0; margin: -1px;
		overflow: hidden;
		clip: rect(0,0,0,0);
		white-space: nowrap;
		border: 0;
	}
</style>
