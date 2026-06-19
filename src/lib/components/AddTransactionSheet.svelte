<script lang="ts">
	import { Mic, X } from 'lucide-svelte';
	import Spinner from './Spinner.svelte';
	import { parseToPaise, formatPaise } from '$lib/utils/money';
	import { parseFlexDate, nowIso } from '$lib/utils/date';
	import { isSpeechSupported, captureOnce } from '$lib/utils/voice/capture';
	import { parse } from '$lib/anchors';
	import type { TransactionDraft, Category } from '$lib/types';

	interface Props {
		open: boolean;
		categories: Category[];
		onclose: () => void;
		onsubmit: (draft: Required<TransactionDraft>) => Promise<void>;
	}

	let { open, categories, onclose, onsubmit }: Props = $props();

	// ── Local state ────────────────────────────────────────────────────────
	let amountRaw = $state('');
	let categoryId = $state('');
	let description = $state('');
	let occurredAt = $state(nowIso().slice(0, 10)); // YYYY-MM-DD
	let submitting = $state(false);
	let listening = $state(false);
	let error = $state<string | null>(null);

	// Voice metadata: held between capture and submit for logging.
	let pendingVoice = $state<{ raw_transcript: string; parsed_json: string } | null>(null);

	const speechSupported = isSpeechSupported();

	// Derived: parsed paise from the amount field
	let amountPaise = $derived(parseToPaise(amountRaw));

	// ── Prefill from a draft (called after voice parse) ────────────────────
	export function prefill(draft: TransactionDraft) {
		if (draft.amount_paise !== null) amountRaw = (draft.amount_paise / 100).toString();
		if (draft.category_id) categoryId = draft.category_id;
		if (draft.description) description = draft.description;
		if (draft.occurred_at) occurredAt = draft.occurred_at.slice(0, 10);
	}

	// ── Voice capture ──────────────────────────────────────────────────────
	async function handleVoice() {
		error = null;
		listening = true;

		try {
			const capture = await captureOnce();
			const categoryNames = categories.map((c) => c.name);
			const result = parse(capture.transcript, categoryNames);

			// Resolve category_hint → category ID
			let resolvedCategoryId: string | null = null;
			if (result.category_hint) {
				const match = categories.find(
					(c) => c.name.toLowerCase() === result.category_hint!.toLowerCase()
				);
				resolvedCategoryId = match?.id ?? null;
			}

			const draft: TransactionDraft = {
				...result.draft,
				category_id: resolvedCategoryId
			};

			prefill(draft);

			// Store for fire-and-forget logging after submit.
			pendingVoice = {
				raw_transcript: capture.transcript,
				parsed_json: JSON.stringify({ draft: result.draft, category_hint: result.category_hint, confidence: result.confidence })
			};
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Voice capture failed';
			error = msg === 'not-allowed'
				? 'Microphone access denied. Allow it in your browser settings.'
				: msg === 'No speech detected'
					? 'No speech detected. Try again.'
					: 'Voice capture failed. Type instead.';
		} finally {
			listening = false;
		}
	}

	// ── Submit ─────────────────────────────────────────────────────────────
	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (amountPaise === null || amountPaise <= 0) {
			error = 'Enter a valid amount';
			return;
		}
		const resolvedCategory =
			categoryId || categories.find((c) => c.is_system && c.name === 'Uncategorized')?.id || '';

		submitting = true;
		error = null;

		const finalDraft: Required<TransactionDraft> = {
			amount_paise: amountPaise,
			category_id: resolvedCategory,
			description,
			occurred_at: parseFlexDate(occurredAt)
		};

		try {
			await onsubmit(finalDraft);

			// Fire-and-forget: log voice sample if this was a voice entry.
			if (pendingVoice) {
				const { raw_transcript, parsed_json } = pendingVoice;
				const final_json = JSON.stringify(finalDraft);
				// Detect correction: compare description or category changed from parse
				const parsedDraft = (JSON.parse(parsed_json) as { draft: TransactionDraft }).draft;
				const was_corrected =
					finalDraft.description !== parsedDraft.description ||
					finalDraft.category_id !== parsedDraft.category_id ||
					finalDraft.amount_paise !== parsedDraft.amount_paise;

				void fetch('/api/voice-samples', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ raw_transcript, parsed_json, final_json, was_corrected })
				});

				pendingVoice = null;
			}

			reset();
			onclose();
		} catch {
			error = 'Could not save. Try again.';
		} finally {
			submitting = false;
		}
	}

	function reset() {
		amountRaw = '';
		categoryId = '';
		description = '';
		occurredAt = nowIso().slice(0, 10);
		error = null;
		pendingVoice = null;
	}

	// ── Focus trap ─────────────────────────────────────────────────────────
	const FOCUSABLE =
		'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	function focusTrap(node: HTMLElement) {
		const getEls = () => [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];

		function onKeydown(e: KeyboardEvent) {
			if (e.key !== 'Tab') return;
			const els = getEls();
			if (!els.length) return;
			const first = els[0];
			const last = els[els.length - 1];
			if (e.shiftKey) {
				if (document.activeElement === first) {
					e.preventDefault();
					last.focus();
				}
			} else {
				if (document.activeElement === last) {
					e.preventDefault();
					first.focus();
				}
			}
		}

		node.addEventListener('keydown', onKeydown);
		// Move focus into the sheet when it opens.
		getEls()[0]?.focus();

		return { destroy() { node.removeEventListener('keydown', onKeydown); } };
	}
