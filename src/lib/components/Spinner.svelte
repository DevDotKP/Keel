<script lang="ts">
	interface Props {
		size?: number;
		label?: string;
	}
	let { size = 20, label = 'Loading' }: Props = $props();
</script>

<span class="spinner" style="--size: {size}px" role="status" aria-label={label}>
	<span class="sr-only">{label}</span>
</span>

<style>
	.spinner {
		display: inline-block;
		width: var(--size);
		height: var(--size);
		border: 2px solid var(--color-border);
		border-top-color: var(--color-gold);
		border-radius: 50%;
		animation: spin 600ms linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
