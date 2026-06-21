<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Join household - Keel</title>
</svelte:head>

<div class="join-page">
	{#if data.status === 'ready'}
		<h1 class="section-head">You've been invited</h1>
		<p class="join-sub">
			Join <strong>{data.household_name}</strong> as {data.role === 'admin' ? 'an admin' : 'a member'}.
		</p>
		<form method="POST" action="?/accept&token={data.token}">
			<button type="submit" class="primary-btn">Accept and join</button>
		</form>
	{:else}
		<h1 class="section-head">Invite unavailable</h1>
		<p class="join-sub">
			{#if data.status === 'expired'}
				This invite link has expired or has already been used. Ask for a fresh one.
			{:else}
				This invite link is not valid. Check the link and try again.
			{/if}
		</p>
		<a href="/" class="primary-btn" role="button">Go to Keel</a>
	{/if}
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
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 52px;
		background: var(--color-gold);
		color: var(--color-ink);
		font-weight: 700;
		font-size: 1rem;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		text-decoration: none;
	}
</style>