</script>

{#if open}
	<!-- Backdrop -->
	<div
		class="backdrop"
		role="button"
		tabindex="-1"
		aria-label="Close"
		onclick={onclose}
		onkeydown={(e) => e.key === 'Escape' && onclose()}
	></div>

	<!-- Sheet -->
	<div
		class="sheet"
		role="dialog"
		aria-modal="true"
		aria-label="Add expense"
		use:focusTrap
	>
		<div class="sheet-header">
			<span class="sheet-title">Add expense</span>
			<button class="icon-btn" onclick={onclose} aria-label="Close">
				<X size={20} />
			</button>
		</div>

		<form class="sheet-body" onsubmit={handleSubmit} novalidate>
			<!-- Amount: first and largest -->
			<div class="field field--hero">
				<label for="amount" class="sr-only">Amount in rupees</label>
				<div class="amount-row">
					<span class="currency-symbol" aria-hidden="true">₹</span>
					<input
						id="amount"
						type="text"
						inputmode="decimal"
						placeholder="0"
						bind:value={amountRaw}
						class="amount-input money"
						autocomplete="off"
						required
					/>
					{#if speechSupported}
						<button
							type="button"
							class="icon-btn voice-btn"
							class:listening
							onclick={handleVoice}
							aria-label={listening ? 'Listening...' : 'Add by voice'}
							disabled={submitting || listening}
						>
							{#if listening}
								<Spinner size={20} label="Listening" />
							{:else}
								<Mic size={20} />
							{/if}
						</button>
					{/if}
				</div>
				{#if listening}
					<p class="listening-hint" aria-live="polite">Listening… speak your expense</p>
				{/if}
			</div>

			<!-- Category: grouped by kind. The chosen kind sets the sign server-side. -->
			<div class="field">
				<label for="category">Category</label>
				<select id="category" bind:value={categoryId}>
					<option value="">Uncategorized</option>
					<optgroup label="Spending">
						{#each categories.filter((c) => c.kind === 'expense' && !(c.is_system && c.name === 'Uncategorized')) as cat}
							<option value={cat.id}>{cat.name}</option>
						{/each}
					</optgroup>
					<optgroup label="Income">
						{#each categories.filter((c) => c.kind === 'income' && !(c.is_system && c.name === 'Income')) as cat}
							<option value={cat.id}>{cat.name}</option>
						{/each}
					</optgroup>
				</select>
			</div>

			<!-- Description -->
			<div class="field">
				<label for="description">Description</label>
				<input
					id="description"
					type="text"
					placeholder="What was this for?"
					bind:value={description}
					autocomplete="off"
				/>
			</div>

			<!-- Date -->
			<div class="field">
				<label for="date">Date</label>
				<input id="date" type="date" bind:value={occurredAt} />
			</div>

			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}

			<button type="submit" class="submit-btn" disabled={submitting || !amountPaise}>
				{#if submitting}
					<Spinner size={18} label="Saving" />
				{:else}
					Save
				{/if}
			</button>
		</form>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(12, 35, 64, 0.4);
		z-index: var(--z-sheet);
		animation: fade-in var(--duration-fast) var(--ease-out);
	}

	.sheet {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--color-surface);
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
		z-index: calc(var(--z-sheet) + 1);
		padding-bottom: env(safe-area-inset-bottom, 0px);
		animation: slide-up var(--duration-normal) var(--ease-out);
		max-height: 90dvh;
		overflow-y: auto;
	}

	.sheet-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-4) var(--space-6);
		border-bottom: 1px solid var(--color-border);
	}

	.sheet-title {
		font-weight: 600;
		font-size: 1rem;
	}

	.sheet-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-6);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.field label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.field--hero label { display: none; }

	.amount-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.currency-symbol {
		font-family: var(--font-display);
		font-size: 2rem;
		color: var(--color-text-muted);
		line-height: 1;
	}

	.amount-input {
		font-family: var(--font-display);
		font-size: 2.5rem;
		font-weight: 700;
		border: none;
		border-bottom: 2px solid var(--color-border);
		border-radius: 0;
		background: transparent;
		padding: var(--space-1) 0;
		flex: 1;
		color: var(--color-gold);
	}

	.amount-input:focus {
		outline: none;
		border-bottom-color: var(--color-gold);
	}

	.listening-hint {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		padding-top: var(--space-1);
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--tap-target);
		height: var(--tap-target);
		min-width: var(--tap-target);
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		border-radius: var(--radius-full);
		cursor: pointer;
		transition: color var(--duration-fast) var(--ease-out);
	}

	.icon-btn:hover { color: var(--color-text); }

	.voice-btn.listening { color: var(--color-clay); }

	.submit-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		width: 100%;
		height: 52px;
		background: var(--color-gold);
		color: var(--color-ink);
		font-weight: 700;
		font-size: 1rem;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: opacity var(--duration-fast) var(--ease-out);
		margin-top: var(--space-2);
	}

	.submit-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.error {
		color: var(--color-clay);
		font-size: 0.875rem;
	}

	.sr-only {
		position: absolute;
		width: 1px; height: 1px;
		padding: 0; margin: -1px;
		overflow: hidden;
		clip: rect(0,0,0,0);
		white-space: nowrap;
		border: 0;
	}

	@keyframes fade-in {
		from { opacity: 0; }
		to   { opacity: 1; }
	}

	@keyframes slide-up {
		from { transform: translateY(100%); }
		to   { transform: translateY(0); }
	}
</style>
