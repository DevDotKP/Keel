<script lang="ts">
	// Hand-styled confirm for destructive actions. Replaces the native browser
	// confirm() so management-screen deletes match the app instead of the OS.
	interface Props {
		open: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		onconfirm: () => void;
		oncancel: () => void;
	}

	let {
		open,
		title,
		message,
		confirmLabel = 'Delete',
		cancelLabel = 'Cancel',
		onconfirm,
		oncancel
	}: Props = $props();

	let cancelBtn = $state<HTMLButtonElement | null>(null);

	// Focus the safe option (Cancel) when the dialog opens.
	$effect(() => {
		if (open) cancelBtn?.focus();
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			oncancel();
		}
	}
</script>

{#if open}
	<div
		class="cd-backdrop"
		role="button"
		tabindex="-1"
		aria-label="Cancel"
		onclick={oncancel}
		onkeydown={onKeydown}
	></div>
	<div class="cd-card" role="alertdialog" tabindex="-1" aria-modal="true" aria-labelledby="cd-title" onkeydown={onKeydown}>
		<h2 class="cd-title" id="cd-title">{title}</h2>
		<p class="cd-message">{message}</p>
		<div class="cd-actions">
			<button class="cd-cancel" bind:this={cancelBtn} onclick={oncancel}>{cancelLabel}</button>
			<button class="cd-confirm" onclick={onconfirm}>{confirmLabel}</button>
		</div>
	</div>
{/if}

<style>
	.cd-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(12, 35, 64, 0.4);
		z-index: var(--z-sheet);
		animation: cd-fade var(--duration-fast) var(--ease-out);
	}

	.cd-card {
		position: fixed;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		z-index: calc(var(--z-sheet) + 1);
		width: min(360px, calc(100vw - 2 * var(--space-6)));
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-6);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: 0 12px 32px rgba(12, 35, 64, 0.18);
		animation: cd-pop var(--duration-normal) var(--ease-out);
	}

	.cd-title {
		font-size: 1.0625rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.cd-message {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	.cd-actions {
		display: flex;
		gap: var(--space-3);
		margin-top: var(--space-2);
	}

	.cd-cancel {
		flex: 1;
		height: 44px;
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: background var(--duration-fast) var(--ease-out);
	}

	.cd-cancel:hover {
		background: var(--color-surface-subtle);
	}

	/* Destructive primary: clay (genuine attention), never gold. */
	.cd-confirm {
		flex: 1;
		height: 44px;
		background: var(--color-clay);
		border: none;
		border-radius: var(--radius-md);
		color: #fff;
		font-weight: 700;
		font-family: inherit;
		cursor: pointer;
		transition: opacity var(--duration-fast) var(--ease-out);
	}

	.cd-confirm:hover {
		opacity: 0.92;
	}

	@keyframes cd-fade {
		from { opacity: 0; }
		to   { opacity: 1; }
	}

	@keyframes cd-pop {
		from { opacity: 0; transform: translate(-50%, -48%) scale(0.98); }
		to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
	}
</style>
