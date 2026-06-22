<script lang="ts">
	import { Mic, Square, X } from 'lucide-svelte';
	import Spinner from './Spinner.svelte';
	import { invalidateAll } from '$app/navigation';
	import { parseToPaise, formatPaise, formatAmountInput, amountInWordsIndian } from '$lib/utils/money';
	import { parseFlexDate, nowIso } from '$lib/utils/date';
	import { isSpeechSupported, captureOnce } from '$lib/utils/voice/capture';
	import { parse, matchCategory } from '$lib/anchors';
	import type { TransactionDraft, Category, Transaction } from '$lib/types';

	interface Props {
		open: boolean;
		categories: Category[];
		onclose: () => void;
		onsubmit: (draft: Required<TransactionDraft>) => Promise<void>;
		editingTx?: Transaction | null;
	}

	let { open, categories, onclose, onsubmit, editingTx = null }: Props = $props();

	// ── Local state ────────────────────────────────────────────────────────
	let entryKind = $state<'expense' | 'income'>('expense'); // expense or income
	let amountRaw = $state('');
	let categoryId = $state('');
	let description = $state('');
	let note = $state('');
	let showNote = $state(false);
	let occurredAt = $state(nowIso().slice(0, 10)); // YYYY-MM-DD
	let submitting = $state(false);
	let listening = $state(false);
	let error = $state<string | null>(null);

	// Voice metadata: held between capture and submit for logging.
	let pendingVoice = $state<{ raw_transcript: string; parsed_json: string } | null>(null);
	let categoryManuallySet = $state(false);

	// Inline category creation from the picker.
	let showNewCategory = $state(false);
	let newCatName = $state('');
	let creatingCat = $state(false);

	const speechSupported = isSpeechSupported();

	// Derived: parsed paise from the amount field
	let amountPaise = $derived(parseToPaise(amountRaw));

	// Categories matching the chosen kind (income vs spending), minus the fallbacks.
	let pickableCategories = $derived(
		categories.filter(
			(c) =>
				c.kind === entryKind &&
				!(c.is_system && (c.name === 'Uncategorized' || c.name === 'Income'))
		)
	);

	// Switching kind clears a category that no longer matches.
	function setKind(kind: 'expense' | 'income') {
		if (entryKind === kind) return;
		entryKind = kind;
		const stillValid = categories.find((c) => c.id === categoryId && c.kind === kind);
		if (!stillValid) categoryId = '';
	}

	function onCategoryChange(e: Event) {
		const v = (e.currentTarget as HTMLSelectElement).value;
		if (v === '__new__') {
			showNewCategory = true;
			categoryId = '';
			return;
		}
		categoryManuallySet = true;
	}

	function cancelNewCategory() {
		showNewCategory = false;
		newCatName = '';
	}

	// Create a category inline and select it, without leaving the sheet.
	async function createCategoryInline() {
		const name = newCatName.trim();
		if (!name) return;
		creatingCat = true;
		error = null;
		const res = await fetch('/api/categories', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name, color: '#6B7280', kind: entryKind, bucket: 'flexible' })
		});
		creatingCat = false;
		if (!res.ok) {
			error = res.status === 409 ? 'That category already exists' : 'Could not create category';
			return;
		}
		const created = (await res.json()) as { id: string };
		await invalidateAll();
		categoryId = created.id;
		categoryManuallySet = true;
		showNewCategory = false;
		newCatName = '';
	}

	// ── Prefill from a draft (called after voice parse) ────────────────────
	export function prefill(draft: TransactionDraft) {
		if (draft.amount_paise !== null) amountRaw = formatAmountInput((draft.amount_paise / 100).toString());
		if (draft.category_id) categoryId = draft.category_id;
		if (draft.description) description = draft.description;
		if (draft.note) {
			note = draft.note;
			showNote = true;
		}
		if (draft.occurred_at) occurredAt = draft.occurred_at.slice(0, 10);
	}

	// ── Voice capture ──────────────────────────────────────────────────────
	let voiceAbort: AbortController | null = null;

	// Tapping the mic while listening stops capture and uses whatever was heard.
	function stopVoice() {
		voiceAbort?.abort();
	}

	async function handleVoice() {
		// If already listening, the button acts as a stop control.
		if (listening) {
			stopVoice();
			return;
		}
		error = null;
		listening = true;
		voiceAbort = new AbortController();

		try {
			const capture = await captureOnce({ signal: voiceAbort.signal });
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
				category_id: resolvedCategoryId,
				note: ''
			};

			prefill(draft);

			// Store for fire-and-forget logging after submit.
			pendingVoice = {
				raw_transcript: capture.transcript,
				parsed_json: JSON.stringify({ draft: result.draft, category_hint: result.category_hint, confidence: result.confidence })
			};
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Voice capture failed';
			// A manual stop with nothing captured is silent, not an error.
			if (msg === 'cancelled') {
				// no-op
			} else {
				error =
					msg === 'not-allowed'
						? 'Microphone access denied. Allow it in your browser settings.'
						: msg === 'No speech detected'
							? 'No speech detected. Try again.'
							: 'Voice capture failed. Type instead.';
			}
		} finally {
			listening = false;
			voiceAbort = null;
		}
	}

	// ── Submit ─────────────────────────────────────────────────────────────
	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (amountPaise === null || amountPaise <= 0) {
			error = 'Enter a valid amount';
			return;
		}
		// Default category follows the chosen kind: Uncategorized for spending,
		// Income for income. The category's kind sets the sign server-side.
		const fallbackName = entryKind === 'income' ? 'Income' : 'Uncategorized';
		const resolvedCategory =
			categoryId || categories.find((c) => c.is_system && c.name === fallbackName)?.id || '';

		submitting = true;
		error = null;

		const finalDraft: Required<TransactionDraft> = {
			amount_paise: amountPaise,
			category_id: resolvedCategory,
			description,
			note,
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
		entryKind = 'expense';
		amountRaw = '';
		categoryId = '';
		categoryManuallySet = false;
		description = '';
		note = '';
		showNote = false;
		occurredAt = nowIso().slice(0, 10);
		error = null;
		pendingVoice = null;
	}

	// ── Auto-categorize typed description (new entries only) ─────────────────
	$effect(() => {
		if (editingTx || categoryManuallySet || !description) return;
		const hint = matchCategory(description);
		if (!hint) return;
		const match = pickableCategories.find((c) => c.name.toLowerCase() === hint.toLowerCase());
		if (match && match.id !== categoryId) categoryId = match.id;
	});

	// ── Prefill from editingTx when the sheet opens for an edit ─────────────
	$effect(() => {
		if (!open) { reset(); return; }
		if (!editingTx) return;
		entryKind = editingTx.amount_paise >= 0 ? 'income' : 'expense';
		amountRaw = formatAmountInput((Math.abs(editingTx.amount_paise) / 100).toString());
		categoryId = editingTx.category_id;
		categoryManuallySet = true;
		description = editingTx.description;
		note = editingTx.note ?? '';
		showNote = true; // editing always reveals the note field so it can be added or changed
		occurredAt = editingTx.occurred_at.slice(0, 10);
	});

	// ── Body scroll lock ───────────────────────────────────────────────────
	// overflow:hidden alone doesn't prevent background scroll on iOS Safari.
	// position:fixed + saved top offset is the only reliable cross-platform fix.
	let _scrollY = 0;
	$effect(() => {
		if (typeof document === 'undefined') return;
		if (open) {
			_scrollY = window.scrollY;
			document.body.style.position = 'fixed';
			document.body.style.top = `-${_scrollY}px`;
			document.body.style.width = '100%';
		} else {
			document.body.style.position = '';
			document.body.style.top = '';
			document.body.style.width = '';
			window.scrollTo(0, _scrollY);
		}
		return () => {
			document.body.style.position = '';
			document.body.style.top = '';
			document.body.style.width = '';
			window.scrollTo(0, _scrollY);
		};
	});

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
		aria-label="Add entry"
		use:focusTrap
	>
		<div class="sheet-header">
			<span class="sheet-title">{editingTx ? 'Edit' : 'Add'} {entryKind === 'income' ? 'income' : 'expense'}</span>
			<button class="icon-btn" onclick={onclose} aria-label="Close">
				<X size={20} />
			</button>
		</div>

		<form class="sheet-body" onsubmit={handleSubmit} novalidate>
			<!-- Expense or income: drives the category list and the sign. -->
			<div class="kind-toggle" role="radiogroup" aria-label="Expense or income">
				<button
					type="button"
					class="kind-option"
					class:active={entryKind === 'expense'}
					aria-pressed={entryKind === 'expense'}
					onclick={() => setKind('expense')}
				>
					Expense
				</button>
				<button
					type="button"
					class="kind-option"
					class:active={entryKind === 'income'}
					aria-pressed={entryKind === 'income'}
					onclick={() => setKind('income')}
				>
					Income
				</button>
			</div>

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
						value={amountRaw}
						oninput={(e) => (amountRaw = formatAmountInput(e.currentTarget.value))}
						class="amount-input money"
						autocomplete="off"
						required
					/>
					{#if speechSupported && !listening && !editingTx}
						<button
							type="button"
							class="icon-btn voice-btn"
							onclick={handleVoice}
							aria-label="Add by voice"
							disabled={submitting}
						>
							<Mic size={20} />
						</button>
					{/if}
				</div>
				{#if listening}
					<button
						type="button"
						class="stop-btn"
						onclick={stopVoice}
						aria-label="Stop recording"
						aria-live="polite"
					>
						<Square size={16} fill="currentColor" />
						Stop recording
					</button>
				{:else if amountPaise && amountPaise > 0}
					<p class="amount-formatted" aria-live="polite">
						{formatPaise(amountPaise)}{#if amountInWordsIndian(amountPaise)} · {amountInWordsIndian(amountPaise)}{/if}
					</p>
				{/if}
			</div>

			<!-- Category: only those matching the chosen kind. Kind sets the sign. -->
			<div class="field">
				<label for="category">Category</label>
				<select id="category" bind:value={categoryId} onchange={onCategoryChange}>
					<option value="">{entryKind === 'income' ? 'Income (uncategorised)' : 'Uncategorized'}</option>
					{#each pickableCategories as cat}
						<option value={cat.id}>{cat.name}</option>
					{/each}
					<option value="__new__">+ New category</option>
				</select>
				{#if showNewCategory}
					<div class="new-cat-row">
						<input
							type="text"
							class="new-cat-input"
							placeholder="New category name"
							bind:value={newCatName}
							maxlength="50"
						/>
						<button
							type="button"
							class="new-cat-add"
							onclick={createCategoryInline}
							disabled={creatingCat || !newCatName.trim()}
						>
							{#if creatingCat}<Spinner size={14} label="Creating" />{:else}Add{/if}
						</button>
						<button type="button" class="new-cat-cancel" onclick={cancelNewCategory}>Cancel</button>
					</div>
				{/if}
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

			<!-- Note: optional, revealed on demand to keep capture fast. -->
			{#if showNote}
				<div class="field">
					<label for="note">Note</label>
					<textarea
						id="note"
						placeholder="Any extra context"
						bind:value={note}
						rows="2"
						maxlength="500"
					></textarea>
				</div>
			{:else}
				<button type="button" class="add-note-btn" onclick={() => (showNote = true)}>
					+ Add a note
				</button>
			{/if}

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
					{editingTx ? 'Save changes' : 'Save'}
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
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
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

	.field textarea {
		font-family: inherit;
		font-size: 1rem;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		resize: vertical;
	}

	.field textarea:focus {
		outline: none;
		border-color: var(--color-gold);
	}

	/* Category picker: themed to match the sheet, with a custom chevron. */
	.field select {
		appearance: none;
		-webkit-appearance: none;
		height: 44px;
		width: 100%;
		padding: 0 var(--space-8) 0 var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: var(--color-surface);
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237C756A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right var(--space-3) center;
		font-size: 1rem;
		color: var(--color-text);
		font-family: inherit;
	}

	.field select:focus {
		outline: none;
		border-color: var(--color-gold);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-gold) 15%, transparent);
	}

	/* Expense/Income segmented toggle */
	.kind-toggle {
		display: flex;
		gap: var(--space-2);
	}

	.kind-option {
		flex: 1;
		height: 40px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.kind-option.active {
		border-color: var(--color-text);
		color: var(--color-text);
		font-weight: 600;
		background: var(--color-surface-subtle);
	}

	.add-note-btn {
		align-self: flex-start;
		background: none;
		border: none;
		padding: 0;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

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

	.amount-formatted {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin-top: var(--space-1);
		font-variant-numeric: tabular-nums lining-nums;
	}

	.stop-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		width: 100%;
		height: 48px;
		margin-top: var(--space-2);
		background: var(--color-clay);
		color: #fff;
		font-size: 0.9375rem;
		font-weight: 600;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		animation: pulse 1.2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50%       { opacity: 0.75; }
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

	.new-cat-row {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.new-cat-input {
		flex: 1;
		min-width: 0;
		height: 44px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 1rem;
		color: var(--color-text);
	}

	.new-cat-input:focus {
		outline: none;
		border-color: var(--color-gold);
	}

	/* Secondary, not gold: Save stays the one primary action in the sheet. */
	.new-cat-add {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 44px;
		min-width: 56px;
		padding: 0 var(--space-4);
		background: var(--color-surface-subtle);
		color: var(--color-text);
		font-weight: 600;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-family: inherit;
	}

	.new-cat-add:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.new-cat-cancel {
		flex: none;
		height: 44px;
		padding: 0 var(--space-3);
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text-muted);
		cursor: pointer;
		font-family: inherit;
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
