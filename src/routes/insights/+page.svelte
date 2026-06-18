<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Insights - Keel</title>
</svelte:head>

<div class="insights-page">
	<h1 class="section-head">Insights</h1>

	<!-- TODO(sonnet): implement four views, each answering one real question.
	     1. Spend by category this period (horizontal bar, ink fill, gold accent for top).
	     2. Period-over-period trend (simple line, no decoration).
	     3. Uncategorized ratio (nudges Harbour when high).
	     4. Drift over time (how much closer your picture is getting). -->
	<EmptyState
		heading="No data yet"
		body="Add entries and close your first period to see insights."
	/>
</div>

<style>
	.insights-page {
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-8);
	}
</style>
