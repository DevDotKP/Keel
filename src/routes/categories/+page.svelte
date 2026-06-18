<script lang="ts">
	import { Trash2 } from 'lucide-svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let newName = $state('');
	let newColor = $state('#6B7280');
	let submitting = $state(false);
	let error = $state<string | null>(null);

	const PRESET_COLORS = [
		'#E07B54', '#E0A82E', '#5FA85D', '#2F7E72',
		'#5B8DD9', '#8B6DBF', '#C2683C', '#A85D5D',
		'#6B7280', '#374151', '#0C2340', '#2F4858'
	];

	// TODO(sonnet): implement handleCreate — POST /api/categories, invalidate page.
	async function handleCreate(e: Event) {
		e.preventDefault();
		throw new Error('Not implemented');
	}

	// TODO(sonnet): implement handleDelete — DELETE /api/categories/[id], invalidate page.
	async function handleDelete(_id: string) {
		throw new Error('Not implemented');
	}
</script>

<svelte:head>
	<title>Categories - Keel</title>
</svelte:head>

<div class="categories-page">
	<h1 class="section-head">Categories</h1>

	<ul class="category-list" aria-label="Your categories">
		{#each data.categories as cat}
			<li class="category-row">
				<span class="color-dot" style="background:{cat.color}" aria-hidden="true"></span>
				<span class="cat-name">{cat.name}</span>
				{#if !cat.is_system}
					<button
						class="delete-btn"
						onclick={() => handleDelete(cat.id)}
						aria-label="Delete {cat.name}"
					>
						<Trash2 size={16} />
					</button>
				{/if}
			</li>
		{:else}
			<EmptyState heading="No categories" />
		{/each}
	</ul>

	<!-- Add new category -->
	<form class="add-form" onsubmit={handleCreate} novalidate>
		<h2 class="form-head">New category</h2>

		<div class="field">
			<label for="cat-name">Name</label>
			<input
				id="cat-name"
				type="text"
				placeholder="e.g. Transport"
				bind:value={newName}
				maxlength="50"
				required
			/>
		</div>

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

		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}

		<button type="submit" class="submit-btn" disabled={submitting || !newName.trim()}>
			{#if submitting}<Spinner size={18} />{:else}Add category{/if}
		</button>
	</form>
</div>

<style>
	.categories-page {
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-8);
	}

	.category-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.category-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--color-border);
		min-height: var(--tap-target);
	}

	.category-row:last-child { border-bottom: none; }

	.color-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.cat-name { flex: 1; }

	.delete-btn {
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

	.color-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: var(--space-2);
	}

	.color-swatch input { display: none; }

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

	.submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

	.error {
		color: var(--color-clay);
		font-size: 0.875rem;
	}
</style>
