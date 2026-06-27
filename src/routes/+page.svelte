<script lang="ts">
	import { Plus, Trash2, Anchor, ChevronRight, ChevronDown } from 'lucide-svelte';
	import { invalidateAll } from '$app/navigation';
	import AddTransactionSheet from '$lib/components/AddTransactionSheet.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import HelpTip from '$lib/components/HelpTip.svelte';
	import OnboardingTour from '$lib/components/OnboardingTour.svelte';
	import { formatPaise, formatPaiseLedger, parseToPaise, formatAmountInput } from '$lib/utils/money';
	import { formatDisplayDate, formatIstTime } from '$lib/utils/date';
	import { enqueueTransaction } from '$lib/utils/offline-queue';
	import { toast } from '$lib/stores/toast';
	import type { PageData } from './$types';
	import type { TransactionDraft, Transaction, ReconciliationPeriod, RunwaySummary } from '$lib/types';

	function runwayDays(r: RunwaySummary): { low: number; high: number } | null {
		const values = [r.days_30, r.days_7].filter((v): v is number => v !== null);
		if (values.length === 0) return null;
		return { low: Math.min(...values), high: Math.max(...values) };
	}

	function formatRunwayDays(n: number): string {
		if (n >= 365) return '1yr+';
		if (n >= 180) return '6mo+';
		if (n >= 90) return '3mo+';
		return `${n}`;
	}

	function runwayLabel(r: RunwaySummary): string {
		const range = runwayDays(r);
		if (!range) return '';
		const { low, high } = range;
		if (high - low <= 5) return `~${formatRunwayDays(low)} days`;
		return `${formatRunwayDays(low)}–${formatRunwayDays(high)} days`;
	}

	function runwayExtra(r: RunwaySummary): number | null {
		const range = runwayDays(r);
		if (!range) return null;
		if (r.days_committed === null) return null;
		const extra = r.days_committed - range.low;
		return extra > 1 ? extra : null;
	}

	let { data }: { data: PageData } = $props();

	let sheetOpen = $state(false);
	let essentialsOpen = $state(false);
	let editingTx = $state<Transaction | null>(null);
	// Starting-balance nudge (for users who skipped first-run setup).
	let balanceNudge = $state('');
	let savingBalance = $state(false);
	// Entries hidden during the undo window, before their delete commits.
	let hiddenIds = $state<string[]>([]);
	// Show attribution and time only when the household has more than one member.
	let isShared = $derived(Object.keys(data.memberEmails ?? {}).length > 1);

	function periodRange(p: ReconciliationPeriod): string {
		return `${formatDisplayDate(p.period_start)} to ${formatDisplayDate(p.period_end)}`;
	}

	async function handleSubmit(draft: Required<TransactionDraft>): Promise<void> {
		if (editingTx) {
			const res = await fetch(`/api/transactions/${editingTx.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					amount_paise: Math.abs(draft.amount_paise!),
					category_id: draft.category_id,
					description: draft.description,
					note: draft.note,
					occurred_at: draft.occurred_at
				})
			});
			if (!res.ok) throw new Error('Update failed');
			editingTx = null;
			await invalidateAll();
		} else {
			const payload = {
				category_id: draft.category_id || undefined,
				amount_paise: draft.amount_paise,
				description: draft.description,
				note: draft.note,
				occurred_at: draft.occurred_at,
				source: 'tap'
			};
			if (!navigator.onLine) {
				// Queue for later; the OfflineBanner flushes on reconnect.
				await enqueueTransaction(payload);
				return;
			}
			const res = await fetch('/api/transactions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) throw new Error('Save failed');
			await invalidateAll();
		}
	}

	function commitDelete(id: string): void {
		// Soft-delete on the server, then refresh. Runs after the undo window closes.
		fetch(`/api/transactions/${id}`, { method: 'DELETE' })
			.then((res) => (res.ok ? invalidateAll() : undefined))
			.finally(() => {
				hiddenIds = hiddenIds.filter((x) => x !== id);
			});
	}

	async function saveStartingBalance(): Promise<void> {
		const paise = parseToPaise(balanceNudge);
		if (paise === null) return;
		savingBalance = true;
		const res = await fetch('/api/account', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ balance_paise: paise })
		});
		savingBalance = false;
		if (res.ok) {
			balanceNudge = '';
			await invalidateAll();
		}
	}

	function handleDelete(id: string): void {
		// Hide optimistically; commit after the undo window, or restore on undo.
		hiddenIds = [...hiddenIds, id];
		toast.show({
			message: 'Entry deleted',
			actionLabel: 'Undo',
			onAction: () => {
				hiddenIds = hiddenIds.filter((x) => x !== id);
			},
			onExpire: () => commitDelete(id),
			duration: 5000
		});
	}

	// Cache the resolved dashboard data. Rendering from this (instead of awaiting
	// the streamed promises directly) means a background refresh after a delete
	// updates the numbers in place, with no skeleton flash.
	let view = $state<{
		summary: Awaited<PageData['summary']>;
		transactions: Awaited<PageData['transactions']>;
		categories: Awaited<PageData['categories']>;
		runway: Awaited<PageData['runway']>;
	} | null>(null);
	let loadError = $state(false);

	$effect(() => {
		Promise.all([data.summary, data.transactions, data.categories, data.runway])
			.then(([summary, transactions, categories, runway]) => {
				view = { summary, transactions, categories, runway };
				loadError = false;
			})
			.catch(() => {
				loadError = true;
			});
	});
</script>

<svelte:head>
	<title>Dashboard - Keel</title>
</svelte:head>

{#if view}
	{@const summary = view.summary}
	{@const transactions = view.transactions}
	{@const categories = view.categories}
	{@const runway = view.runway}
	{@const catById = new Map(categories.map((c) => [c.id, c]))}
	{@const reservedEssentials = categories
		.filter((c) => c.bucket === 'committed' && c.daily_reserve_paise > 0)
		.sort((a, b) => b.daily_reserve_paise - a.daily_reserve_paise)}
	{@const visibleTransactions = transactions.filter((t) => !hiddenIds.includes(t.id))}
		{@const showBalanceNudge = !!summary && summary.balance_paise === 0 && transactions.length === 0 && summary.harbour_visits === 0}

	<div class="dashboard">
		<!-- Hero: what is actually safe to spend, after obligations and essentials -->
		<section class="hero" aria-label="Safe to spend">
			<p class="hero-label">Safe to spend</p>
			<p
				class="money-hero"
				class:over-committed={(summary?.safe_to_spend_paise ?? 0) < 0}
				aria-live="polite"
				aria-atomic="true"
			>
				{formatPaise(summary?.safe_to_spend_paise ?? 0)}
			</p>
			<p class="hero-sub">
				{#if summary}
					{#if summary.safe_to_spend_paise < 0}
						Over by {formatPaise(Math.abs(summary.safe_to_spend_paise))} until {formatDisplayDate(summary.current_period.period_end)}.
					{:else}
						Free to spend before your next harbour · {periodRange(summary.current_period)}
					{/if}
				{/if}
			</p>
		</section>

		<!-- Starting-balance nudge: only when nothing is set yet (skipped setup). -->
		{#if showBalanceNudge}
			<section class="balance-nudge" aria-label="Set your starting balance">
				<p class="bn-title">Set your starting balance</p>
				<p class="bn-sub">Tell Keel what's in your account so "safe to spend" is real.</p>
				<div class="bn-row">
					<span class="bn-currency" aria-hidden="true">₹</span>
					<label for="bn-input" class="sr-only">Starting balance in rupees</label>
					<input
						id="bn-input"
						type="text"
						inputmode="decimal"
						placeholder="0"
						value={balanceNudge}
						oninput={(e) => (balanceNudge = formatAmountInput(e.currentTarget.value))}
						class="bn-input money"
						autocomplete="off"
					/>
					<button class="bn-set" onclick={saveStartingBalance} disabled={savingBalance || !parseToPaise(balanceNudge)}>
						{savingBalance ? 'Saving…' : 'Set'}
					</button>
				</div>
			</section>
		{/if}

		<!-- The breakdown: how safe-to-spend is derived. Calm, never scolding. -->
		{#if summary && (summary.locked_obligations_paise > 0 || summary.locked_reserve_paise > 0)}
			<section class="breakdown" aria-label="How safe to spend is calculated">
				<div class="breakdown-row">
					<span class="breakdown-label">Remaining this period</span>
					<span class="money breakdown-amount">{formatPaiseLedger(summary.remaining_paise)}</span>
				</div>
				{#if summary.locked_obligations_paise > 0}
					<a class="breakdown-row breakdown-row--link" href="/obligations">
						<span class="breakdown-label">Obligations still due</span>
						<span class="money breakdown-amount muted"
							>−{formatPaiseLedger(summary.locked_obligations_paise)}</span
						>
					</a>
				{/if}
				{#if summary.locked_reserve_paise > 0}
					<div class="breakdown-row">
						<button
							class="breakdown-label breakdown-toggle"
							class:open={essentialsOpen}
							onclick={() => (essentialsOpen = !essentialsOpen)}
							aria-expanded={essentialsOpen}
							aria-controls="essentials-list"
							disabled={reservedEssentials.length === 0}
						>
							<span class="toggle-head">
								Reserved for essentials
								{#if reservedEssentials.length > 0}
									<span class="toggle-chevron" aria-hidden="true">
										{#if essentialsOpen}<ChevronDown size={14} />{:else}<ChevronRight size={14} />{/if}
									</span>
								{/if}
							</span>
							<span class="breakdown-note">
								{formatPaise(summary.daily_reserve_paise)}/day for
								{summary.days_remaining}
								{summary.days_remaining === 1 ? 'day' : 'days'} left this cycle
							</span>
						</button>
						<span class="money breakdown-amount muted"
							>−{formatPaiseLedger(summary.locked_reserve_paise)}</span
						>
					</div>
					{#if essentialsOpen && reservedEssentials.length > 0}
						<ul class="essentials-list" id="essentials-list">
							{#each reservedEssentials as ess (ess.id)}
								<li class="essential-row">
									<span class="essential-name">{ess.name}</span>
									<span class="money essential-amount"
										>{formatPaise(ess.daily_reserve_paise)}/day</span
									>
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
				<div class="breakdown-row breakdown-total">
					<span class="breakdown-label">Safe to spend</span>
					<span class="money breakdown-amount total-amount"
						>{formatPaiseLedger(summary.safe_to_spend_paise)}</span
					>
				</div>
			</section>
		{/if}

		<!-- Runway: balance ÷ trailing burn, forward-looking safety signal (not guilt). -->
		{#if runway?.has_data}
			{@const label = runwayLabel(runway!)}
			{@const extra = runwayExtra(runway!)}
			<section class="runway-card" aria-label="Runway estimate">
				<p class="runway-label">
					Runway
					<HelpTip
					term="Runway"
					text="How long your money would last if you keep spending at your recent pace: your balance divided by your average daily spend. A calm gauge, not a deadline."
				/>
				</p>
				<p class="runway-days">{label}</p>
				{#if extra !== null}
					<p class="runway-extra">+{formatRunwayDays(extra)} days if you cut discretionary</p>
				{/if}
			</section>
		{/if}

		<!-- Harbour open-loop pull (Zeigarnik, not guilt). Shown once there is something to settle. -->
		{#if transactions.length > 0}
			<a href="/harbour" class="harbour-nudge" aria-label="Come to harbour, about two minutes">
				<span class="harbour-disc" aria-hidden="true">
					<Anchor size={18} />
				</span>
				<span class="harbour-text">
					<span class="harbour-title">Come to harbour</span>
					<span class="harbour-sub">Settle this cycle · about 2 min</span>
				</span>
				<ChevronRight class="harbour-chevron" size={20} aria-hidden="true" />
			</a>
		{/if}

		<!-- Recent transactions -->
		<section class="ledger-section">
			<div class="ledger-header">
				<h2 class="section-head">Recent</h2>
				<a href="/transactions" class="see-all-link">See all</a>
			</div>

			{#if visibleTransactions.length === 0}
				<EmptyState heading="No entries yet" body="Add your first expense below." />
			{:else}
				<ul class="ledger">
					{#each visibleTransactions as tx (tx.id)}
						{@const cat = catById.get(tx.category_id)}
						{@const income = tx.amount_paise >= 0}
						{@const uncategorized = cat?.name === 'Uncategorized' || tx.is_uncategorized_fallback === 1}
						{@const enteredByName = tx.entered_by ? (tx.entered_by === data.currentUserId ? 'You' : (data.memberNames[tx.entered_by] ?? (data.memberEmails[tx.entered_by] ?? '').split('@')[0])) : ''}
						{@const enteredByAvatar = tx.entered_by ? (data.memberAvatars[tx.entered_by] ?? '') : ''}
						<li class="ledger-row">
							<button
								class="row-tap"
								onclick={() => { editingTx = tx; sheetOpen = true; }}
								aria-label="Edit {tx.description || 'entry'}"
							>
								<span class="ledger-main">
									<span class="ledger-desc">{tx.description || cat?.name || 'Expense'}</span>
									<span class="ledger-meta">
										{#if uncategorized}
											<span class="uncat-dot" aria-hidden="true"></span>
										{/if}
										{#if tx.description}
											<span class="ledger-cat">{cat?.name ?? 'Uncategorized'}</span>
											<span class="meta-sep" aria-hidden="true">·</span>
										{/if}
										<span class="ledger-date">{formatDisplayDate(tx.occurred_at)}</span>
										<span class="meta-sep" aria-hidden="true">·</span>
										<span class="ledger-time">{formatIstTime(tx.entered_at)}</span>
									</span>
									{#if tx.note}
										<span class="ledger-note">{tx.note}</span>
									{/if}
									{#if isShared && enteredByName}
										<span class="ledger-by" aria-label="Added by {enteredByName}">
											<span class="by-avatar" aria-hidden="true">
												{#if enteredByAvatar}<img src={enteredByAvatar} alt="" class="by-avatar-img" />{:else}{enteredByName.charAt(0).toUpperCase()}{/if}
											</span>
											<span class="by-name">{enteredByName}</span>
										</span>
									{/if}
								</span>
								<span class="money ledger-amount {income ? 'money--income' : 'money--expense'}">
									{income ? '+' : ''}{formatPaiseLedger(Math.abs(tx.amount_paise))}
								</span>
							</button>
							<button
								class="row-delete"
								onclick={() => handleDelete(tx.id)}
								aria-label="Delete {tx.description || 'entry'}"
							>
								<Trash2 size={16} aria-hidden="true" />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- FAB: add transaction -->
		<button class="fab" onclick={() => (sheetOpen = true)} aria-label="Add expense">
			<Plus size={24} aria-hidden="true" />
		</button>
	</div>

	<AddTransactionSheet
		open={sheetOpen}
		{categories}
		{editingTx}
		{isShared}
		onclose={() => { sheetOpen = false; editingTx = null; }}
		onsubmit={handleSubmit}
	/>

	<OnboardingTour />
{:else if loadError}
	<div class="dashboard">
		<p class="load-error">
			Couldn't load your data.
			<button class="retry-btn" onclick={() => invalidateAll()}>Retry</button>
		</p>
	</div>
{:else}
	<div class="dashboard">
		<section class="hero" aria-hidden="true">
			<div class="skel skel-label"></div>
			<div class="skel skel-hero"></div>
			<div class="skel skel-sub"></div>
		</section>
		<div class="runway-card" aria-hidden="true">
			<div class="skel skel-label" style="width:60px"></div>
			<div class="skel" style="height:28px;width:120px;margin-top:4px"></div>
		</div>
		<section class="ledger-section">
			<div class="skel skel-section-head"></div>
			{#each [1, 2, 3] as _}
				<div class="skel skel-ledger-row"></div>
			{/each}
		</section>
	</div>
{/if}

<style>
	.dashboard {
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	/* Desktop and tablet: a single calm, centred column (a wider version of the
	   mobile layout) instead of a fragile two-column grid that broke when an
	   optional section was present. Robust at every width. */
	@media (min-width: 768px) {
		.dashboard {
			max-width: 600px;
			margin: 0 auto;
			padding: var(--space-8);
		}
	}

	.hero {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-6) 0;
	}

	.hero-label {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.hero-sub {
		font-size: 0.875rem;
		color: var(--color-text-subtle);
		min-height: 1.2em;
	}

	/* Over-committed is a genuine attention state: clay, never red alarm. */
	.money-hero.over-committed {
		color: var(--color-clay);
	}

	/* Starting-balance nudge */
	.balance-nudge {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-5);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.bn-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.bn-sub {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.bn-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-1);
	}

	.bn-currency {
		font-family: var(--font-display);
		font-size: 1.25rem;
		color: var(--color-text-muted);
	}

	.bn-input {
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

	.bn-input:focus {
		outline: none;
		border-color: var(--color-gold);
	}

	.bn-set {
		flex: none;
		height: 44px;
		padding: 0 var(--space-5);
		background: var(--color-text);
		color: var(--color-surface);
		font-weight: 600;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-family: inherit;
	}

	.bn-set:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.breakdown {
		display: flex;
		flex-direction: column;
		padding: var(--space-4) var(--space-5);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.breakdown-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-2) 0;
	}

	.breakdown-label {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		display: flex;
		flex-direction: column;
	}

	.breakdown-note {
		font-size: 0.75rem;
		color: var(--color-text-subtle);
	}

	.breakdown-amount {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
		white-space: nowrap;
	}

	.breakdown-amount.muted {
		color: var(--color-text-muted);
		font-weight: 500;
	}

	/* Tappable breakdown row: surfaces the Obligations page where its number lives. */
	.breakdown-row--link {
		text-decoration: none;
		color: inherit;
		margin: 0 calc(var(--space-2) * -1);
		padding-left: var(--space-2);
		padding-right: var(--space-2);
		border-radius: var(--radius-sm);
		transition: background var(--duration-fast) var(--ease-out);
	}

	.breakdown-row--link:hover {
		background: var(--color-surface);
	}

	/* Expandable "Reserved for essentials" toggle */
	.breakdown-toggle {
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		text-align: left;
		cursor: pointer;
		font: inherit;
		color: var(--color-text-muted);
	}

	.breakdown-toggle:disabled {
		cursor: default;
	}

	.toggle-head {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-size: 0.9375rem;
	}

	.toggle-chevron {
		display: inline-flex;
		color: var(--color-text-subtle);
	}

	.essentials-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin: 0 0 var(--space-2) var(--space-3);
		padding: var(--space-2) 0 var(--space-1) var(--space-3);
		border-left: 2px solid var(--color-border);
	}

	.essential-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-4);
	}

	.essential-name {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.essential-amount {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
		white-space: nowrap;
	}

	/* The answer dominates: Fraunces, larger, full ink. */
	.breakdown-total {
		margin-top: var(--space-2);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border);
		align-items: center;
	}

	.breakdown-total .breakdown-label {
		font-size: 1.0625rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.breakdown-amount.total-amount {
		font-family: var(--font-display);
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--color-text);
	}

	/* Runway: compact forward signal. Calm, not loud. */
	.runway-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-4) var(--space-5);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.runway-label {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-text-subtle);
	}

	.runway-days {
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-text);
		font-variant-numeric: tabular-nums lining-nums;
		line-height: 1.1;
	}

	.runway-extra {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin-top: var(--space-1);
	}

	/* Harbour: the open-loop invitation. Icon disc, two lines, chevron. Not gold. */
	.harbour-nudge {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		text-decoration: none;
		min-height: var(--tap-target);
		transition:
			border-color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.harbour-nudge:hover {
		border-color: var(--color-text-subtle);
	}

	.harbour-nudge:active {
		transform: scale(0.99);
	}

	.harbour-disc {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-full);
		background: var(--color-surface-subtle);
		color: var(--color-text);
	}

	.harbour-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
		min-width: 0;
	}

	.harbour-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.harbour-sub {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.harbour-nudge :global(.harbour-chevron) {
		flex: none;
		color: var(--color-text-subtle);
	}

	.ledger-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.ledger {
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.ledger-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-border);
	}

	/* Tappable area spanning description + amount. Invisible button wrapper. */
	.row-tap {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex: 1;
		min-width: 0;
		background: none;
		border: none;
		padding: 0;
		text-align: left;
		cursor: pointer;
		color: inherit;
		font: inherit;
	}

	.ledger-main {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}

	.ledger-desc {
		font-size: 0.9375rem;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ledger-meta {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
	}

	/* The one meaningful dot: gold = uncategorized, settle it at Harbour. */
	.uncat-dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		background: var(--color-gold);
	}

	.ledger-cat {
		color: var(--color-text-muted);
	}

	.ledger-note {
		display: block;
		font-size: 0.75rem;
		color: var(--color-text-subtle);
		margin-top: 2px;
		font-style: italic;
	}

	/* Attribution on its own calm line, not crammed into the meta. */
	.ledger-by {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: 4px;
		font-size: 0.75rem;
		color: var(--color-text-subtle);
	}

	.by-name {
		line-height: 1;
	}

	.by-avatar {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--color-text) 12%, transparent);
		color: var(--color-text-muted);
		font-size: 0.625rem;
		font-weight: 600;
		overflow: hidden;
		text-transform: uppercase;
	}

	.by-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.ledger-time {
		font-size: 0.75rem;
		color: var(--color-text-subtle);
		font-variant-numeric: tabular-nums;
	}

	.meta-sep {
		color: var(--color-text-subtle);
	}

	.ledger-amount {
		flex: none;
		font-size: 0.9375rem;
		font-weight: 600;
	}

	/* Subtle, low-emphasis delete. 44px tap target, muted until hover. */
	.row-delete {
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

	.row-delete:hover {
		opacity: 1;
		color: var(--color-clay);
	}

	/* FAB: gold, bottom-right above nav */
	.fab {
		position: fixed;
		bottom: calc(var(--nav-height) + var(--space-4));
		right: var(--space-6);
		width: 56px;
		height: 56px;
		min-width: 56px;
		border-radius: var(--radius-full);
		background: var(--color-gold);
		color: var(--color-ink);
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 4px 16px rgba(224, 168, 46, 0.35);
		transition:
			transform var(--duration-fast) var(--ease-out),
			box-shadow var(--duration-fast) var(--ease-out);
		z-index: var(--z-overlay);
	}

	.fab:active {
		transform: scale(0.95);
		box-shadow: 0 2px 8px rgba(224, 168, 46, 0.25);
	}

	/* Skeleton loading state */
	.skel {
		background: var(--color-surface-subtle);
		border-radius: var(--radius-sm);
		animation: skel-pulse 1.4s ease-in-out infinite;
	}

	@keyframes skel-pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.skel-label {
		height: 14px;
		width: 100px;
		margin-bottom: var(--space-2);
	}

	.skel-hero {
		height: 48px;
		width: 180px;
		margin-bottom: var(--space-2);
	}

	.skel-sub {
		height: 14px;
		width: 240px;
	}

	.skel-section-head {
		height: 18px;
		width: 80px;
	}

	.skel-ledger-row {
		height: 48px;
		width: 100%;
		margin-top: var(--space-2);
	}

	/* Error state */
	.load-error {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-6) 0;
	}

	.retry-btn {
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: var(--space-1) var(--space-3);
		font-size: 0.875rem;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.retry-btn:hover {
		border-color: var(--color-text-subtle);
		color: var(--color-text);
	}

	.ledger-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.see-all-link {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		text-decoration: none;
	}

	.see-all-link:hover {
		color: var(--color-text);
	}
</style>
