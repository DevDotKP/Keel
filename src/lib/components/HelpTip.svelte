<script lang="ts">
	import { Info } from 'lucide-svelte';

	// A small, accessible tap-for-help affordance. Shows a one-line plain-language
	// definition next to a term. Tap to open; Escape or an outside tap closes it.
	let { term, text, align = 'start' }: { term: string; text: string; align?: 'start' | 'end' } =
		$props();

	let open = $state(false);
	let wrapper = $state<HTMLSpanElement | null>(null);
	const popId = `help-${Math.random().toString(36).slice(2, 9)}`;

	$effect(() => {
		if (!open) return;
		function onDocPointer(e: Event) {
			if (wrapper && !wrapper.contains(e.target as Node)) open = false;
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') open = false;
		}
		document.addEventListener('click', onDocPointer);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('click', onDocPointer);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

<span class="help" bind:this={wrapper}>
	<button
		type="button"
		class="help-btn"
		aria-label={open ? `Hide explanation of ${term}` : `What is ${term}?`}
		aria-expanded={open}
		aria-describedby={open ? popId : undefined}
		onclick={() => (open = !open)}
	>
		<Info size={15} aria-hidden="true" />
	</button>
	{#if open}
		<span id={popId} class="help-pop" class:help-pop--end={align === 'end'} role="tooltip">{text}</span>
	{/if}
</span>

<style>
	.help {
		position: relative;
		display: inline-flex;
		vertical-align: middle;
	}

	.help-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		/* Small visual footprint, but a 44px hit area via padding + negative margin
		   so it never bloats the line it sits on. */
		width: 44px;
		height: 44px;
		margin: -14px;
		padding: 0;
		border: none;
		background: none;
		color: var(--color-text-subtle);
		cursor: pointer;
		border-radius: var(--radius-full);
	}

	.help-btn:hover {
		color: var(--color-text-muted);
	}

	.help-btn:focus-visible {
		outline: 2px solid var(--color-text-muted);
		outline-offset: 2px;
	}

	.help-pop {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 20;
		width: max-content;
		max-width: min(240px, 72vw);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		line-height: 1.45;
		font-weight: 400;
		text-align: left;
		box-shadow: 0 6px 20px color-mix(in srgb, var(--color-ink) 14%, transparent);
	}

	.help-pop--end {
		left: auto;
		right: 0;
	}
</style>
