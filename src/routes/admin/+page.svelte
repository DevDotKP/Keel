<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Which metric's weekly series the trend chart shows (set by clicking a card).
	type SeriesKey = 'new' | 'wau' | 'mau' | 'total' | 'pau' | 'churn';
	let selected = $state<SeriesKey>('wau');
	const SERIES_LABEL: Record<SeriesKey, string> = {
		new: 'New users',
		wau: 'Weekly active',
		mau: 'Monthly active (MAU)',
		total: 'Total users',
		pau: 'Paid active (PAU)',
		churn: 'Churn'
	};

	let points = $derived(data.metrics?.series?.[selected] ?? []);
	let maxVal = $derived(Math.max(1, ...points.map((p) => p.value)));

	function fmtTime(s: string): string {
		// Stored UTC "YYYY-MM-DD HH:MM:SS" → compact "DD MMM, HH:MM".
		const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
		if (isNaN(d.getTime())) return s;
		return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
	}

	// Null means "no data yet" (e.g. no cohort is old enough). Show a dash, not 0%.
	const pd = (v: number | null, suffix = '%'): string => (v === null ? '—' : `${v}${suffix}`);

	let uncatPoints = $derived(data.habit?.uncategorizedSeries ?? []);
	let uncatMax = $derived(Math.max(1, ...uncatPoints.map((p) => p.value)));
</script>

