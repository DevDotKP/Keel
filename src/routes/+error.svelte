<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="error-page">
	<p class="error-status">{page.status}</p>
	<p class="error-message">{page.error?.message ?? 'Something went wrong.'}</p>
	<a href="/" class="error-link">Back to dashboard</a>
</div>

<style>
	.error-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-4);
		min-height: 60dvh;
		padding: var(--space-8);
		text-align: center;
	}

	.error-status {
		font-family: var(--font-display);
		font-size: 4rem;
		font-weight: 700;
		color: var(--color-gold);
		line-height: 1;
	}

	.error-message {
		color: var(--color-text-muted);
		max-width: 30ch;
	}

	.error-link {
		color: var(--color-text);
		font-weight: 500;
		text-underline-offset: 3px;
	}
</style>
