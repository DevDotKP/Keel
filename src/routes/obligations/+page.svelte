<script lang="ts">
	import { Trash2, Check, ArrowLeft, Edit2, X } from 'lucide-svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { invalidateAll } from '$app/navigation';
	import { formatPaiseLedger, parseToPaise, formatAmountInput, amountInWordsIndian } from '$lib/utils/money';
	import { today, formatDisplayDate } from '$lib/utils/date';
	import { resolvePaymentDate, type SalaryAnchor } from '$lib/utils/workdays';
	import { holidaysForState, type IndianState } from '$lib/holidays';
	import type { PageData } from './$types';
	import type { RecurringIncome, SalaryAnchorKind } from '$lib/types';
	import type { RecurringExpense } from '$lib/server/queries/recurring-expenses';

	let { data }: { data: PageData } = $props();

	let newName = $state('');
	let newAmount = $state('');
	let newCategory = $state('');
	let newCadence = $state<'weekly' | 'fortnightly' | 'monthly'>('monthly');
	let submitting = $state(false);
	let busyId = $state<string | null>(null);
	let error = $state<string | null>(null);
	// Optimistically removed rows (obligations and income) during delete.
	let removedIds = $state<string[]>([]);

	let newAmountPaise = $derived(parseToPaise(newAmount));

	let visibleObligations = $derived(data.obligations.filter((o) => !removedIds.includes(o.id)));
	let totalDue = $derived(
		visibleObligations.filter((o) => !o.paid && o.is_active).reduce((sum, o) => sum + o.amount_paise, 0)
	);

	async function handleCreate(e: Event) {
		e.preventDefault();
		if (newAmountPaise === null || newAmountPaise <= 0) {
			error = 'Enter a valid amount';
			return;
		}
		submitting = true;
		error = null;

		const res = await fetch('/api/obligations', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: newName.trim(),
				amount_paise: newAmountPaise,
				category_id: newCategory || null,
				cadence: newCadence
			})
		});

		submitting = false;
		if (!res.ok) {
			error = 'Could not add. Try again.';
			return;
		}
		newName = '';
		newAmount = '';
		newCategory = '';
		await invalidateAll();
	}

	async function togglePaid(id: string, paid: boolean) {
		busyId = id;
		error = null;
		const res = await fetch(`/api/obligations/${id}/settle`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ paid })
		});
		busyId = null;
		if (!res.ok) {
			error = 'Could not update. Try again.';
			return;
		}
		await invalidateAll();
	}

	// Single hand-styled confirm for both obligation and income deletes.
	let confirmState = $state<{ title: string; message: string; run: () => void } | null>(null);

	function handleDelete(id: string) {
		confirmState = {
			title: 'Delete obligation?',
			message: 'Past payments stay in your ledger.',
			run: () => actuallyDelete(id)
		};
	}

	async function actuallyDelete(id: string) {
		removedIds = [...removedIds, id]; // hide immediately
		const res = await fetch(`/api/obligations/${id}`, { method: 'DELETE' });
		if (!res.ok) {
			removedIds = removedIds.filter((x) => x !== id); // restore on failure
			error = 'Could not delete. Try again.';
		}
	}

	function categoryName(id: string | null): string {
		if (!id) return 'Uncategorized';
		return data.categories.find((c) => c.id === id)?.name ?? 'Uncategorized';
	}

	// ── Recurring income ─────────────────────────────────────────────────────
	let incName = $state('');
	let incAmount = $state('');
	let incAnchorKind = $state<SalaryAnchorKind>('end_of_month');
	let incAnchorDay = $state(25);
	let incCategory = $state('');
	let incEndDate = $state('');
	let incDueTime = $state('');
	let incSubmitting = $state(false);
	let incBusyId = $state<string | null>(null);
	let incError = $state<string | null>(null);
	let incAmountPaise = $derived(parseToPaise(incAmount));
	let visibleIncome = $derived(data.recurringIncome.filter((i) => !removedIds.includes(i.id)));

	// Edit mode
	let editingIncId = $state<string | null>(null);
	let editIncName = $state('');
	let editIncAmount = $state('');
	let editIncFrequency = $state('monthly');
	let editIncNextDue = $state('');
	let editIncEndDate = $state('');
	let editIncOccurrenceLimit = $state('');
	let editIncDueTime = $state('');
	let editIncAmountPaise = $derived(parseToPaise(editIncAmount));

	// ── Recurring expenses ───────────────────────────────────────────────────
	let expName = $state('');
	let expAmount = $state('');
	let expCategory = $state('');
	let expFrequency = $state<string>('monthly');
	let expEndDate = $state('');
	let expDueTime = $state('');
	let expSubmitting = $state(false);
	let expBusyId = $state<string | null>(null);
	let expError = $state<string | null>(null);
	let expAmountPaise = $derived(parseToPaise(expAmount));
	let visibleExpenses = $derived(data.recurringExpenses.filter((e) => !removedIds.includes(e.id)));

	// Edit mode for expenses
	let editingExpId = $state<string | null>(null);
	let editExpName = $state('');
	let editExpAmount = $state('');
	let editExpFrequency = $state('monthly');
	let editExpNextDue = $state('');
	let editExpEndDate = $state('');
	let editExpOccurrenceLimit = $state('');
	let editExpCategory = $state('');
	let editExpDueTime = $state('');
	let editExpAmountPaise = $derived(parseToPaise(editExpAmount));

	function openEditExpense(exp: RecurringExpense) {
		editingExpId = exp.id;
		editExpName = exp.name;
		editExpAmount = (exp.amount_paise / 100).toString();
		editExpFrequency = exp.frequency || 'monthly';
		editExpNextDue = exp.next_due_at?.split('T')[0] || '';
		editExpEndDate = exp.end_date || '';
		editExpOccurrenceLimit = exp.occurrence_limit ? exp.occurrence_limit.toString() : '';
		editExpCategory = exp.category_id || '';
		editExpDueTime = exp.due_time || '';
	}

	function closeEditExpense() {
		editingExpId = null;
		editExpName = '';
		editExpAmount = '';
		editExpFrequency = 'monthly';
		editExpNextDue = '';
		editExpEndDate = '';
		editExpOccurrenceLimit = '';
		editExpCategory = '';
		editExpDueTime = '';
	}

	async function handleCreateExpense(e: Event) {
		e.preventDefault();
		if (expAmountPaise === null || expAmountPaise <= 0) {
			expError = 'Enter a valid amount';
			return;
		}
		if (!expCategory) {
			expError = 'Select a category';
			return;
		}
		expSubmitting = true;
		expError = null;
		const res = await fetch('/api/recurring-expenses', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: expName.trim(),
				amount_paise: expAmountPaise,
				category_id: expCategory,
				frequency: expFrequency,
				end_date: expEndDate || null,
				due_time: expDueTime || null
			})
		});
		expSubmitting = false;
		if (!res.ok) {
			expError = 'Could not add. Try again.';
			return;
		}
		expName = '';
		expAmount = '';
		expCategory = '';
		expFrequency = 'monthly';
		expEndDate = '';
		expDueTime = '';
		await invalidateAll();
	}

	async function saveEditExpense() {
		if (!editingExpId || !editExpName.trim()) return;
		expBusyId = editingExpId;
		expError = null;
		const res = await fetch(`/api/recurring-expenses/${editingExpId}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: editExpName.trim(),
				amount_paise: editExpAmountPaise,
				category_id: editExpCategory || undefined,
				frequency: editExpFrequency,
				next_due_at: editExpNextDue || undefined,
				end_date: editExpEndDate || null,
				occurrence_limit: editExpOccurrenceLimit ? parseInt(editExpOccurrenceLimit, 10) : null,
				due_time: editExpDueTime || null
			})
		});
		expBusyId = null;
		if (!res.ok) {
			expError = 'Could not save. Try again.';
			return;
		}
		closeEditExpense();
		await invalidateAll();
	}

	function deleteExpense(id: string) {
		confirmState = {
			title: 'Delete recurring expense?',
			message: 'This stops auto-logging it. Past entries stay in your ledger.',
			run: () => actuallyDeleteExpense(id)
		};
	}

	async function actuallyDeleteExpense(id: string) {
		removedIds = [...removedIds, id];
		const res = await fetch(`/api/recurring-expenses/${id}`, { method: 'DELETE' });
		if (!res.ok) {
			removedIds = removedIds.filter((x) => x !== id);
			expError = 'Could not delete. Try again.';
		}
	}

	const FREQUENCIES: { value: string; label: string }[] = [
		{ value: 'weekly', label: 'Weekly' },
		{ value: 'bi_weekly', label: 'Fortnightly' },
		{ value: 'monthly', label: 'Monthly' },
		{ value: 'bi_monthly', label: 'Bi-monthly' },
		{ value: 'quarterly', label: 'Quarterly' },
		{ value: 'half_yearly', label: 'Half-yearly' },
		{ value: 'yearly', label: 'Annually' },
		{ value: 'daily', label: 'Daily' }
	];

	function expFrequencyLabel(freq: string): string {
		return FREQUENCIES.find((f) => f.value === freq)?.label ?? freq;
	}

	function toAnchor(inc: RecurringIncome): SalaryAnchor {
		if (inc.anchor_kind === 'day_of_month') return { kind: 'day_of_month', day: inc.anchor_day ?? 1 };
		const kind = (inc.anchor_kind ?? 'end_of_month') as 'end_of_month' | 'start_of_month';
		return { kind };
	}

	function anchorLabel(inc: RecurringIncome): string {
		if (inc.frequency) return expFrequencyLabel(inc.frequency);
		if (inc.anchor_kind === 'end_of_month') return 'End of month';
		if (inc.anchor_kind === 'start_of_month') return 'Start of month';
		if (inc.anchor_kind === 'day_of_month') return `Day ${inc.anchor_day} of the month`;
		return 'Monthly';
	}

	// Next pay date from today, adjusted for weekends and the user's state holidays.
	// Only meaningful for anchor-kind items; frequency items use next_due_at directly.
	function nextPayDate(inc: RecurringIncome): string {
		if (inc.next_due_at) return inc.next_due_at.split('T')[0];
		const t = today();
		let y = parseInt(t.slice(0, 4), 10);
		let m = parseInt(t.slice(5, 7), 10);
		const state = (data.homeState as IndianState | null) ?? null;
		for (let i = 0; i < 13; i++) {
			const d = resolvePaymentDate(toAnchor(inc), y, m, holidaysForState(state, y));
			if (d >= t) return d;
			m++;
			if (m > 12) {
				m = 1;
				y++;
			}
		}
		return '';
	}

	async function handleCreateIncome(e: Event) {
		e.preventDefault();
		if (incAmountPaise === null || incAmountPaise <= 0) {
			incError = 'Enter a valid amount';
			return;
		}
		incSubmitting = true;
		incError = null;
		const res = await fetch('/api/recurring-income', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: incName.trim(),
				amount_paise: incAmountPaise,
				anchor_kind: incAnchorKind,
				anchor_day: incAnchorKind === 'day_of_month' ? incAnchorDay : null,
				category_id: incCategory || null,
				end_date: incEndDate || null,
				due_time: incDueTime || null
			})
		});
		incSubmitting = false;
		if (!res.ok) {
			incError = 'Could not add. Try again.';
			return;
		}
		incName = '';
		incAmount = '';
		incCategory = '';
		incEndDate = '';
		incDueTime = '';
		await invalidateAll();
	}

	function deleteIncome(id: string) {
		confirmState = {
			title: 'Delete recurring income?',
			message: 'This stops forecasting it. Past entries stay in your ledger.',
			run: () => actuallyDeleteIncome(id)
		};
	}

	async function actuallyDeleteIncome(id: string) {
		removedIds = [...removedIds, id];
		const res = await fetch(`/api/recurring-income/${id}`, { method: 'DELETE' });
		if (!res.ok) {
			removedIds = removedIds.filter((x) => x !== id);
			incError = 'Could not delete. Try again.';
		}
	}

	function openEditIncome(inc: RecurringIncome) {
		editingIncId = inc.id;
		editIncName = inc.name;
		editIncAmount = (inc.amount_paise / 100).toString();
		editIncFrequency = inc.frequency || 'monthly';
		editIncNextDue = inc.next_due_at?.split('T')[0] || '';
		editIncEndDate = inc.end_date || '';
		editIncOccurrenceLimit = inc.occurrence_limit ? inc.occurrence_limit.toString() : '';
		editIncDueTime = inc.due_time || '';
	}

	function closeEditIncome() {
		editingIncId = null;
		editIncName = '';
		editIncAmount = '';
		editIncFrequency = 'monthly';
		editIncNextDue = '';
		editIncEndDate = '';
		editIncOccurrenceLimit = '';
		editIncDueTime = '';
	}

	async function saveEditIncome() {
		if (!editingIncId || !editIncName.trim()) return;
		incBusyId = editingIncId;
		incError = null;
		const res = await fetch(`/api/recurring-income/${editingIncId}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: editIncName.trim(),
				amount_paise: editIncAmountPaise,
				frequency: editIncFrequency,
				next_due_at: editIncNextDue || undefined,
				end_date: editIncEndDate || null,
				occurrence_limit: editIncOccurrenceLimit ? parseInt(editIncOccurrenceLimit, 10) : null,
				due_time: editIncDueTime || null
			})
		});
		incBusyId = null;
		if (!res.ok) {
			incError = 'Could not save. Try again.';
			return;
		}
		closeEditIncome();
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Recurring - Keel</title>
</svelte:head>

