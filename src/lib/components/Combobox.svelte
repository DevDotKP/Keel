<script lang="ts">
	// A small accessible single-select combobox: type to filter, arrow keys to
	// move, Enter to choose, Escape/click-outside to close. Hand-styled to match
	// the app (themed input with a chevron, no off-the-shelf kit).
	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		options: Option[];
		value?: string;
		placeholder?: string;
		id?: string;
		disabled?: boolean;
		onchange?: (value: string) => void;
	}

	let {
		options,
		value = $bindable(''),
		placeholder = 'Search',
		id,
		disabled = false,
		onchange
	}: Props = $props();

	let open = $state(false);
	let query = $state('');
	let highlight = $state(0);
	let inputEl: HTMLInputElement | undefined = $state();

	let selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? '');

	// While closed, the input shows the selected label.
	$effect(() => {
		if (!open) query = selectedLabel;
	});

	let filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		// No query, or the query is just the current selection: show everything.
		if (!q || query === selectedLabel) return options;
		return options.filter((o) => o.label.toLowerCase().includes(q));
	});

	function choose(opt: Option) {
		value = opt.value;
		onchange?.(opt.value);
		open = false;
		inputEl?.blur();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			open = true;
			highlight = Math.min(highlight + 1, filtered.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlight = Math.max(highlight - 1, 0);
		} else if (e.key === 'Enter') {
			if (open && filtered[highlight]) {
				e.preventDefault();
				choose(filtered[highlight]);
			}
		} else if (e.key === 'Escape') {
			open = false;
		}
	}

	function clickOutside(node: HTMLElement, cb: () => void) {
		function handler(e: MouseEvent) {
			if (!node.contains(e.target as Node)) cb();
		}
		document.addEventListener('click', handler, true);
		return { destroy: () => document.removeEventListener('click', handler, true) };
	}
</script>

<div class="combobox" use:clickOutside={() => (open = false)}>
	<input
		{id}
		bind:this={inputEl}
		bind:value={query}
		type="text"
		role="combobox"
		aria-expanded={open}
		aria-controls={id ? `${id}-listbox` : undefined}
		aria-autocomplete="list"
		autocomplete="off"
		{placeholder}
		{disabled}
		onfocus={() => {
			open = true;
			highlight = 0;
			inputEl?.select();
		}}
		oninput={() => {
			open = true;
			highlight = 0;
		}}
		onkeydown={onKeydown}
	/>
	{#if open && filtered.length > 0}
		<ul class="combobox-list" id={id ? `${id}-listbox` : undefined} role="listbox">
			{#each filtered as opt, i (opt.value)}
				<li
					role="option"
					aria-selected={opt.value === value}
					class="combobox-option"
					class:highlight={i === highlight}
					onpointerdown={(e) => {
						e.preventDefault();
						choose(opt);
					}}
					onmouseenter={() => (highlight = i)}
				>
					{opt.label}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.combobox {
		position: relative;
		width: 100%;
	}

	.combobox input {
		width: 100%;
		height: 44px;
		padding: 0 var(--space-8) 0 var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: var(--color-surface);
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237C756A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right var(--space-3) center;
		font-size: 1rem;
		color: var(--color-text);
		font-family: inherit;
	}

	.combobox input:focus {
		outline: none;
		border-color: var(--color-gold);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-gold) 15%, transparent);
	}

	.combobox-list {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		z-index: var(--z-overlay);
		max-height: 240px;
		overflow-y: auto;
		list-style: none;
		margin: 0;
		padding: var(--space-1);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: 0 8px 24px rgba(12, 35, 64, 0.16);
	}

	.combobox-option {
		display: flex;
		align-items: center;
		min-height: var(--tap-target);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		font-size: 0.9375rem;
		color: var(--color-text);
		cursor: pointer;
	}

	.combobox-option[aria-selected='true'] {
		background: var(--color-surface-subtle);
	}

	.combobox-option.highlight {
		background: color-mix(in srgb, var(--color-gold) 12%, transparent);
	}
</style>
