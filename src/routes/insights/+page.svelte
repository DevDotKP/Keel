<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { parseToPaise, formatPaiseLedger } from '$lib/utils/money';
	import { formatDisplayDate } from '$lib/utils/date';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Cycle target inline edit
	let editingTarget = $state(false);
	let targetValue = $state('');
	let busy = $state(false);

	async function saveTarget() {
		busy = true;
		const paise = parseToPaise(targetValue) ?? 0;
		const res = await fetch('/api/settings', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ cycle_budget_paise: paise })
		});
		busy = false;
		editingTarget = false;
		if (res.ok) await invalidateAll();
	}

	function pct(part: number, total: number): number {
		if (total <= 0) return 0;
		return Math.round((part / total) * 100);
	}

	function uncatRatio(insights: Awaited<NonNullable<typeof data.insights>>): number {
		if (insights.total_expense_paise <= 0) return 0;
		return pct(insights.uncategorized_paise, insights.total_expense_paise);
	}
</script>

<svelte:head>
	<title>Insights - Keel</title>
</svelte:head>

{#await data.insights}
	<div class="insights-page">
		<div class="skel skel-label" style="width:90px"></div>
		<div class="skel skel-sub" style="width:160px"></div>
		<div class="skel" style="height:80px;border-radius:var(--radius-md);margin-top:var(--space-4)"></div>
		<div class="skel skel-label" style="width:100px;margin-top:var(--space-6)"></div>
		{#each [1, 2, 3, 4] as _}
			<div class="skel" style="height:40px;margin-top:var(--space-2);border-radius:var(--radius-sm)"></div>
		{/each}
	</div>
{:then insights}
	{#if !insights || insights.total_expense_paise === 0}
		<div class="insights-page">
			<h1 class="section-head">Insights</h1>
			<EmptyState heading="Nothing to show yet" body="Add a few expenses to see where your money goes." />
		</div>
	{:else}
		{@const total = insights.total_expense_paise}
		{@const committedPct = pct(insights.committed_paise, total)}
		{@const flexiblePct = pct(insights.flexible_paise, total)}
		{@const uncatPct = uncatRatio(insights)}
		<div class="insights-page">
			<header class="page-header">
				<h1 class="section-head">Insights</h1>
				<p class="page-sub">
					{formatDisplayDate(insights.period_start)} to {formatDisplayDate(insights.period_end)}
				</p>
			</header>

			<div class="insights-grid">
				<!-- Left column: summary cards -->
				<div class="insights-col">
					<!-- Cycle target: optional spending goal, inline edit -->
					<section class="target-card" aria-label="Cycle spending target">
						<div class="target-head">
							{#if editingTarget}
								<span class="target-edit-row">
									<span class="currency-hint" aria-hidden="true">₹</span>
									<input
										type="text"
										inputmode="decimal"
										class="target-input money"
										bind:value={targetValue}
										placeholder="spending target"
										aria-label="Overall cycle spending target"
									/>
									<button class="save-btn" onclick={saveTarget} disabled={busy}>Save</button>
									<button class="cancel-btn" onclick={() => (editingTarget = false)}>Cancel</button>
								</span>
							{:else}
								<button
									class="target-total"
									onclick={() => {
										targetValue = insights.cycle_budget_paise
											? (insights.cycle_budget_paise / 100).toString()
											: '';
										editingTarget = true;
									}}
									aria-label="Edit cycle spending target"
								>
									<span class="total-number money">{formatPaiseLedger(total)}</span>
									{#if insights.cycle_budget_paise > 0}
										<span class="total-sub">of {formatPaiseLedger(insights.cycle_budget_paise)} target</span>
									{:else}
										<span class="total-sub total-sub--set">Set a cycle target</span>
									{/if}
								</button>
							{/if}
						</div>
						{#if insights.cycle_budget_paise > 0}
							{@const over = total > insights.cycle_budget_paise}
							<div class="prog-track" aria-hidden="true">
								<div
									class="prog-fill"
									class:prog-fill--over={over}
									style="width:{Math.min(100, pct(total, insights.cycle_budget_paise))}%"
								></div>
							</div>
							{#if over}
								<p class="over-note">{formatPaiseLedger(total - insights.cycle_budget_paise)} over target this cycle.</p>
							{/if}
						{/if}
					</section>

					<!-- Committed / flexible split -->
					{#if insights.committed_paise + insights.flexible_paise > 0}
						<section class="split-card" aria-label="Committed and flexible spend">
							<div class="split-labels">
								<span class="split-col">
									<span class="split-kind">Committed</span>
									<span class="split-amount money">{formatPaiseLedger(insights.committed_paise)}</span>
									<span class="split-pct">{committedPct}%</span>
								</span>
								<span class="split-col split-col--right">
									<span class="split-kind">Flexible</span>
									<span class="split-amount money">{formatPaiseLedger(insights.flexible_paise)}</span>
									<span class="split-pct">{flexiblePct}%</span>
								</span>
							</div>
							<div class="split-bar" aria-hidden="true">
								{#if committedPct > 0}
									<span class="split-seg split-seg--committed" style="width:{committedPct}%"></span>
								{/if}
								{#if flexiblePct > 0}
									<span class="split-seg split-seg--flexible" style="width:{flexiblePct}%"></span>
								{/if}
								{#if uncatPct > 0}
									<span class="split-seg split-seg--uncat" style="width:{uncatPct}%"></span>
								{/if}
							</div>
						</section>
					{/if}

					<!-- Data quality signal -->
					{#if uncatPct > 0}
						<section class="quality-card" aria-label="Data quality">
							<p class="quality-line">
								{#if uncatPct >= 25}
									{uncatPct}% of this period is uncategorized. Come to harbour to sort it.
								{:else}
									{uncatPct}% uncategorized this period.
								{/if}
							</p>
							{#if uncatPct >= 10}
								<a href="/harbour" class="quality-link">Come to harbour</a>
							{/if}
						</section>
					{/if}

					<!-- Recent periods -->
					{#if insights.recent_periods.length > 0}
						<section class="history-section" aria-label="Recent periods">
							<h2 class="group-head">Recent periods</h2>
							<ul class="history-list">
								{#each insights.recent_periods as p (p.period_start)}
									{@const ratio = pct(p.uncategorized_paise, p.total_expense_paise)}
									<li class="history-row">
										<span class="history-range">
											{formatDisplayDate(p.period_start)} to {formatDisplayDate(p.period_end)}
										</span>
										<span class="history-right">
											<span class="history-amount money">{formatPaiseLedger(p.total_expense_paise)}</span>
											{#if ratio > 0}
												<span class="history-uncat">{ratio}% uncat</span>
											{/if}
										</span>
									</li>
								{/each}
							</ul>
						</section>

						<!-- Drift trend: "your picture is getting clearer" -->
						{@const driftData = [...insights.recent_periods].reverse()}
						{@const maxDrift = Math.max(...driftData.map(p => p.drift_paise), 1)}
						{@const hasAnyDrift = driftData.some(p => p.drift_paise > 0)}
						{@const latestDrift = insights.recent_periods[0]?.drift_paise ?? 0}
						{@const prevDrift = insights.recent_periods[1]?.drift_paise ?? 0}
						{@const improving = insights.recent_periods.length >= 2 && latestDrift < prevDrift}
						{#if insights.recent_periods.length >= 2}
							<section class="drift-trend" aria-label="Tracking quality trend">
								<div class="drift-head">
									<h2 class="group-head">Tracking quality</h2>
									{#if improving}
										<span class="drift-badge drift-badge--improving">Getting clearer</span>
									{:else if latestDrift === 0}
										<span class="drift-badge drift-badge--perfect">Spot on</span>
									{/if}
								</div>
								<p class="drift-sub">
									{#if !hasAnyDrift}
										No drift in any recent period. Perfect tracking.
									{:else if improving}
										Your harbour adjustments are shrinking. The picture is getting clearer.
									{:else}
										Harbour adjustment per period. Smaller is better.
									{/if}
								</p>
								<div class="drift-chart" aria-hidden="true">
									{#each driftData as p (p.period_start)}
										{@const barH = p.drift_paise === 0 ? 2 : Math.max(4, Math.round((p.drift_paise / maxDrift) * 48))}
										<div class="drift-col">
											<div class="drift-bar-wrap">
												<div
													class="drift-bar"
													class:drift-bar--zero={p.drift_paise === 0}
													style="height:{barH}px"
												></div>
											</div>
											<span class="drift-label">{formatDisplayDate(p.period_end).slice(0, 6)}</span>
										</div>
									{/each}
								</div>
							</section>
						{/if}
					{/if}
				</div>

				<!-- Right column: category breakdown -->
				<section class="cat-section" aria-label="Spend by category">
					<h2 class="group-head">By category</h2>
					<ul class="cat-list">
						{#each insights.by_category as c (c.category_id)}
							{@const isUncat = c.is_system === 1 && c.name === 'Uncategorized'}
							{@const barWidth = pct(c.spent_paise, total)}
							<li class="cat-row">
								<span class="cat-dot" style="background:{c.color}" aria-hidden="true"></span>
								<span class="cat-main">
									<span class="cat-name-row">
										<span class="cat-name">{c.name}</span>
										{#if !isUncat}
											<span class="bucket-chip bucket-chip--{c.bucket}">{c.bucket}</span>
										{:else}
											<span class="bucket-chip bucket-chip--uncat">uncategorized</span>
										{/if}
									</span>
									{#if c.budget_paise > 0}
										{@const budgetOver = c.spent_paise > c.budget_paise}
										<span class="budget-track" aria-label="{pct(c.spent_paise, c.budget_paise)}% of budget">
											<span
												class="budget-fill"
												class:budget-fill--over={budgetOver}
												style="width:{Math.min(100, pct(c.spent_paise, c.budget_paise))}%"
											></span>
										</span>
									{/if}
								</span>
								<span class="cat-right">
									<span class="cat-amount money">{formatPaiseLedger(c.spent_paise)}</span>
									<span class="cat-pct">{barWidth}%</span>
								</span>
							</li>
						{/each}
					</ul>
				</section>
			</div>
		</div>
	{/if}
{:catch}
	<div class="insights-page">
		<h1 class="section-head">Insights</h1>
		<p class="load-error">
			Couldn't load insights.
			<button class="retry-btn" onclick={() => invalidateAll()}>Retry</button>
		</p>
	</div>
{/await}

<style>
	.insights-page {
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
		padding-bottom: calc(var(--space-6) + var(--nav-height));
	}

	/* Two-column layout on desktop */
	.insights-grid {
		display: contents; /* mobile: sections flow naturally into flex column */
	}

	.insights-col {
		display: contents;
	}

	@media (min-width: 768px) {
		.insights-page {
			padding: var(--space-8);
			padding-bottom: var(--space-8);
			gap: var(--space-6);
		}

		.insights-grid {
			display: grid;
			grid-template-columns: 300px 1fr;
			gap: var(--space-8);
			align-items: start;
		}

		.insights-col {
			display: flex;
			flex-direction: column;
			gap: var(--space-6);
		}

	}

	.page-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.page-sub {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
	}

	/* ── Cycle target card ───────────────────────────────────────────────────── */
	.target-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-5);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.target-head {
		display: flex;
		align-items: baseline;
	}

	.target-total {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
		color: inherit;
		font: inherit;
	}

	.total-number {
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-text);
		font-variant-numeric: tabular-nums lining-nums;
	}

	.total-sub {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.total-sub--set {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.target-edit-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.currency-hint {
		font-family: var(--font-display);
		font-size: 1.25rem;
		color: var(--color-text-muted);
	}

	.target-input {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 600;
		width: 140px;
		border: none;
		border-bottom: 2px solid var(--color-border);
		border-radius: 0;
		background: transparent;
		color: var(--color-text);
		padding: 2px 0;
	}

	.target-input:focus { outline: none; border-bottom-color: var(--color-gold); }

	.save-btn {
		height: 36px;
		padding: 0 var(--space-3);
		background: var(--color-gold);
		color: var(--color-ink);
		font-weight: 700;
		font-size: 0.875rem;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.save-btn:disabled { opacity: 0.5; }

	.cancel-btn {
		height: 36px;
		padding: 0 var(--space-3);
		background: none;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.prog-track {
		height: 6px;
		background: var(--color-border);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.prog-fill {
		height: 100%;
		background: var(--color-text-muted);
		border-radius: var(--radius-full);
		transition: width 0.3s var(--ease-out);
	}

	.prog-fill--over { background: var(--color-clay); }

	.over-note {
		font-size: 0.8125rem;
		color: var(--color-clay);
	}

	/* ── Committed / flexible split ─────────────────────────────────────────── */
	.split-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-5);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.split-labels {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.split-col {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.split-col--right {
		text-align: right;
	}

	.split-kind {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-subtle);
	}

	.split-amount {
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-text);
		font-variant-numeric: tabular-nums lining-nums;
	}

	.split-pct {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.split-bar {
		display: flex;
		height: 8px;
		border-radius: var(--radius-full);
		overflow: hidden;
		background: var(--color-border);
		gap: 2px;
	}

	.split-seg {
		display: block;
		height: 100%;
		transition: width 0.3s var(--ease-out);
	}

	.split-seg--committed { background: var(--color-navy, #1B3A66); border-radius: var(--radius-full) 0 0 var(--radius-full); }
	.split-seg--flexible  { background: var(--color-text-muted); }
	.split-seg--uncat     { background: var(--color-gold); border-radius: 0 var(--radius-full) var(--radius-full) 0; }

	/* ── Category list ──────────────────────────────────────────────────────── */
	.cat-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.group-head {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-subtle);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-bottom: var(--space-2);
	}

	.cat-list {
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.cat-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.cat-row:last-child { border-bottom: none; }

	.cat-dot {
		flex: none;
		width: 10px;
		height: 10px;
		border-radius: var(--radius-full);
	}

	.cat-main {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		flex: 1;
		min-width: 0;
	}

	.cat-name-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.cat-name {
		font-size: 0.9375rem;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bucket-chip {
		display: inline-block;
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 1px var(--space-2);
		border-radius: var(--radius-full);
		white-space: nowrap;
	}

	.bucket-chip--committed {
		background: color-mix(in srgb, var(--color-text) 10%, transparent);
		color: var(--color-text-muted);
	}

	.bucket-chip--flexible {
		background: color-mix(in srgb, var(--color-text-subtle) 12%, transparent);
		color: var(--color-text-subtle);
	}

	.bucket-chip--uncat {
		background: color-mix(in srgb, var(--color-gold) 15%, transparent);
		color: var(--color-gold);
	}

	.budget-track {
		display: block;
		height: 3px;
		background: var(--color-border);
		border-radius: var(--radius-full);
		overflow: hidden;
		margin-top: 2px;
	}

	.budget-fill {
		display: block;
		height: 100%;
		background: var(--color-text-muted);
		border-radius: var(--radius-full);
	}

	.budget-fill--over { background: var(--color-clay); }

	.cat-right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 1px;
		flex: none;
	}

	.cat-amount {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
		font-variant-numeric: tabular-nums lining-nums;
		white-space: nowrap;
	}

	.cat-pct {
		font-size: 0.75rem;
		color: var(--color-text-subtle);
	}

	/* ── Data quality signal ─────────────────────────────────────────────────── */
	.quality-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: color-mix(in srgb, var(--color-gold) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-gold) 25%, transparent);
		border-radius: var(--radius-md);
	}

	.quality-line {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		flex: 1;
	}

	.quality-link {
		flex: none;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
		text-decoration: none;
		white-space: nowrap;
	}

	.quality-link:hover { text-decoration: underline; }

	/* ── Period history ──────────────────────────────────────────────────────── */
	.history-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.history-list {
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.history-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.history-row:last-child { border-bottom: none; }

	/* Drift trend chart */
	.drift-trend {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-5);
		background: var(--color-surface-subtle);
		border-radius: var(--radius-md);
	}

	.drift-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.drift-badge {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 2px var(--space-2);
		border-radius: var(--radius-full);
	}

	.drift-badge--improving {
		background: color-mix(in srgb, var(--color-positive) 15%, transparent);
		color: var(--color-positive);
	}

	.drift-badge--perfect {
		background: color-mix(in srgb, var(--color-positive) 15%, transparent);
		color: var(--color-positive);
	}

	.drift-sub {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	.drift-chart {
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);
		height: 64px;
	}

	.drift-col {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		height: 100%;
		justify-content: flex-end;
	}

	.drift-bar-wrap {
		flex: 1;
		display: flex;
		align-items: flex-end;
		width: 100%;
	}

	.drift-bar {
		width: 100%;
		background: var(--color-text-muted);
		border-radius: 2px 2px 0 0;
		opacity: 1;
		transition: height 300ms ease-out;
	}

	.drift-bar--zero {
		background: var(--color-positive);
		opacity: 0.5;
	}

	.drift-label {
		font-size: 0.6875rem;
		color: var(--color-text-subtle);
		white-space: nowrap;
	}

	.history-range {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.history-right {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
	}

	.history-amount {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
		font-variant-numeric: tabular-nums lining-nums;
		white-space: nowrap;
	}

	.history-uncat {
		font-size: 0.75rem;
		color: var(--color-text-subtle);
		white-space: nowrap;
	}

	/* Skeleton */
	.skel {
		background: var(--color-surface-subtle);
		border-radius: var(--radius-sm);
		animation: skel-pulse 1.4s ease-in-out infinite;
	}

	.skel-label { height: 14px; }
	.skel-sub   { height: 13px; margin-top: var(--space-1); }

	@keyframes skel-pulse {
		0%, 100% { opacity: 1; }
		50%       { opacity: 0.5; }
	}

	.load-error {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		display: flex;
		align-items: center;
		gap: var(--space-3);
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
</style>
