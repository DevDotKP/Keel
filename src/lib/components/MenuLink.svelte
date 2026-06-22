<script lang="ts">
	import { ChevronRight } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		href: string;
		title: string;
		sub?: string;
		icon: Snippet;
	}

	let { href, title, sub, icon }: Props = $props();
</script>

<a {href} class="menu-link">
	<span class="menu-icon" aria-hidden="true">{@render icon()}</span>
	<span class="menu-text">
		<span class="menu-title">{title}</span>
		{#if sub}<span class="menu-sub">{sub}</span>{/if}
	</span>
	<ChevronRight class="menu-chevron" size={18} aria-hidden="true" />
</a>

<style>
	.menu-link {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		min-height: 56px;
		color: var(--color-text);
		text-decoration: none;
		border-bottom: 1px solid var(--color-border);
		transition: background var(--duration-fast) var(--ease-out);
	}

	.menu-link:last-child {
		border-bottom: none;
	}

	.menu-link:hover {
		background: var(--color-surface-subtle);
	}

	.menu-icon {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-text) 8%, transparent);
		color: var(--color-text-muted);
	}

	.menu-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
		min-width: 0;
	}

	.menu-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.menu-sub {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
	}

	.menu-link :global(.menu-chevron) {
		flex: none;
		color: var(--color-text-subtle);
	}
</style>
