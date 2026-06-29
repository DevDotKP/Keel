<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { parseToPaise, formatPaise, formatPaiseLedger } from '$lib/utils/money';
	import { formatDisplayDate, today } from '$lib/utils/date';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import HelpTip from '$lib/components/HelpTip.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showDetail = $state(false);
	// Spend-over-time zoom: day-over-day, month-over-month, or year-over-year.
	let trendZoom = $state<'day' | 'month' | 'year'>('month');
	const ZOOM_UNIT = { day: 'day', month: 'month', year: 'year' } as const;
	const ZOOM_NOW = { day: 'Today', month: 'This month', year: 'This year' } as const;
	// Which bar's amount is shown in the readout. null = the latest bar.
	let selectedBar = $state<number | null>(null);
	function pickZoom(z: 'day' | 'month' | 'year') {
		trendZoom = z;
		selectedBar = null;
	}

	// Donut for category composition ("where the money went"). Hand-built SVG: each
	// segment is an arc of the circle, lengths proportional to spend.
	const DONUT_R = 42;
	const DONUT_C = 2 * Math.PI * DONUT_R;
	function buildDonut(
		cats: { name: string; color: string; spent_paise: number }[]
	): { total: number; segments: Array<{ name: string; color: string; paise: number; pct: number; dash: number; offset: number }> } {
		const spend = cats.filter((c) => c.spent_paise > 0).sort((a, b) => b.spent_paise - a.spent_paise);
		const total = spend.reduce((s, c) => s + c.spent_paise, 0);
		let acc = 0;
		const segments = spend.map((c) => {
			const frac = total > 0 ? c.spent_paise / total : 0;
			const dash = frac * DONUT_C;
			const seg = {
				name: c.name,
				color: c.color,
				paise: c.spent_paise,
				pct: Math.round(frac * 100),
				dash,
				offset: -acc
			};
			acc += dash;
			return seg;
		});
		return { total, segments };
	}

	// Days elapsed in the current period (1-based, clamped to the period length).
	function daysElapsed(startIso: string, endIso: string): number {
		const day = 86400000;
		const start = Date.parse(startIso);
		const total = Math.floor((Date.parse(endIso) - start) / day) + 1;
		const elapsed = Math.floor((Date.parse(today()) - start) / day) + 1;
		return Math.min(Math.max(1, elapsed), Math.max(1, total));
	}

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

	// Show Insights when there's anything to show: spend this period, prior closed
	// periods, or any spend in the trend windows. Only a truly empty account (no
	// history at all) gets the "add expenses" empty state.
	function hasInsightsData(i: Awaited<NonNullable<typeof data.insights>>): boolean {
		if (i.total_expense_paise > 0) return true;
		if (i.recent_periods.length > 0) return true;
		const t = i.spend_trends;
		return [...t.daily, ...t.monthly, ...t.yearly].some((p) => p.paise > 0);
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
	{#if !insights || !hasInsightsData(insights)}
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
										targetValue = insights.base_budget_paise
											? (insights.base_budget_paise / 100).toString()
											: '';
										editingTarget = true;
									}}
									aria-label="Edit cycle spending target"
								>
									<span class="total-number money">{formatPaiseLedger(total)}</span>
									{#if insights.base_budget_paise > 0}
										<span class="total-sub">of {formatPaiseLedger(insights.cycle_budget_paise)} target</span>
									{:else}
										<span class="total-sub total-sub--set">Set a cycle target</span>
									{/if}
								</button>
							{/if}
						</div>
						{#if insights.base_budget_paise > 0}
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
							{#if insights.carryover_paise !== 0}
								<p class="carry-note">
									{#if insights.carryover_paise > 0}
										Includes {formatPaiseLedger(insights.carryover_paise)} carried over from last cycle.
									{:else}
										{formatPaiseLedger(-insights.carryover_paise)} less, after last cycle's overspend.
									{/if}
								</p>
							{/if}
						{/if}
					</section>

					<!-- Savings rate: income vs spend. Prompt if no income set. -->
					{#if insights.household_income_paise > 0}
						{@const savings = insights.household_income_paise - insights.total_expense_paise}
						{@const savingsRate = Math.round((savings / insights.household_income_paise) * 100)}
						<section class="savings-card" aria-label="Savings rate">
							<div class="savings-row">
								<span class="savings-item">
									<span class="savings-label">Income</span>
									<span class="savings-val money">{formatPaise(Math.round(insights.household_income_paise / 100) * 100)}</span>
								</span>
								<span class="savings-item">
									<span class="savings-label">Spent</span>
									<span class="savings-val money">{formatPaise(Math.round(insights.total_expense_paise / 100) * 100)}</span>
								</span>
								<span class="savings-item">
									<span class="savings-label">Saved</span>
									<span class="savings-val money" class:savings-val--neg={savings < 0}>{formatPaise(Math.round(Math.abs(savings) / 100) * 100)}</span>
								</span>
							</div>
							<div class="savings-rate-row">
								<span class="savings-rate-label">Savings rate</span>
								<span class="savings-rate-val" class:savings-rate--neg={savingsRate < 0}>{savingsRate}%</span>
							</div>
							<div class="prog-track" aria-hidden="true">
								<div
									class="prog-fill"
									class:prog-fill--over={savings < 0}
									style="width:{Math.min(100, Math.max(0, savingsRate))}%"
								></div>
							</div>
						</section>
					{:else}
						<section class="savings-prompt" aria-label="Add income">
							<p class="savings-prompt-text">Add your income in Obligations to see your savings rate.</p>
							<a href="/obligations" class="savings-prompt-link">Add income</a>
						</section>
					{/if}

					<!-- Committed / flexible split -->
					{#if insights.committed_paise + insights.flexible_paise > 0}
						<section class="split-card" aria-label="Committed and flexible spend">
							<div class="split-labels">
								<span class="split-col">
									<span class="split-kind"
										>Committed<HelpTip
											term="Committed"
											align="start"
											text="Spending you can't easily avoid, like rent and bills. Flexible is everything else."
										/></span
									>
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
								<p class="sr-only">
									Harbour adjustment over the last {driftData.length} periods.
									{#if !hasAnyDrift}No drift in any period.{:else if improving}The latest adjustment is smaller than the previous one.{:else}Latest adjustment {formatPaiseLedger(latestDrift)}.{/if}
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
										<span class="budget-caption" class:budget-caption--over={budgetOver}>
											Budget {formatPaiseLedger(c.budget_paise)} · {pct(c.spent_paise, c.budget_paise)}% used
										</span>
									{/if}
								</span>
								<span class="cat-right">
									<span class="cat-amount money">{formatPaiseLedger(c.spent_paise)}</span>
									{#if c.prev_spent_paise > 0}
										{@const d = c.spent_paise - c.prev_spent_paise}
										<span class="cat-delta" class:cat-delta--up={d > 0} class:cat-delta--down={d < 0}>
											{d > 0 ? '+' : d < 0 ? '−' : ''}{formatPaiseLedger(Math.abs(d))} vs last
										</span>
									{:else}
										<span class="cat-pct">{barWidth}% of spend</span>
									{/if}
								</span>
							</li>
						{/each}
					</ul>
				</section>
			</div>
			{#if insights.recent_periods.length > 0 || insights.total_expense_paise > 0}
				<section class="detail-section" aria-label="More detail">
					{#if !showDetail}
						<button class="detail-toggle" onclick={() => (showDetail = true)}>See more detail</button>
					{:else}
						{@const de = daysElapsed(insights.period_start, insights.period_end)}
						{@const prev = insights.recent_periods[0]}
						<div class="detail-grid">
							<div class="detail-card">
								<span class="detail-label">Avg daily spend</span>
								<span class="detail-value money">{formatPaiseLedger(de > 0 ? Math.round(insights.total_expense_paise / de) : 0)}</span>
								<span class="detail-note">over {de} {de === 1 ? 'day' : 'days'} this period</span>
							</div>
							{#if prev}
								{@const delta = insights.total_expense_paise - prev.total_expense_paise}
								{@const pctChange = prev.total_expense_paise > 0 ? Math.round((delta / prev.total_expense_paise) * 100) : 0}
								<div class="detail-card">
									<span class="detail-label">vs last period</span>
									<span class="detail-value money">{formatPaiseLedger(insights.total_expense_paise)}</span>
									<span class="detail-note" class:detail-note--up={delta > 0} class:detail-note--down={delta < 0}>
										{#if delta === 0}Same as last period{:else}{Math.abs(pctChange)}% {delta > 0 ? 'higher' : 'lower'} than last ({formatPaiseLedger(prev.total_expense_paise)}){/if}
									</span>
								</div>
							{/if}
						</div>
						{#if insights.recent_periods.length >= 2}
							{@const trend = [...insights.recent_periods].reverse()}
							{@const maxT = Math.max(...trend.map((p) => p.total_expense_paise), insights.total_expense_paise, 1)}
							<div class="trend-block">
								<h3 class="group-head">Spend trend</h3>
								<div class="trend-chart" aria-hidden="true">
									{#each trend as p (p.period_start)}
										{@const h = Math.max(4, Math.round((p.total_expense_paise / maxT) * 48))}
										<div class="trend-col">
											<div class="trend-bar" style="height:{h}px"></div>
											<span class="trend-label">{formatDisplayDate(p.period_end).slice(0, 6)}</span>
										</div>
									{/each}
									<div class="trend-col">
										<div class="trend-bar trend-bar--current" style="height:{Math.max(4, Math.round((insights.total_expense_paise / maxT) * 48))}px"></div>
										<span class="trend-label">Now</span>
									</div>
								</div>
							</div>
						{/if}
						{#if insights.prev_by_category.length > 0}
							{@const curMap = new Map(insights.by_category.map((c) => [c.category_id, c]))}
							{@const prevMap = new Map(insights.prev_by_category.map((pp) => [pp.category_id, pp]))}
							{@const movers = [...new Set([...curMap.keys(), ...prevMap.keys()])]
								.map((cid) => {
									const cur = curMap.get(cid);
									const prev = prevMap.get(cid);
									return {
										cid,
										name: cur?.name ?? prev?.name ?? '',
										color: cur?.color ?? prev?.color ?? '#6B7280',
										isUncat: cur?.is_system === 1 && cur?.name === 'Uncategorized',
										delta: (cur?.spent_paise ?? 0) - (prev?.spent_paise ?? 0)
									};
								})
								.filter((mv) => !mv.isUncat && mv.delta !== 0)
								.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
								.slice(0, 5)}
							{#if movers.length > 0}
								<div class="movers-block">
									<h3 class="group-head">Biggest changes vs last period</h3>
									<ul class="movers-list">
										{#each movers as mv (mv.cid)}
											<li class="mover-row">
												<span class="cat-dot" style="background:{mv.color}" aria-hidden="true"></span>
												<span class="mover-name">{mv.name}</span>
												<span class="mover-delta" class:mover-up={mv.delta > 0} class:mover-down={mv.delta < 0}
													>{mv.delta > 0 ? '+' : '\u2212'}{formatPaiseLedger(Math.abs(mv.delta))}</span>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
						{/if}
						<!-- Non-essentials MoM: flexible spend trend -->
						{@const flexMonths = insights.flexible_monthly}
						{@const maxFlex = Math.max(...flexMonths.map((p) => p.paise), 1)}
						{@const hasFlexData = flexMonths.some((p) => p.paise > 0)}
						{#if hasFlexData}
							{@const latestFlex = flexMonths[flexMonths.length - 1]?.paise ?? 0}
							{@const prevFlex = flexMonths[flexMonths.length - 2]?.paise ?? 0}
							{@const flexDelta = prevFlex > 0 ? Math.round(((latestFlex - prevFlex) / prevFlex) * 100) : 0}
							<div class="flex-trend-block">
								<div class="flex-trend-head">
									<h3 class="group-head">Non-essentials over time</h3>
									{#if prevFlex > 0 && flexDelta !== 0}
										<span class="flex-badge" class:flex-badge--down={flexDelta < 0} class:flex-badge--up={flexDelta > 0}>
											{flexDelta > 0 ? '+' : ''}{flexDelta}% vs last month
										</span>
									{/if}
								</div>
								<p class="flex-trend-sub">Flexible spend by month. Trending down means you're saving more.</p>
								<div class="trend-chart" aria-label="Flexible spend by month" aria-hidden="true">
									{#each flexMonths as p (p.label)}
										{@const h = p.paise === 0 ? 2 : Math.max(4, Math.round((p.paise / maxFlex) * 48))}
										<div class="trend-col">
											<div class="trend-bar flex-bar" style="height:{h}px"></div>
											<span class="trend-label">{p.label}</span>
										</div>
									{/each}
								</div>
								<p class="flex-trend-note">
									This month: {formatPaiseLedger(latestFlex)} flexible.
									{#if prevFlex > 0}
										{#if flexDelta < 0}
											Down {Math.abs(flexDelta)}% from last month.
										{:else if flexDelta > 0}
											Up {flexDelta}% from last month.
										{:else}
											Same as last month.
										{/if}
									{/if}
								</p>
							</div>
						{/if}

						<!-- Spend over time: day-over-day, month-over-month, year-over-year -->
						{@const series = trendZoom === 'day'
							? insights.spend_trends.daily
							: trendZoom === 'month'
								? insights.spend_trends.monthly
								: insights.spend_trends.yearly}
						{@const lastIdx = series.length - 1}
						{@const currentP = series[lastIdx]?.paise ?? 0}
						{@const lastComplete = series[lastIdx - 1]}
						{@const beforeComplete = series[lastIdx - 2]}
						{@const comparable = !!lastComplete && !!beforeComplete && beforeComplete.paise > 0}
						{@const cmpPct = comparable
							? Math.round(((lastComplete.paise - beforeComplete.paise) / beforeComplete.paise) * 100)
							: 0}
						<!-- Day view shows the last 14 days (30 was too sparse to read). -->
						{@const dispSeries = trendZoom === 'day' ? series.slice(-14) : series}
						{@const maxD = Math.max(...dispSeries.map((p) => p.paise), 1)}
						{@const activeIdx =
							selectedBar !== null && selectedBar < dispSeries.length
								? selectedBar
								: dispSeries.length - 1}
						{@const activeBar = dispSeries[activeIdx]}
						<div class="overtime-block">
							<div class="overtime-head">
								<h3 class="group-head">Spend over time</h3>
								<div class="zoom-toggle" role="group" aria-label="Compare by">
									<button
										class="zoom-btn"
										class:zoom-btn--on={trendZoom === 'day'}
										aria-pressed={trendZoom === 'day'}
										onclick={() => pickZoom('day')}>Day</button
									>
									<button
										class="zoom-btn"
										class:zoom-btn--on={trendZoom === 'month'}
										aria-pressed={trendZoom === 'month'}
										onclick={() => pickZoom('month')}>Month</button
									>
									<button
										class="zoom-btn"
										class:zoom-btn--on={trendZoom === 'year'}
										aria-pressed={trendZoom === 'year'}
										onclick={() => pickZoom('year')}>Year</button
									>
								</div>
							</div>
							<p class="overtime-summary" aria-live="polite">
								{#if currentP === 0 && !comparable}
									No spend recorded yet. This view fills in as you log.
								{:else}
									<span class="overtime-now"
										>{ZOOM_NOW[trendZoom]}: {formatPaiseLedger(currentP)} so far.</span
									>
									{#if comparable}
										<span class="overtime-cmp">
											{lastComplete.label}: {formatPaiseLedger(lastComplete.paise)},
											{#if cmpPct === 0}about the same as{:else}<span
													class:overtime-up={cmpPct > 0}
													class:overtime-down={cmpPct < 0}
													>{Math.abs(cmpPct)}% {cmpPct > 0 ? 'higher' : 'lower'}</span
												> than{/if}
											{beforeComplete.label}.
										</span>
									{:else}
										<span class="overtime-cmp overtime-muted"
											>Not enough history yet to compare {ZOOM_UNIT[trendZoom]}s.</span
										>
									{/if}
								{/if}
							</p>
							<p class="overtime-readout" aria-live="polite">
								<span class="overtime-readout-label">{activeBar?.label ?? ''}</span>
								<span class="overtime-readout-amt money">{formatPaiseLedger(activeBar?.paise ?? 0)}</span>
							</p>
							<div
								class="trend-chart overtime-chart"
								role="group"
								aria-label="Spend per {ZOOM_UNIT[trendZoom]}. Select a bar to read its amount."
							>
								{#each dispSeries as p, i (i)}
									{@const h = Math.max(2, Math.round((p.paise / maxD) * 56))}
									<button
										type="button"
										class="trend-col trend-col--btn"
										class:trend-col--active={i === activeIdx}
										onpointerenter={() => (selectedBar = i)}
										onfocus={() => (selectedBar = i)}
										onclick={() => (selectedBar = i)}
										aria-label="{p.label}: {formatPaiseLedger(p.paise)}"
									>
										<span class="trend-bar" class:trend-bar--current={i === dispSeries.length - 1} style="height:{h}px"></span>
										<span class="trend-label">{p.label}</span>
									</button>
								{/each}
							</div>
						</div>

						<!-- Where it went: category composition donut -->
						{@const donut = buildDonut(insights.by_category)}
						{#if donut.total > 0}
							{@const top = donut.segments.slice(0, 6)}
							{@const restPaise = donut.segments.slice(6).reduce((s, x) => s + x.paise, 0)}
							<div class="donut-block">
								<h3 class="group-head">Where it went this period</h3>
								<div class="donut-wrap">
									<div class="donut-fig">
										<svg class="donut" viewBox="0 0 100 100" aria-hidden="true">
											{#each donut.segments as seg (seg.name)}
												<circle
													cx="50"
													cy="50"
													r={DONUT_R}
													fill="none"
													stroke={seg.color}
													stroke-width="15"
													stroke-dasharray="{seg.dash} {DONUT_C}"
													stroke-dashoffset={seg.offset}
													transform="rotate(-90 50 50)"
												/>
											{/each}
										</svg>
										<div class="donut-center">
											<span class="donut-center-amt money">{formatPaiseLedger(donut.total)}</span>
											<span class="donut-center-label">spent</span>
										</div>
									</div>
									<ul class="donut-legend">
										{#each top as seg (seg.name)}
											<li class="donut-legend-row">
												<span class="cat-dot" style="background:{seg.color}" aria-hidden="true"></span>
												<span class="donut-legend-name">{seg.name}</span>
												<span class="donut-legend-amt money">{formatPaiseLedger(seg.paise)}</span>
												<span class="donut-legend-pct">{seg.pct}%</span>
											</li>
										{/each}
										{#if restPaise > 0}
											<li class="donut-legend-row">
												<span class="cat-dot cat-dot--rest" aria-hidden="true"></span>
												<span class="donut-legend-name">Other</span>
												<span class="donut-legend-amt money">{formatPaiseLedger(restPaise)}</span>
												<span class="donut-legend-pct">{Math.round((restPaise / donut.total) * 100)}%</span>
											</li>
										{/if}
									</ul>
								</div>
							</div>
						{/if}
					{/if}
				</section>
			{/if}
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
			min-width: 0; /* let the 300px track hold; never bleed into the next column */
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

	.carry-note {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
	}

	/* ── Committed / flexible split ─────────────────────────────────────────── */
	/* Hairline section, not a filled card: the cycle target is the one anchor. */
	.split-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-5) 0 0;
		border-top: 1px solid var(--color-border);
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

	.budget-caption {
		display: block;
		font-size: 0.75rem;
		color: var(--color-text-subtle);
		margin-top: 2px;
		font-variant-numeric: tabular-nums lining-nums;
	}

	.budget-caption--over { color: var(--color-clay); }

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
		white-space: nowrap;
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
		padding: var(--space-5) 0 0;
		border-top: 1px solid var(--color-border);
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

	.detail-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-border);
	}

	.detail-toggle {
		align-self: flex-start;
		background: none;
		border: none;
		padding: 0;
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
		font-family: inherit;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-5);
	}

	.detail-card {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.detail-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-subtle);
	}

	.detail-value {
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-text);
		font-variant-numeric: tabular-nums lining-nums;
	}

	.detail-note {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.detail-note--up { color: var(--color-clay); }
	.detail-note--down { color: var(--color-positive); }

	.trend-block {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.trend-chart {
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);
		height: 64px;
		overflow: hidden;
	}

	.trend-col {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		height: 100%;
		justify-content: flex-end;
	}

	.trend-bar {
		width: 100%;
		background: var(--color-text-muted);
		border-radius: 2px 2px 0 0;
	}

	.trend-bar--current { background: var(--color-navy); }

	/* Spend over time (Day/Month/Year) */
	.overtime-block {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}

	.overtime-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.zoom-toggle {
		display: inline-flex;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.zoom-btn {
		padding: 10px var(--space-3);
		background: transparent;
		border: none;
		color: var(--color-text-muted);
		font-family: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.zoom-btn + .zoom-btn {
		border-left: 1px solid var(--color-border);
	}

	.zoom-btn--on {
		background: var(--color-surface-subtle);
		color: var(--color-text);
		font-weight: 600;
	}

	.overtime-summary {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	.overtime-up {
		color: var(--color-clay);
		font-weight: 600;
	}

	.overtime-down {
		color: var(--color-positive);
		font-weight: 600;
	}

	.overtime-chart {
		gap: var(--space-1);
	}

	/* Bars are buttons: tap or hover to read the amount in the readout above. */
	.trend-col--btn {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		cursor: pointer;
	}

	.trend-col--active .trend-bar {
		background: var(--color-navy);
	}

	.trend-col--active .trend-label {
		color: var(--color-text);
		font-weight: 600;
	}

	/* Readout: the selected (or latest) bar's exact amount. */
	.overtime-readout {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		padding-bottom: var(--space-1);
	}

	.overtime-readout-label {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.overtime-readout-amt {
		font-family: var(--font-display);
		font-size: 1.0625rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.overtime-now {
		display: block;
		color: var(--color-text);
		font-weight: 600;
	}

	.overtime-cmp {
		display: block;
		margin-top: 2px;
	}

	.overtime-muted {
		color: var(--color-text-subtle);
	}

	/* Category composition donut */
	.donut-block {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}

	.donut-wrap {
		display: flex;
		align-items: center;
		gap: var(--space-5);
		flex-wrap: wrap;
	}

	.donut-fig {
		position: relative;
		width: 140px;
		height: 140px;
		flex: none;
	}

	.donut {
		width: 100%;
		height: 100%;
		display: block;
	}

	.donut-center {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		pointer-events: none;
	}

	.donut-center-amt {
		font-family: var(--font-display);
		font-size: 1.0625rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.donut-center-label {
		font-size: 0.6875rem;
		color: var(--color-text-subtle);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.donut-legend {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		flex: 1 1 180px;
		min-width: 0;
	}

	.donut-legend-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: 0.875rem;
	}

	.donut-legend-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--color-text);
	}

	.donut-legend-amt {
		color: var(--color-text);
		font-variant-numeric: tabular-nums;
	}

	.donut-legend-pct {
		flex: none;
		width: 38px;
		text-align: right;
		color: var(--color-text-subtle);
		font-variant-numeric: tabular-nums;
	}

	.cat-dot--rest {
		background: var(--color-text-subtle);
	}

	.trend-label {
		font-size: 0.6875rem;
		color: var(--color-text-subtle);
		white-space: nowrap;
		overflow: hidden;
		max-width: 100%;
	}

	.detail-foot {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
	}

	.movers-block {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.movers-list {
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.mover-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.mover-row:last-child {
		border-bottom: none;
	}

	.mover-name {
		flex: 1;
		min-width: 0;
		font-size: 0.9375rem;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mover-delta {
		flex: none;
		font-size: 0.9375rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums lining-nums;
	}

	.mover-up { color: var(--color-clay); }
	.mover-down { color: var(--color-positive); }

	/* ── Per-category MoM delta ──────────────────────────────────────────────── */
	.cat-delta {
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums lining-nums;
		white-space: nowrap;
	}

	.cat-delta--up { color: var(--color-clay); }
	.cat-delta--down { color: var(--color-positive); }

	/* ── Savings rate card ────────────────────────────────────────────────────── */
	.savings-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-5);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.savings-row {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.savings-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.savings-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-subtle);
	}

	.savings-val {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-text);
		font-variant-numeric: tabular-nums lining-nums;
	}

	.savings-val--neg { color: var(--color-clay); }

	.savings-rate-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.savings-rate-label {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.savings-rate-val {
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-positive);
	}

	.savings-rate--neg { color: var(--color-clay); }

	.savings-prompt {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: color-mix(in srgb, var(--color-text) 4%, transparent);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
	}

	.savings-prompt-text {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		flex: 1;
	}

	.savings-prompt-link {
		flex: none;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
		text-decoration: none;
		white-space: nowrap;
	}

	.savings-prompt-link:hover { text-decoration: underline; }

	/* ── Flexible trend block ─────────────────────────────────────────────────── */
	.flex-trend-block {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}

	.flex-trend-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.flex-badge {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 2px var(--space-2);
		border-radius: var(--radius-full);
	}

	.flex-badge--down {
		background: color-mix(in srgb, var(--color-positive) 15%, transparent);
		color: var(--color-positive);
	}

	.flex-badge--up {
		background: color-mix(in srgb, var(--color-clay) 15%, transparent);
		color: var(--color-clay);
	}

	.flex-trend-sub {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	.flex-bar {
		background: color-mix(in srgb, var(--color-text-muted) 60%, transparent);
	}

	.flex-trend-note {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
	}
</style>
