<script lang="ts">
	let { children } = $props();
</script>

<div class="auth-shell">
	{@render children()}
</div>

<style>
	.auth-shell {
		min-height: 100svh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-6);
	}
</style>
