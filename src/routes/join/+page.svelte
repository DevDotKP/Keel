<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Join household - Keel</title>
</svelte:head>

<div class="join-page">
	<h1 class="section-head">You've been invited</h1>
	<p class="join-sub">
		Join <strong>{data.invite.household_name}</strong> as a {data.invite.role}.
	</p>

	<form method="POST" action="?/accept&token={data.token}">
		<button type="submit" class="primary-btn">Accept and join</button>
	</form>
</div>

<style>
	.join-page {
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
		max-width: 400px;
		margin: var(--space-12) auto;
		text-align: center;
	}

	.join-sub {
		color: var(--color-text-muted);
		line-height: 1.6;
	}

	.primary-btn {
		width: 100%;
		height: 52px;
		background: var(--color-gold);
		color: var(--color-ink);
		font-weight: 700;
		font-size: 1rem;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
	}
</style>