<svelte:head>
	<title>Keel admin</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if !data.authed}
	<!-- Login gate -->
	<div class="login-wrap">
		<div class="login-card">
			<h1 class="login-title">Keel admin</h1>
			{#if !data.configured}
				<p class="login-note">
					Admin is not configured on this deployment. Set <code>ADMIN_USER</code> and
					<code>ADMIN_PASS</code> as secrets, then reload.
				</p>
			{:else}
				<form method="POST" action="?/login" use:enhance>
					{#if form?.message}<p class="login-error" role="alert">{form.message}</p>{/if}
					<input class="login-input" type="text" name="user" placeholder="Username" autocomplete="off" required />
					<input class="login-input" type="password" name="pass" placeholder="Password" autocomplete="off" required />
					<button class="login-btn" type="submit">Sign in</button>
				</form>
			{/if}
		</div>
	</div>
{:else if data.metrics}
	{@const m = data.metrics}
	<div class="admin">
		<header class="admin-head">
			<h1 class="admin-title">Keel admin</h1>
			<form method="POST" action="?/logout" use:enhance>
				<button class="logout-btn" type="submit">Sign out</button>
			</form>
		</header>

		<!-- Stat cards. Click any to chart its 8-week history below. -->
		<section class="cards" aria-label="Metrics">
			<button class="card" class:card--active={selected === 'total'} onclick={() => (selected = 'total')}>
				<span class="card-label">Total users</span>
				<span class="card-value">{m.totalUsers}</span>
			</button>
			<button class="card" class:card--active={selected === 'new'} onclick={() => (selected = 'new')}>
				<span class="card-label">New users (30d)</span>
				<span class="card-value">{m.newUsers30}</span>
			</button>
			<button class="card" class:card--active={selected === 'wau'} onclick={() => (selected = 'wau')}>
				<span class="card-label">WAU</span>
				<span class="card-value">{m.wau}</span>
			</button>
			<button class="card" class:card--active={selected === 'mau'} onclick={() => (selected = 'mau')}>
				<span class="card-label">MAU</span>
				<span class="card-value">{m.mau}</span>
			</button>
			<button class="card" class:card--active={selected === 'pau'} onclick={() => (selected = 'pau')}>
				<span class="card-label">PAU (paid)</span>
				<span class="card-value">{m.pau}</span>
			</button>
			<button class="card" class:card--active={selected === 'churn'} onclick={() => (selected = 'churn')}>
				<span class="card-label">Churn (30d)</span>
				<span class="card-value">{m.churn30}</span>
			</button>
			<div class="card card--static">
				<span class="card-label">DAU (today)</span>
				<span class="card-value">{m.dau}</span>
			</div>
		</section>

		<!-- Weekly trend for the selected metric -->
		<section class="trend" aria-label="Weekly trend">
			<h2 class="section-head">{SERIES_LABEL[selected]}, last 8 weeks</h2>
			<div class="trend-chart" aria-hidden="true">
				{#each points as p (p.label)}
					{@const h = Math.max(2, Math.round((p.value / maxVal) * 56))}
					<div class="trend-col">
						<span class="trend-val">{p.value}</span>
						<div class="trend-bar" style="height:{h}px"></div>
						<span class="trend-label">{p.label}</span>
					</div>
				{/each}
			</div>
		</section>

		<!-- Habit & retention: the North Star and its leading indicators -->
		{#if data.habit}
			{@const h = data.habit}
			<section class="block" aria-label="Habit and retention">
				<h2 class="section-head">Habit & retention</h2>
				<p class="section-note">
					North Star: weeks the user keeps tracking. {h.usersWithEntries} of {h.totalUsers} users have
					logged at least once. A dash means no data yet.
				</p>
				<div class="cards">
					<div class="card card--static card--star">
						<span class="card-label">Avg active weeks / user</span>
						<span class="card-value">{h.avgActiveWeeks}</span>
						<span class="card-sub">North Star (last 12 wks)</span>
					</div>
					<div class="card card--static">
						<span class="card-label">Harbour completion</span>
						<span class="card-value">{pd(h.harbourCompletionRate)}</span>
						<span class="card-sub">ended periods closed</span>
					</div>
					<div class="card card--static">
						<span class="card-label">Activation</span>
						<span class="card-value">{h.activationLoggedPct}%</span>
						<span class="card-sub">users who logged ≥1</span>
					</div>
					<div class="card card--static">
						<span class="card-label">Retention W1 / W2 / W4</span>
						<span class="card-value card-value--sm"
							>{pd(h.retention.w1)} · {pd(h.retention.w2)} · {pd(h.retention.w4)}</span
						>
						<span class="card-sub">active that week after signup</span>
					</div>
					<div class="card card--static">
						<span class="card-label">Voice share</span>
						<span class="card-value">{pd(h.voiceSharePct)}</span>
						<span class="card-sub">entries by voice (30d)</span>
					</div>
					<div class="card card--static">
						<span class="card-label">Voice corrections</span>
						<span class="card-value">{pd(h.voiceCorrectionPct)}</span>
						<span class="card-sub">samples user fixed</span>
					</div>
					<div class="card card--static">
						<span class="card-label">Entries / active week</span>
						<span class="card-value">{h.entriesPerActiveWeek}</span>
						<span class="card-sub">capture frequency</span>
					</div>
				</div>

				<h2 class="section-head section-head--sub">% uncategorized, last 8 weeks (churn signal)</h2>
				<div class="trend-chart" aria-hidden="true">
					{#each uncatPoints as p (p.label)}
						{@const bh = Math.max(2, Math.round((p.value / uncatMax) * 56))}
						<div class="trend-col">
							<span class="trend-val">{p.value}%</span>
							<div class="trend-bar trend-bar--warn" style="height:{bh}px"></div>
							<span class="trend-label">{p.label}</span>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Releases / app-change annotations -->
		<section class="block" aria-label="Releases">
			<h2 class="section-head">Releases</h2>
			<form method="POST" action="?/addRelease" use:enhance={() => async ({ update }) => { await update({ reset: true }); }} class="release-form">
				<input class="release-input" type="text" name="note" placeholder="What changed? (e.g. shipped voice fix)" maxlength="280" required />
				<button class="release-add" type="submit">Add</button>
			</form>
			{#if m.releases.length > 0}
				<ul class="list">
					{#each m.releases as r (r.id)}
						<li class="list-row">
							<span class="list-main">{r.note}</span>
							<span class="list-time">{fmtTime(r.created_at)}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">No releases logged yet.</p>
			{/if}
		</section>

		<!-- Recent errors (from the private error log) -->
		<section class="block" aria-label="Recent errors">
			<h2 class="section-head">Recent errors</h2>
			{#if m.recentErrors.length > 0}
				<ul class="list">
					{#each m.recentErrors as e (e.error_id)}
						<li class="list-row err">
							<span class="list-main">
								<code class="err-id">{e.error_id}</code>
								<span class="err-route">{e.status ?? ''} {e.route ?? ''}</span>
								<span class="err-msg">{e.message ?? ''}</span>
							</span>
							<span class="list-time">{fmtTime(e.created_at)}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">No errors logged. Good.</p>
			{/if}
		</section>
	</div>
{/if}

<style>
	/* ── Login ─────────────────────────────────────────────────────────────── */
	.login-wrap {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-6);
	}

	.login-card {
		width: 100%;
		max-width: 320px;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.login-title {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.login-note {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	.login-note code {
		font-size: 0.8125rem;
		background: var(--color-surface-subtle);
		padding: 1px 4px;
		border-radius: var(--radius-sm);
	}

	.login-card form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.login-error {
		font-size: 0.875rem;
		color: var(--color-clay);
	}

	.login-input {
		height: 44px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 1rem;
		color: var(--color-text);
	}

	.login-input:focus { outline: none; border-color: var(--color-gold); }

	.login-btn {
		height: 48px;
		background: var(--color-gold);
		color: var(--color-ink);
		font-weight: 700;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-family: inherit;
	}

	/* ── Dashboard ─────────────────────────────────────────────────────────── */
	.admin {
		max-width: 800px;
		margin: 0 auto;
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.admin-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.admin-title {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.logout-btn {
		height: 36px;
		padding: 0 var(--space-3);
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text-muted);
		cursor: pointer;
		font-family: inherit;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: var(--space-3);
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-4);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		text-align: left;
		font-family: inherit;
		cursor: pointer;
	}

	.card--static { cursor: default; }

	.card--active {
		border-color: var(--color-gold);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-gold) 25%, transparent);
	}

	.card-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-subtle);
	}

	.card-value {
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-text);
		font-variant-numeric: tabular-nums;
	}

	.section-head {
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-subtle);
		margin-bottom: var(--space-3);
	}

	.section-head--sub {
		margin-top: var(--space-5);
	}

	.section-note {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		line-height: 1.5;
		margin-bottom: var(--space-3);
	}

	.card-sub {
		font-size: 0.6875rem;
		color: var(--color-text-subtle);
	}

	.card-value--sm {
		font-size: 1.125rem;
	}

	.card--star {
		border-color: var(--color-gold);
	}

	.trend-bar--warn {
		background: var(--color-clay);
	}

	.trend-chart {
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);
		min-height: 90px;
	}

	.trend-col {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		justify-content: flex-end;
	}

	.trend-val {
		font-size: 0.6875rem;
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
	}

	.trend-bar {
		width: 100%;
		max-width: 36px;
		background: var(--color-navy);
		border-radius: 2px 2px 0 0;
	}

	.trend-label {
		font-size: 0.625rem;
		color: var(--color-text-subtle);
		white-space: nowrap;
	}

	.block { display: flex; flex-direction: column; }

	.release-form {
		display: flex;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}

	.release-input {
		flex: 1;
		min-width: 0;
		height: 40px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 0.9375rem;
		color: var(--color-text);
	}

	.release-input:focus { outline: none; border-color: var(--color-gold); }

	.release-add {
		flex: none;
		height: 40px;
		padding: 0 var(--space-4);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
	}

	.list {
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.list-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-border);
		font-size: 0.875rem;
	}

	.list-row:last-child { border-bottom: none; }

	.list-main { color: var(--color-text); min-width: 0; }

	.list-time {
		flex: none;
		font-size: 0.75rem;
		color: var(--color-text-subtle);
		white-space: nowrap;
	}

	.list-row.err .list-main {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.err-id {
		font-family: monospace;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.err-route {
		font-size: 0.75rem;
		color: var(--color-text-subtle);
	}

	.err-msg {
		font-size: 0.8125rem;
		color: var(--color-clay);
		word-break: break-word;
	}

	.empty {
		font-size: 0.875rem;
		color: var(--color-text-subtle);
	}
</style>
