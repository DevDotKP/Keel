<script lang="ts">
	import { toast } from '$lib/stores/toast';
	import { beforeNavigate } from '$app/navigation';

	// Commit any pending toast action before leaving the page.
	beforeNavigate(() => toast.flush());
</script>

{#if $toast}
	<div class="toast" role="status" aria-live="polite">
		<span class="toast-msg">{$toast.message}</span>
		{#if $toast.actionLabel}
			<button class="toast-action" onclick={() => toast.act()}>{$toast.actionLabel}</button>
		{/if}
	</div>
{/if}

<style>
	.toast {
		position: fixed;
		left: 50%;
		bottom: calc(var(--nav-height) + var(--space-4));
		transform: translateX(-50%);
		z-index: var(--z-toast);
		display: flex;
		align-items: center;
		gap: var(--space-4);
		width: max-content;
		max-width: min(440px, calc(100vw - var(--space-8)));
		padding: var(--space-3) var(--space-4);
		background: var(--color-ink);
		color: #f0ede8;
		border-radius: var(--radius-md);
		box-shadow: 0 6px 24px rgba(12, 35, 64, 0.28);
		font-size: 0.9375rem;
		animation: toast-in var(--duration-normal) var(--ease-out);
	}

	.toast-msg {
		min-width: 0;
	}

	/* Undo is the toast's single primary action: gold on ink. */
	.toast-action {
		flex: none;
		background: none;
		border: none;
		padding: var(--space-1) var(--space-2);
		color: var(--color-gold);
		font-family: inherit;
		font-size: 0.9375rem;
		font-weight: 700;
		cursor: pointer;
	}

	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	/* Desktop: nav is a left sidebar, so sit at the bottom of the content area. */
	@media (min-width: 768px) {
		.toast {
			bottom: var(--space-6);
			left: calc(50% + var(--sidebar-width) / 2);
		}
	}
</style>
