<script lang="ts">
	import type { Snippet } from 'svelte';
	interface Props {
		heading: string;
		body?: string;
		children?: Snippet;
	}
	let { heading, body, children }: Props = $props();
</script>

<div class="empty">
	<p class="empty-head">{heading}</p>
	{#if body}
		<p class="empty-body">{body}</p>
	{/if}
	{@render children?.()}
</div>

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-12) var(--space-6);
		text-align: center;
	}

	.empty-head {
		font-weight: 600;
		color: var(--color-text);
	}

	.empty-body {
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		max-width: 28ch;
	}
</style>