<div class="obligations-page">
	<header class="page-header">
		<a href="/settings" class="back-btn" aria-label="Back to settings">
			<ArrowLeft size={20} aria-hidden="true" />
		</a>
		<h1 class="section-head">Recurring &amp; obligations</h1>
		<p class="page-sub">Rent, bills, EMIs. Mark them paid and Keel logs the spend for you.</p>
	</header>

	{#if totalDue > 0}
		<div class="due-summary">
			<span class="due-label">Still due this period</span>
			<span class="money due-amount">{formatPaiseLedger(totalDue)}</span>
		</div>
	{/if}

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	{#if visibleObligations.length > 0}
		<ul class="obligation-list" aria-label="Your obligations">
			{#each visibleObligations as obl (obl.id)}
				<li class="obligation-row" class:paid={obl.paid}>
					<button
						class="check-btn"
						class:checked={obl.paid}
						onclick={() => togglePaid(obl.id, !obl.paid)}
						disabled={busyId === obl.id}
						aria-label={obl.paid ? `Mark ${obl.name} unpaid` : `Mark ${obl.name} paid`}
						aria-pressed={obl.paid}
					>
						{#if busyId === obl.id}
							<Spinner size={16} label="Updating" />
						{:else if obl.paid}
							<Check size={16} aria-hidden="true" />
						{/if}
					</button>

					<span class="obligation-main">
						<span class="obligation-name">{obl.name}</span>
						<span class="obligation-meta">
							{categoryName(obl.category_id)} · {obl.cadence}
						</span>
					</span>

					<span class="money obligation-amount">{formatPaiseLedger(obl.amount_paise)}</span>

					<button
						class="delete-btn"
						onclick={() => handleDelete(obl.id)}
						disabled={busyId === obl.id}
						aria-label="Delete {obl.name}"
					>
						<Trash2 size={16} aria-hidden="true" />
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<EmptyState
			heading="No obligations yet"
			body="Add rent or a bill below. They reserve money before you spend it."
		/>
	{/if}

	<!-- Add obligation -->
	<form class="add-form" onsubmit={handleCreate} novalidate>
		<h2 class="form-head">New obligation</h2>

		<div class="field">
			<label for="obl-name">Name</label>
			<input
				id="obl-name"
				type="text"
				placeholder="e.g. Rent"
				bind:value={newName}
				maxlength="60"
				required
			/>
		</div>

		<div class="field">
			<label for="obl-amount">Amount</label>
			<div class="amount-row">
				<span class="currency-symbol" aria-hidden="true">₹</span>
				<input
					id="obl-amount"
					type="text"
					inputmode="decimal"
					placeholder="0"
					value={newAmount}
					oninput={(e) => (newAmount = formatAmountInput(e.currentTarget.value))}
					class="money"
					required
				/>
			</div>
		</div>

		<div class="field">
			<label for="obl-category">Category</label>
			<select id="obl-category" bind:value={newCategory}>
				<option value="">Uncategorized</option>
				{#each data.categories.filter((c) => !c.is_system && c.kind === 'expense') as cat}
					<option value={cat.id}>{cat.name}</option>
				{/each}
			</select>
		</div>

		<div class="field">
			<label for="obl-cadence">How often</label>
			<select id="obl-cadence" bind:value={newCadence}>
				<option value="weekly">Weekly</option>
				<option value="fortnightly">Fortnightly</option>
				<option value="monthly">Monthly</option>
			</select>
		</div>

		<button type="submit" class="submit-btn" disabled={submitting || !newName.trim() || !newAmountPaise}>
			{#if submitting}<Spinner size={18} label="Adding" />{:else}Add obligation{/if}
		</button>
	</form>

	<!-- Recurring expenses: auto-logged on each cycle -->
	<section class="income-section">
		<h2 class="form-head">Recurring expenses</h2>
		<p class="page-sub">Subscriptions, EMIs, utilities. Keel posts these automatically each cycle.</p>

		{#if expError}
			<p class="error" role="alert">{expError}</p>
		{/if}

		{#if visibleExpenses.length > 0}
			<ul class="obligation-list" aria-label="Recurring expenses">
				{#each visibleExpenses as exp (exp.id)}
					<li class="obligation-row">
						<span class="obligation-main">
							<span class="obligation-name">{exp.name}</span>
							<span class="obligation-meta">
								{expFrequencyLabel(exp.frequency)} · next {formatDisplayDate(exp.next_due_at?.split('T')[0] ?? '')}
							</span>
						</span>
						<span class="money obligation-amount">{formatPaiseLedger(exp.amount_paise)}</span>
						<button
							class="edit-btn"
							onclick={() => openEditExpense(exp)}
							disabled={expBusyId === exp.id}
							aria-label="Edit {exp.name}"
						>
							<Edit2 size={16} aria-hidden="true" />
						</button>
						<button
							class="delete-btn"
							onclick={() => deleteExpense(exp.id)}
							disabled={expBusyId === exp.id}
							aria-label="Delete {exp.name}"
						>
							<Trash2 size={16} aria-hidden="true" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		<form class="add-form" onsubmit={handleCreateExpense} novalidate>
			<div class="field">
				<label for="exp-name">Name</label>
				<input
					id="exp-name"
					type="text"
					placeholder="e.g. Netflix"
					bind:value={expName}
					maxlength="60"
					required
				/>
			</div>

			<div class="field">
				<label for="exp-amount">Amount</label>
				<div class="amount-row">
					<span class="currency-symbol" aria-hidden="true">₹</span>
					<input
						id="exp-amount"
						type="text"
						inputmode="decimal"
						placeholder="0"
						value={expAmount}
						oninput={(e) => (expAmount = formatAmountInput(e.currentTarget.value))}
						class="money"
						required
					/>
				</div>
				{#if expAmountPaise && amountInWordsIndian(expAmountPaise)}
					<p class="amount-words">{amountInWordsIndian(expAmountPaise)}</p>
				{/if}
			</div>

			<div class="field">
				<label for="exp-category">Category</label>
				<select id="exp-category" bind:value={expCategory} required>
					<option value="">Select a category</option>
					{#each data.categories.filter((c) => !c.is_system && c.kind === 'expense') as cat}
						<option value={cat.id}>{cat.name}</option>
					{/each}
				</select>
			</div>

			<div class="field">
				<span class="field-label">Frequency</span>
				<div class="freq-pills" role="radiogroup" aria-label="Frequency">
					{#each FREQUENCIES as f}
						<button
							type="button"
							class="freq-pill"
							class:selected={expFrequency === f.value}
							onclick={() => (expFrequency = f.value)}
							aria-pressed={expFrequency === f.value}
						>{f.label}</button>
					{/each}
				</div>
			</div>

			<div class="field">
				<label for="exp-due-time">Time of day (optional)</label>
				<input id="exp-due-time" type="time" bind:value={expDueTime} />
				<p class="field-hint">Post the transaction at this time (IST). Leave blank to post on dashboard open.</p>
			</div>

			<div class="field">
				<label for="exp-end-date">Expires on (optional)</label>
				<input id="exp-end-date" type="date" bind:value={expEndDate} />
				<p class="field-hint">Stop auto-logging after this date</p>
			</div>

			<button
				type="submit"
				class="submit-btn"
				disabled={expSubmitting || !expName.trim() || !expAmountPaise || !expCategory}
			>
				{#if expSubmitting}<Spinner size={18} label="Adding" />{:else}Add expense{/if}
			</button>
		</form>
	</section>

	<!-- Recurring income: forecast only, confirmed at Harbour -->
	<section class="income-section">
		<h2 class="form-head">Recurring income</h2>
		<p class="page-sub">
			Salary and other income Keel expects each cycle. Forecast only: you confirm it at Harbour.
		</p>

		{#if incError}
			<p class="error" role="alert">{incError}</p>
		{/if}

		{#if visibleIncome.length > 0}
			<ul class="obligation-list" aria-label="Recurring income">
				{#each visibleIncome as inc (inc.id)}
					<li class="obligation-row">
						<span class="obligation-main">
							<span class="obligation-name">{inc.name}</span>
							<span class="obligation-meta">
								{anchorLabel(inc)} · next {formatDisplayDate(nextPayDate(inc))}
							</span>
						</span>
						<span class="money obligation-amount money--income"
							>+{formatPaiseLedger(inc.amount_paise)}</span
						>
						<button
							class="edit-btn"
							onclick={() => openEditIncome(inc)}
							disabled={incBusyId === inc.id}
							aria-label="Edit {inc.name}"
						>
							<Edit2 size={16} aria-hidden="true" />
						</button>
						<button
							class="delete-btn"
							onclick={() => deleteIncome(inc.id)}
							disabled={incBusyId === inc.id}
							aria-label="Delete {inc.name}"
						>
							<Trash2 size={16} aria-hidden="true" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		<form class="add-form" onsubmit={handleCreateIncome} novalidate>
			<div class="field">
				<label for="inc-name">Name</label>
				<input
					id="inc-name"
					type="text"
					placeholder="e.g. Salary"
					bind:value={incName}
					maxlength="60"
					required
				/>
			</div>

			<div class="field">
				<label for="inc-amount">Amount</label>
				<div class="amount-row">
					<span class="currency-symbol" aria-hidden="true">₹</span>
					<input
						id="inc-amount"
						type="text"
						inputmode="decimal"
						placeholder="0"
						value={incAmount}
						oninput={(e) => (incAmount = formatAmountInput(e.currentTarget.value))}
						class="money"
						required
					/>
				</div>
				{#if incAmountPaise && amountInWordsIndian(incAmountPaise)}
					<p class="amount-words">{amountInWordsIndian(incAmountPaise)}</p>
				{/if}
			</div>

			<div class="field">
				<label for="inc-anchor">When it arrives</label>
				<select id="inc-anchor" bind:value={incAnchorKind}>
					<option value="end_of_month">End of month</option>
					<option value="start_of_month">Start of month</option>
					<option value="day_of_month">A specific day</option>
				</select>
				{#if incAnchorKind === 'end_of_month'}
					<p class="field-hint">Added on the last working day of the month, skipping weekends and bank holidays.</p>
				{:else if incAnchorKind === 'start_of_month'}
					<p class="field-hint">Added on the first working day of the month, skipping weekends and bank holidays.</p>
				{:else}
					<p class="field-hint">Added on day {incAnchorDay} of the month, or the working day before if that is a weekend or holiday.</p>
				{/if}
			</div>

			{#if incAnchorKind === 'day_of_month'}
				<div class="field">
					<label for="inc-day">Day of month</label>
					<select id="inc-day" bind:value={incAnchorDay}>
						{#each Array.from({ length: 28 }, (_, i) => i + 1) as d}
							<option value={d}>{d}</option>
						{/each}
					</select>
				</div>
			{/if}

			<div class="field">
				<label for="inc-category">Category</label>
				<select id="inc-category" bind:value={incCategory}>
					<option value="">Income</option>
					{#each data.categories.filter((c) => c.kind === 'income' && !c.is_system) as cat}
						<option value={cat.id}>{cat.name}</option>
					{/each}
				</select>
			</div>

			<div class="field">
				<label for="inc-due-time">Time of day (optional)</label>
				<input id="inc-due-time" type="time" bind:value={incDueTime} />
				<p class="field-hint">When income typically lands (IST). Affects sync timing.</p>
			</div>

			<div class="field">
				<label for="inc-end-date">Expires on (optional)</label>
				<input id="inc-end-date" type="date" bind:value={incEndDate} />
				<p class="field-hint">Stop forecasting after this date</p>
			</div>

			<button
				type="submit"
				class="submit-btn"
				disabled={incSubmitting || !incName.trim() || !incAmountPaise}
			>
				{#if incSubmitting}<Spinner size={18} label="Adding" />{:else}Add income{/if}
			</button>
		</form>
	</section>
</div>

{#if editingIncId}
	<div class="modal-overlay" onclick={() => closeEditIncome()} role="dialog" aria-modal="true" aria-label="Edit recurring income">
		<div class="modal-content" onclick={(e) => e.stopPropagation()} role="document">
			<div class="modal-header">
				<h2 class="modal-title">Edit recurring income</h2>
				<button class="modal-close" onclick={() => closeEditIncome()} aria-label="Close">
					<X size={20} aria-hidden="true" />
				</button>
			</div>

			<form class="modal-form" onsubmit={(e) => { e.preventDefault(); saveEditIncome(); }}>
				{#if incError}
					<p class="error" role="alert">{incError}</p>
				{/if}

				<div class="field">
					<label for="edit-inc-name">Name</label>
					<input
						id="edit-inc-name"
						type="text"
						bind:value={editIncName}
						maxlength="60"
						required
					/>
				</div>

				<div class="field">
					<label for="edit-inc-amount">Amount</label>
					<div class="amount-row">
						<span class="currency-symbol" aria-hidden="true">₹</span>
						<input
							id="edit-inc-amount"
							type="text"
							inputmode="decimal"
							placeholder="0"
							value={editIncAmount}
							oninput={(e) => (editIncAmount = formatAmountInput(e.currentTarget.value))}
							class="money"
						/>
					</div>
				</div>

				<div class="field">
					<span class="field-label">Frequency</span>
					<div class="freq-pills" role="radiogroup" aria-label="Frequency">
						{#each FREQUENCIES as f}
							<button
								type="button"
								class="freq-pill"
								class:selected={editIncFrequency === f.value}
								onclick={() => (editIncFrequency = f.value)}
								aria-pressed={editIncFrequency === f.value}
							>{f.label}</button>
						{/each}
					</div>
				</div>

				<div class="field">
					<label for="edit-inc-next-due">Next due date</label>
					<input
						id="edit-inc-next-due"
						type="date"
						bind:value={editIncNextDue}
					/>
					<p class="field-hint">When the next transaction should post</p>
				</div>

				<div class="field">
					<label for="edit-inc-due-time">Time of day (optional)</label>
					<input id="edit-inc-due-time" type="time" bind:value={editIncDueTime} />
					<p class="field-hint">When income lands (IST). Affects sync timing.</p>
				</div>

				<div class="field">
					<label for="edit-inc-end-date">End date (optional)</label>
					<input
						id="edit-inc-end-date"
						type="date"
						bind:value={editIncEndDate}
					/>
					<p class="field-hint">Stop creating transactions after this date</p>
				</div>

				<div class="field">
					<label for="edit-inc-limit">Occurrence limit (optional)</label>
					<input
						id="edit-inc-limit"
						type="number"
						inputmode="numeric"
						placeholder="e.g. 12"
						bind:value={editIncOccurrenceLimit}
					/>
					<p class="field-hint">Stop after this many transactions</p>
				</div>

				<div class="modal-actions">
					<button type="button" class="secondary-btn" onclick={() => closeEditIncome()}>Cancel</button>
					<button type="submit" class="submit-btn" disabled={incBusyId === editingIncId || !editIncName.trim()}>
						{#if incBusyId === editingIncId}<Spinner size={18} label="Saving" />{:else}Save{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

{#if editingExpId}
	<div class="modal-overlay" onclick={() => closeEditExpense()} role="dialog" aria-modal="true" aria-label="Edit recurring expense">
		<div class="modal-content" onclick={(e) => e.stopPropagation()} role="document">
			<div class="modal-header">
				<h2 class="modal-title">Edit recurring expense</h2>
				<button class="modal-close" onclick={() => closeEditExpense()} aria-label="Close">
					<X size={20} aria-hidden="true" />
				</button>
			</div>

			<form class="modal-form" onsubmit={(e) => { e.preventDefault(); saveEditExpense(); }}>
				{#if expError}
					<p class="error" role="alert">{expError}</p>
				{/if}

				<div class="field">
					<label for="edit-exp-name">Name</label>
					<input
						id="edit-exp-name"
						type="text"
						bind:value={editExpName}
						maxlength="60"
						required
					/>
				</div>

				<div class="field">
					<label for="edit-exp-amount">Amount</label>
					<div class="amount-row">
						<span class="currency-symbol" aria-hidden="true">₹</span>
						<input
							id="edit-exp-amount"
							type="text"
							inputmode="decimal"
							placeholder="0"
							value={editExpAmount}
							oninput={(e) => (editExpAmount = formatAmountInput(e.currentTarget.value))}
							class="money"
						/>
					</div>
				</div>

				<div class="field">
					<label for="edit-exp-category">Category</label>
					<select id="edit-exp-category" bind:value={editExpCategory}>
						<option value="">Uncategorized</option>
						{#each data.categories.filter((c) => !c.is_system && c.kind === 'expense') as cat}
							<option value={cat.id}>{cat.name}</option>
						{/each}
					</select>
				</div>

				<div class="field">
					<span class="field-label">Frequency</span>
					<div class="freq-pills" role="radiogroup" aria-label="Frequency">
						{#each FREQUENCIES as f}
							<button
								type="button"
								class="freq-pill"
								class:selected={editExpFrequency === f.value}
								onclick={() => (editExpFrequency = f.value)}
								aria-pressed={editExpFrequency === f.value}
							>{f.label}</button>
						{/each}
					</div>
				</div>

				<div class="field">
					<label for="edit-exp-next-due">Next due date</label>
					<input id="edit-exp-next-due" type="date" bind:value={editExpNextDue} />
					<p class="field-hint">When the next transaction should post</p>
				</div>

				<div class="field">
					<label for="edit-exp-due-time">Time of day (optional)</label>
					<input id="edit-exp-due-time" type="time" bind:value={editExpDueTime} />
					<p class="field-hint">Post the transaction at this time (IST).</p>
				</div>

				<div class="field">
					<label for="edit-exp-end-date">End date (optional)</label>
					<input id="edit-exp-end-date" type="date" bind:value={editExpEndDate} />
					<p class="field-hint">Stop posting after this date</p>
				</div>

				<div class="field">
					<label for="edit-exp-limit">Occurrence limit (optional)</label>
					<input
						id="edit-exp-limit"
						type="number"
						inputmode="numeric"
						placeholder="e.g. 12"
						bind:value={editExpOccurrenceLimit}
					/>
					<p class="field-hint">Stop after this many transactions</p>
				</div>

				<div class="modal-actions">
					<button type="button" class="secondary-btn" onclick={() => closeEditExpense()}>Cancel</button>
					<button type="submit" class="submit-btn" disabled={expBusyId === editingExpId || !editExpName.trim()}>
						{#if expBusyId === editingExpId}<Spinner size={18} label="Saving" />{:else}Save{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<ConfirmDialog
	open={confirmState !== null}
	title={confirmState?.title ?? ''}
	message={confirmState?.message ?? ''}
	confirmLabel="Delete"
	onconfirm={() => { const r = confirmState?.run; confirmState = null; r?.(); }}
	oncancel={() => (confirmState = null)}
/>

<style>
	.obligations-page {
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
		padding-bottom: calc(var(--space-6) + var(--nav-height));
	}

	.back-btn {
		display: inline-flex;
		align-items: center;
		color: var(--color-text-muted);
		text-decoration: none;
		min-height: var(--tap-target);
		margin-left: calc(-1 * var(--space-1));
	}
	.back-btn:hover { color: var(--color-text); }

	.page-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.page-sub {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
	}

	.due-summary {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: var(--space-4) var(--space-5);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.due-label {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
	}

	.due-amount {
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.obligation-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.obligation-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--color-border);
		min-height: var(--tap-target);
	}

	.obligation-row:last-child {
		border-bottom: none;
	}

	.obligation-row.paid .obligation-name {
		color: var(--color-text-muted);
		text-decoration: line-through;
	}

	.check-btn {
		flex: none;
		width: 28px;
		height: 28px;
		min-width: 28px;
		border: 2px solid var(--color-border);
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--color-ink);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	/* Paid = muted teal (income/positive), never gold. */
	.check-btn.checked {
		background: var(--color-positive, #2f7e72);
		border-color: var(--color-positive, #2f7e72);
		color: #fff;
	}

	.check-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.obligation-main {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}

	.obligation-name {
		font-size: 0.9375rem;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.obligation-meta {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
		text-transform: capitalize;
	}

	.obligation-amount {
		flex: none;
		font-size: 0.9375rem;
		font-weight: 600;
	}

	.delete-btn {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--tap-target);
		height: var(--tap-target);
		min-width: var(--tap-target);
		border: none;
		background: transparent;
		color: var(--color-text-subtle);
		border-radius: var(--radius-full);
		cursor: pointer;
		opacity: 0.5;
		transition:
			opacity var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.delete-btn:hover {
		opacity: 1;
		color: var(--color-clay);
	}

	.edit-btn {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--tap-target);
		height: var(--tap-target);
		min-width: var(--tap-target);
		border: none;
		background: transparent;
		color: var(--color-text-subtle);
		border-radius: var(--radius-full);
		cursor: pointer;
		opacity: 0.5;
		transition:
			opacity var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.edit-btn:hover {
		opacity: 1;
		color: var(--color-text);
	}

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: flex-end;
		z-index: 1000;
	}

	.modal-content {
		width: 100%;
		max-width: 500px;
		background: var(--color-surface);
		border-top: 1px solid var(--color-border);
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		max-height: 90vh;
		overflow-y: auto;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-3);
	}

	.modal-title {
		font-size: 1.125rem;
		font-weight: 600;
	}

	.modal-close {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--tap-target);
		height: var(--tap-target);
		border: none;
		background: transparent;
		color: var(--color-text-subtle);
		border-radius: var(--radius-full);
		cursor: pointer;
		transition: color var(--duration-fast) var(--ease-out);
	}

	.modal-close:hover {
		color: var(--color-text);
	}

	.modal-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.modal-actions {
		display: flex;
		gap: var(--space-3);
		margin-top: var(--space-2);
	}

	.modal-actions button {
		flex: 1;
	}

	.add-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-top: var(--space-2);
	}

	.form-head {
		font-size: 1rem;
		font-weight: 600;
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

	.field input,
	.field select {
		height: 44px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: var(--color-surface);
		font-size: 1rem;
		color: var(--color-text);
	}

	.field input:focus,
	.field select:focus {
		outline: none;
		border-color: var(--color-gold);
	}

	.amount-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.amount-row input {
		flex: 1;
	}

	.currency-symbol {
		font-family: var(--font-display);
		font-size: 1.25rem;
		color: var(--color-text-muted);
	}

	.submit-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 48px;
		background: var(--color-gold);
		color: var(--color-ink);
		font-weight: 700;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
	}

	.submit-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.error {
		color: var(--color-clay);
		font-size: 0.875rem;
	}

	.income-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-border);
	}

	.field-hint {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
	}

	.amount-words {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
		margin-top: calc(var(--space-2) * -1);
	}

	/* room for the global select chevron */
	.field select {
		padding-right: var(--space-8);
	}

	.secondary-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 48px;
		background: transparent;
		color: var(--color-text);
		font-weight: 600;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: border-color var(--duration-fast) var(--ease-out);
	}

	.secondary-btn:hover { border-color: var(--color-text-subtle); }
	.secondary-btn:disabled { opacity: 0.4; cursor: not-allowed; }

	.freq-pills {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.freq-pill {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.freq-pill:hover {
		border-color: var(--color-text-subtle);
		color: var(--color-text);
	}

	.freq-pill.selected {
		background: var(--color-gold);
		border-color: var(--color-gold);
		color: var(--color-ink);
		font-weight: 600;
	}

	.field-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}
</style>
