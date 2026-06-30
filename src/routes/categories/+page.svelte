<script lang="ts">
	import { Trash2, ArrowLeft } from 'lucide-svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { invalidateAll } from '$app/navigation';
	import { formatPaiseLedger, parseToPaise, formatAmountInput, amountInWordsIndian } from '$lib/utils/money';
	import type { PageData } from './$types';
	import type { Category, CategoryBucket, CategoryKind } from '$lib/types';

	let { data }: { data: PageData } = $props();

	let newName = $state('');
	let newColor = $state('#6B7280');
	let newParent = $state('');
	let newKind = $state<CategoryKind>('expense');
	let newBucket = $state<CategoryBucket>('flexible');
	let newReserve = $state('');
	let newBudget = $state('');
	let submitting = $state(false);
	let busyId = $state<string | null>(null);
	let error = $state<string | null>(null);

	// Overall cycle budget
	let budgetInput = $state(
		data.cycleBudgetPaise > 0 ? formatAmountInput((data.cycleBudgetPaise / 100).toString()) : ''
	);
	let budgetWords = $derived(amountInWordsIndian(parseToPaise(budgetInput) ?? 0));
	let budgetSaving = $state(false);
	let budgetSaved = $state(false);
	let budgetError = $state<string | null>(null);

	let suggestedBudgetPaise = $derived(data.recurringIncomeTotalPaise);
	let hasSuggestion = $derived(suggestedBudgetPaise > 0 && data.cycleBudgetPaise === 0);

	async function saveCycleBudget() {
		const paise = parseToPaise(budgetInput) ?? 0;
		budgetSaving = true;
		budgetError = null;
		const res = await fetch('/api/settings', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ cycle_budget_paise: paise })
		});
		budgetSaving = false;
		if (!res.ok) {
			budgetError = 'Could not save. Try again.';
			return;
		}
		budgetSaved = true;
		setTimeout(() => (budgetSaved = false), 2000);
		await invalidateAll();
	}

	function applySuggestion() {
		budgetInput = formatAmountInput((suggestedBudgetPaise / 100).toString());
	}

	// Spending tree and income categories shown as separate sections.
	let spendingTree = $derived(data.tree.filter((t) => t.kind === 'expense'));
	let incomeCats = $derived(data.tree.filter((t) => t.kind === 'income'));

	const PRESET_COLORS = [
		'#E07B54', '#E0A82E', '#5FA85D', '#2F7E72',
		'#5B8DD9', '#8B6DBF', '#C2683C', '#A85D5D',
		'#6B7280', '#374151', '#0C2340', '#2F4858'
	];

	async function handleCreate(e: Event) {
		e.preventDefault();
		error = null;
		submitting = true;

		const isIncome = newKind === 'income';
		const reservePaise = !isIncome && newBucket === 'committed' ? parseToPaise(newReserve) ?? 0 : 0;
		const budgetPaise = !isIncome ? parseToPaise(newBudget) ?? 0 : 0;

		const res = await fetch('/api/categories', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: newName.trim(),
				color: newColor,
				kind: newKind,
				// Parent, bucket, reserve and budget are spending-only concepts.
				parent_id: isIncome ? null : newParent || null,
				bucket: isIncome ? 'flexible' : newBucket,
				daily_reserve_paise: reservePaise,
				budget_paise: budgetPaise
			})
		});

		submitting = false;
		if (!res.ok) {
			error = res.status === 409 ? 'Category name already exists' : 'Could not create. Try again.';
			return;
		}

		newName = '';
		newColor = '#6B7280';
		newParent = '';
		newKind = 'expense';
		newBucket = 'flexible';
		newReserve = '';
		newBudget = '';
		await invalidateAll();
	}

	async function patchCategory(id: string, body: Record<string, unknown>) {
		busyId = id;
		error = null;
		const res = await fetch(`/api/categories/${id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		busyId = null;
		if (!res.ok) {
			error = 'Could not save. Try again.';
			return;
		}
		await invalidateAll();
	}

	function toggleBucket(cat: Category) {
		patchCategory(cat.id, { bucket: cat.bucket === 'committed' ? 'flexible' : 'committed' });
	}

	function setReserve(cat: Category, value: string) {
		const paise = parseToPaise(value) ?? 0;
		patchCategory(cat.id, { daily_reserve_paise: paise });
	}

	function setBudget(cat: Category, value: string) {
		const paise = parseToPaise(value) ?? 0;
		patchCategory(cat.id, { budget_paise: paise });
	}

	let confirmState = $state<{ message: string; run: () => void } | null>(null);

	function handleDelete(id: string) {
		confirmState = {
			message: 'Subcategories under it are removed too.',
			run: () => actuallyDelete(id)
		};
	}

	async function actuallyDelete(id: string) {
		busyId = id;
		const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
		busyId = null;
		if (res.ok) await invalidateAll();
		else error = 'Could not delete. Try again.';
	}
</script>

<svelte:head>
	<title>Categories - Keel</title>
</svelte:head>

<div class="categories-page">
	<header class="page-header">
		<a href="/settings" class="back-btn" aria-label="Back to settings">
			<ArrowLeft size={20} aria-hidden="true" />
		</a>
		<h1 class="section-head">Categories</h1>
		<p class="page-sub">
			Mark essentials as committed and set a daily reserve. Keel locks that money before you spend.
		</p>
	</header>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	<!-- Overall cycle budget -->
	<section class="budget-section">
		<div class="budget-header">
			<div>
				<p class="budget-eyebrow">Overall budget</p>
				<p class="budget-sub">Your total spending cap for this cycle</p>
			</div>
			{#if hasSuggestion && !budgetInput}
				<button type="button" class="suggestion-chip" onclick={applySuggestion}>
					Use income total · {formatPaiseLedger(suggestedBudgetPaise)}
				</button>
			{/if}
		</div>
		{#if budgetError}
			<p class="error" role="alert">{budgetError}</p>
		{/if}
		<div class="budget-row">
			<span class="currency-symbol" aria-hidden="true">₹</span>
			<input
				type="text"
				inputmode="decimal"
				class="budget-field money"
				placeholder="0 — no limit"
				value={budgetInput}
				oninput={(e) => (budgetInput = formatAmountInput(e.currentTarget.value))}
				aria-label="Overall cycle budget"
			/>
			<button
				type="button"
				class="save-budget-btn"
				onclick={saveCycleBudget}
				disabled={budgetSaving}
			>
				{#if budgetSaving}
					<Spinner size={16} />
				{:else if budgetSaved}
					Saved
				{:else}
					Save
				{/if}
			</button>
		</div>
		{#if budgetWords}
			<p class="budget-words">{budgetWords}</p>
		{/if}
	</section>

	<h2 class="group-head">Spending</h2>
	{#each spendingTree as top (top.id)}
		<div class="cat-group">
			{@render categoryRow(top, false)}
			{#each top.children as child (child.id)}
				{@render categoryRow(child, true)}
			{/each}
		</div>
	{:else}
		<EmptyState heading="No spending categories" />
	{/each}

	<h2 class="group-head">Income</h2>
	<div class="cat-group">
		{#each incomeCats as inc (inc.id)}
			{@render categoryRow(inc, false)}
		{/each}
	</div>

	<!-- Add new category -->
	<form class="add-form" onsubmit={handleCreate} novalidate>
		<h2 class="form-head">New category</h2>

		<div class="field">
			<span class="field-label">Income or spending</span>
			<div class="bucket-toggle" role="radiogroup" aria-label="Income or spending">
				<label class="bucket-option" class:active={newKind === 'expense'}>
					<input type="radio" name="kind" value="expense" bind:group={newKind} />
					<span>Spending</span>
				</label>
				<label class="bucket-option" class:active={newKind === 'income'}>
					<input type="radio" name="kind" value="income" bind:group={newKind} />
					<span>Income</span>
				</label>
			</div>
		</div>

		<div class="field">
			<label for="cat-name">Name</label>
			<input
				id="cat-name"
				type="text"
				placeholder={newKind === 'income' ? 'e.g. Freelance' : 'e.g. Food'}
				bind:value={newName}
				maxlength="50"
				required
			/>
		</div>

		<!-- Parent, type and reserve are spending-only. Income categories are simple labels. -->
		{#if newKind === 'expense'}
			<div class="field">
				<label for="cat-parent">Parent (optional)</label>
				<select id="cat-parent" bind:value={newParent}>
					<option value="">None (top level)</option>
					{#each data.parents as p}
						<option value={p.id}>{p.name}</option>
					{/each}
				</select>
			</div>

			<div class="field">
				<span class="field-label">Type</span>
				<div class="bucket-toggle" role="radiogroup" aria-label="Category type">
					<label class="bucket-option" class:active={newBucket === 'flexible'}>
						<input type="radio" name="bucket" value="flexible" bind:group={newBucket} />
						<span>Flexible</span>
					</label>
					<label class="bucket-option" class:active={newBucket === 'committed'}>
						<input type="radio" name="bucket" value="committed" bind:group={newBucket} />
						<span>Committed</span>
					</label>
				</div>
			</div>

			{#if newBucket === 'committed'}
				<div class="field">
					<label for="cat-reserve">Daily reserve (optional)</label>
					<div class="amount-row">
						<span class="currency-symbol" aria-hidden="true">₹</span>
						<input
							id="cat-reserve"
							type="text"
							inputmode="decimal"
							placeholder="0"
							value={newReserve}
							oninput={(e) => (newReserve = formatAmountInput(e.currentTarget.value))}
							class="money"
						/>
						<span class="per-day">/ day</span>
					</div>
				</div>
			{/if}

			<div class="field">
				<label for="cat-budget">Budget for the cycle (optional)</label>
				<div class="amount-row">
					<span class="currency-symbol" aria-hidden="true">₹</span>
					<input
						id="cat-budget"
						type="text"
						inputmode="decimal"
						placeholder="0"
						value={newBudget}
						oninput={(e) => (newBudget = formatAmountInput(e.currentTarget.value))}
						class="money"
					/>
				</div>
			</div>
		{/if}

		<div class="field">
			<span class="field-label">Colour</span>
			<div class="color-grid" role="radiogroup" aria-label="Choose a colour">
				{#each PRESET_COLORS as color}
					<label class="color-swatch">
						<input type="radio" name="color" value={color} bind:group={newColor} />
						<span
							class="swatch-circle"
							class:selected={newColor === color}
							style="background:{color}"
							aria-label={color}
						></span>
					</label>
				{/each}
			</div>
		</div>

		<button type="submit" class="submit-btn" disabled={submitting || !newName.trim()}>
			{#if submitting}<Spinner size={18} />{:else}Add category{/if}
		</button>
	</form>
</div>

<ConfirmDialog
	open={confirmState !== null}
	title="Delete category?"
	message={confirmState?.message ?? ''}
	confirmLabel="Delete"
	onconfirm={() => { const r = confirmState?.run; confirmState = null; r?.(); }}
	oncancel={() => (confirmState = null)}
/>

{#snippet categoryRow(cat: Category, isChild: boolean)}
	{@const isExpense = cat.kind === 'expense'}
	<div class="category-row" class:child={isChild}>
		<span class="cat-name">{cat.name}</span>

		{#if isExpense && cat.bucket === 'committed' && cat.daily_reserve_paise > 0}
			<span class="reserve-tag">{formatPaiseLedger(cat.daily_reserve_paise)}/day</span>
		{/if}

		{#if !cat.is_system}
			{#if isExpense}
				<div class="cat-controls">
					<button
						class="bucket-chip"
						class:committed={cat.bucket === 'committed'}
						onclick={() => toggleBucket(cat)}
						disabled={busyId === cat.id}
						aria-label="Toggle type for {cat.name}, currently {cat.bucket}"
					>
						{cat.bucket}
					</button>

					{#if cat.bucket === 'committed'}
						<input
							type="text"
							inputmode="decimal"
							class="reserve-input money"
							placeholder="₹/day"
							value={cat.daily_reserve_paise ? formatAmountInput((cat.daily_reserve_paise / 100).toString()) : ''}
							oninput={(e) => { e.currentTarget.value = formatAmountInput(e.currentTarget.value); }}
							onchange={(e) => setReserve(cat, e.currentTarget.value)}
							disabled={busyId === cat.id}
							aria-label="Daily reserve for {cat.name}"
						/>
					{/if}

					<input
						type="text"
						inputmode="decimal"
						class="budget-input money"
						placeholder="₹ budget"
						value={cat.budget_paise ? formatAmountInput((cat.budget_paise / 100).toString()) : ''}
						oninput={(e) => { e.currentTarget.value = formatAmountInput(e.currentTarget.value); }}
						onchange={(e) => setBudget(cat, e.currentTarget.value)}
						disabled={busyId === cat.id}
						aria-label="Budget for {cat.name}"
						title="Budget limit for this cycle"
					/>
				</div>
			{/if}

			<button
				class="delete-btn"
				onclick={() => handleDelete(cat.id)}
				disabled={busyId === cat.id}
				aria-label="Delete {cat.name}"
			>
				<Trash2 size={16} aria-hidden="true" />
			</button>
		{:else}
			<span class="system-tag">system</span>
		{/if}
	</div>
{/snippet}

<style>
	.categories-page {
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
	.back-btn:hover { color: var(--color-text); }

	.page-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.page-sub {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
	}

	.group-head {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-bottom: calc(var(--space-4) * -0.5);
	}

	.cat-group {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.category-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--color-border);
		min-height: var(--tap-target);
	}

	.category-row:last-child {
		border-bottom: none;
	}

	.category-row.child {
		padding-left: var(--space-8);
		background: var(--color-surface-subtle);
	}

	.cat-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.9375rem;
	}

	.reserve-tag {
		font-size: 0.75rem;
		color: var(--color-text-subtle);
		white-space: nowrap;
	}

	.bucket-chip {
		flex: none;
		font-size: 0.75rem;
		text-transform: capitalize;
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.bucket-chip.committed {
		border-color: var(--color-text-muted);
		color: var(--color-text);
		font-weight: 600;
	}

	.bucket-chip:disabled {
		opacity: 0.5;
	}

	.cat-controls {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.reserve-input,
	.budget-input {
		width: 72px;
		height: 32px;
		padding: 0 var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background-color: var(--color-surface);
		font-size: 0.8125rem;
		color: var(--color-text);
	}

	.reserve-input:focus,
	.budget-input:focus {
		outline: none;
		border-color: var(--color-gold);
	}

	.budget-input {
		min-width: 80px;
	}

	.system-tag {
		font-size: 0.75rem;
		color: var(--color-text-subtle);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.delete-btn {
		flex: none;
		color: var(--color-text-subtle);
		background: transparent;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--tap-target);
		height: var(--tap-target);
		min-width: var(--tap-target);
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

	.field label,
	.field-label {
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
		background-color: var(--color-surface);
		font-size: 1rem;
		color: var(--color-text);
	}

	.field input:focus,
	.field select:focus {
		outline: none;
		border-color: var(--color-gold);
	}

	.bucket-toggle {
		display: flex;
		gap: var(--space-2);
	}

	.bucket-option {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 44px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-size: 0.9375rem;
		color: var(--color-text-muted);
	}

	.bucket-option.active {
		border-color: var(--color-text);
		color: var(--color-text);
		font-weight: 600;
		background: var(--color-surface-subtle);
	}

	.bucket-option input {
		display: none;
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

	.per-day {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.color-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: var(--space-2);
	}

	.color-swatch input {
		display: none;
	}

	.swatch-circle {
		display: block;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		cursor: pointer;
		border: 2px solid transparent;
		transition: border-color var(--duration-fast) var(--ease-out);
	}

	.swatch-circle.selected {
		border-color: var(--color-ink);
		outline: 2px solid var(--color-gold);
		outline-offset: 2px;
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

	/* room for the global select chevron */
	.field select {
		padding-right: var(--space-8);
	}

	.budget-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-5);
		background: var(--color-surface-subtle);
		border: 2px solid var(--color-gold);
		border-radius: var(--radius-md);
	}

	.budget-eyebrow {
		font-size: 0.6875rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-gold);
		margin: 0;
	}

	.budget-sub {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
		margin: var(--space-1) 0 0;
	}

	.budget-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.budget-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.budget-field {
		flex: 1;
		height: 44px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 1rem;
		color: var(--color-text);
	}

	.budget-field:focus {
		outline: none;
		border-color: var(--color-gold);
	}

	.save-budget-btn {
		flex: none;
		height: 44px;
		padding: 0 var(--space-4);
		background: var(--color-gold);
		color: var(--color-ink);
		font-weight: 700;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-size: 0.9375rem;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.save-budget-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	.budget-words {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.suggestion-chip {
		flex: none;
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.suggestion-chip:hover {
		border-color: var(--color-gold);
		color: var(--color-text);
	}
</style>
