<script lang="ts">
	import { onMount } from 'svelte';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Combobox from '$lib/components/Combobox.svelte';
	import { invalidateAll } from '$app/navigation';
	import { INDIAN_STATES } from '$lib/holidays';
	import {
		isPushSupported,
		iosNeedsInstall,
		isSubscribed,
		subscribeToPush,
		unsubscribeFromPush
	} from '$lib/utils/push';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const stateOptions = INDIAN_STATES.map((s) => ({ value: s, label: s }));

	let saving = $state(false);
	let error = $state<string | null>(null);

	let currentCadence = $derived(data.settings?.harbour_cadence ?? 'monthly');
	let currentHarbourDay = $derived(data.settings?.harbour_day ?? 'sunday');
	const isPaydayAnchor = (d: string) =>
		d === 'last_working_day' || d === 'first_working_day' || /^\d+$/.test(d);
	let paydayAligned = $derived(currentCadence === 'monthly' && isPaydayAnchor(currentHarbourDay));
	let paydayAnchor = $derived(/^\d+$/.test(currentHarbourDay) ? 'specific' : currentHarbourDay);
	let paydayDayValue = $derived(/^\d+$/.test(currentHarbourDay) ? currentHarbourDay : '25');

	let cycleAdvancedOpen = $state(false);

	async function patch(fields: Record<string, unknown>) {
		saving = true;
		error = null;
		const res = await fetch('/api/settings', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(fields)
		});
		saving = false;
		if (!res.ok) error = 'Could not save. Try again.';
		else await invalidateAll();
	}

	async function handleCadenceChange(cadence: string) {
		if (cadence !== 'monthly') {
			await patch({ harbour_cadence: cadence, harbour_day: 'sunday' });
		} else {
			await patch({ harbour_cadence: cadence });
		}
	}

	async function handlePaydayToggle(checked: boolean) {
		await patch({ harbour_day: checked ? 'last_working_day' : 'sunday' });
	}

	async function handlePaydayAnchorChange(anchor: string) {
		await patch({ harbour_day: anchor === 'specific' ? '25' : anchor });
	}

	async function handlePaydayDayChange(day: string) {
		const n = parseInt(day, 10);
		if (isNaN(n) || n < 1 || n > 31) return;
		await patch({ harbour_day: String(n) });
	}

	async function handleNotifyTimeChange(time: string) {
		await patch({ harbour_notify_at: time });
	}

	async function handleStateChange(state: string) {
		if (!state) return;
		await patch({ home_state: state });
	}

	async function handleRolloverChange(policy: string) {
		await patch({ budget_rollover: policy });
	}

	// ── Notifications ────────────────────────────────────────────────────────
	let pushSupported = $state(false);
	let pushSubscribed = $state(false);
	let pushBusy = $state(false);
	let pushMsg = $state<string | null>(null);
	let needsInstall = $state(false);

	onMount(async () => {
		pushSupported = isPushSupported() && !!data.vapidPublicKey;
		needsInstall = iosNeedsInstall();
		if (pushSupported) pushSubscribed = await isSubscribed();
	});

	async function togglePush() {
		pushBusy = true;
		pushMsg = null;
		if (pushSubscribed) {
			await unsubscribeFromPush();
			pushSubscribed = false;
		} else {
			const r = await subscribeToPush(data.vapidPublicKey ?? '');
			if (r === 'ok') pushSubscribed = true;
			else if (r === 'denied')
				pushMsg = 'Notifications are blocked. Allow them in your browser settings.';
			else pushMsg = "Couldn't enable notifications. Try again.";
		}
		pushBusy = false;
	}
</script>

<svelte:head>
	<title>Money cycle - Keel</title>
</svelte:head>

<div class="cycle-page">
	<div class="page-nav">
		<a href="/settings" class="back-btn" aria-label="Back to Settings">
			<ChevronLeft size={20} aria-hidden="true" />
			Settings
		</a>
	</div>

	<h1 class="page-head">Money cycle</h1>

	<div class="field">
		<label for="cadence">Harbour cadence</label>
		<select
			id="cadence"
			value={currentCadence}
			onchange={(e) => handleCadenceChange(e.currentTarget.value)}
			disabled={saving}
		>
			<option value="weekly">Weekly</option>
			<option value="fortnightly">Fortnightly</option>
			<option value="monthly">Monthly</option>
		</select>
	</div>

	{#if currentCadence === 'monthly'}
		<label class="toggle-row">
			<input
				type="checkbox"
				class="toggle-check"
				checked={paydayAligned}
				onchange={(e) => handlePaydayToggle(e.currentTarget.checked)}
				disabled={saving}
			/>
			<span class="toggle-label">Start cycles on my payday</span>
		</label>
		{#if paydayAligned}
			<div class="field">
				<label for="payday-anchor">When you're paid</label>
				<select
					id="payday-anchor"
					value={paydayAnchor}
					onchange={(e) => handlePaydayAnchorChange(e.currentTarget.value)}
					disabled={saving}
				>
					<option value="last_working_day">Last working day</option>
					<option value="first_working_day">First working day</option>
					<option value="specific">A specific date</option>
				</select>
			</div>
			{#if paydayAnchor === 'specific'}
				<div class="field">
					<label for="payday-day">Day of month</label>
					<select
						id="payday-day"
						value={paydayDayValue}
						onchange={(e) => handlePaydayDayChange(e.currentTarget.value)}
						disabled={saving}
					>
						{#each Array.from({ length: 31 }, (_, i) => i + 1) as day}
							<option value={String(day)}>{day}</option>
						{/each}
					</select>
					<p class="field-hint">Shorter months fall back to the last day.</p>
				</div>
			{/if}
			<p class="field-hint">Skips weekends and bank holidays to land on a real payday.</p>
		{/if}
	{/if}

	<div class="field">
		<label for="notify-time">Remind me at</label>
		<input
			id="notify-time"
			type="time"
			value={data.settings?.harbour_notify_at ?? '20:00'}
			onchange={(e) => handleNotifyTimeChange(e.currentTarget.value)}
			disabled={saving}
		/>
	</div>

	<button
		class="advanced-toggle"
		onclick={() => (cycleAdvancedOpen = !cycleAdvancedOpen)}
		aria-expanded={cycleAdvancedOpen}
	>
		{cycleAdvancedOpen ? 'Fewer options' : 'More options'}
		<span class="advanced-chevron" class:open={cycleAdvancedOpen} aria-hidden="true">
			<ChevronRight size={14} />
		</span>
	</button>

	{#if cycleAdvancedOpen}
		<div class="inline-row">
			<label class="inline-label" for="rollover">When a cycle ends</label>
			<select
				id="rollover"
				class="inline-select"
				value={data.settings?.budget_rollover ?? 'fresh'}
				onchange={(e) => handleRolloverChange(e.currentTarget.value)}
				disabled={saving}
			>
				<option value="fresh">Start fresh</option>
				<option value="surplus">Carry unspent forward</option>
				<option value="deficit">Carry overspending forward</option>
			</select>
		</div>

		<div class="inline-row">
			<label class="inline-label" for="home-state">Your state</label>
			<div class="inline-combobox">
				<Combobox
					id="home-state"
					options={stateOptions}
					value={data.settings?.home_state ?? ''}
					placeholder="For holiday calendar"
					disabled={saving}
					onchange={handleStateChange}
				/>
			</div>
		</div>
	{/if}

	{#if saving}
		<p class="saving-hint"><Spinner size={14} label="Saving" /><span>Saving…</span></p>
	{/if}

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	<!-- Notifications -->
	{#if pushSupported || needsInstall}
		<div class="section-rule"></div>
		{#if needsInstall && !pushSubscribed}
			<p class="field-hint">On iPhone, add Keel to your Home Screen first, then enable notifications.</p>
		{/if}
		<div class="notify-row">
			<div class="notify-text">
				<span class="notify-title">Notifications</span>
				<span class="field-hint">One reminder per cycle. A ping when someone adds an entry.</span>
			</div>
			<button
				type="button"
				class="secondary-btn"
				onclick={togglePush}
				disabled={pushBusy || (!pushSupported && needsInstall)}
			>
				{pushBusy ? 'Working…' : pushSubscribed ? 'Turn off' : 'Turn on'}
			</button>
		</div>
		{#if pushSubscribed}
			<label class="toggle-row">
				<input type="checkbox"
					class="toggle-check"
					checked={(data.settings?.notify_harbour ?? 1) === 1}
					onchange={(e) => patch({ notify_harbour: e.currentTarget.checked ? 1 : 0 })}
				/>
				<span class="toggle-label">Harbour reminder, once per cycle</span>
			</label>
			<label class="toggle-row">
				<input type="checkbox"
					class="toggle-check"
					checked={(data.settings?.notify_partner ?? 1) === 1}
					onchange={(e) => patch({ notify_partner: e.currentTarget.checked ? 1 : 0 })}
				/>
				<span class="toggle-label">When a household member adds an entry</span>
			</label>
		{/if}
		{#if pushMsg}
			<p class="error" role="alert">{pushMsg}</p>
		{/if}
	{/if}
</div>

<style>
	.cycle-page {
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		max-width: 600px;
		margin: 0 auto;
		padding-bottom: calc(var(--space-6) + var(--nav-height));
	}

	.page-nav {
		margin-bottom: var(--space-2);
	}

	.back-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--color-text-muted);
		text-decoration: none;
		font-size: 0.9375rem;
		min-height: var(--tap-target);
	}

	.back-btn:hover { color: var(--color-text); }

	.page-head {
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-text);
		margin-bottom: var(--space-2);
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

	.field select,
	.field input[type="time"] {
		height: 44px;
		padding: 0 var(--space-8) 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: var(--color-surface);
		font-size: 1rem;
		color: var(--color-text);
		font-family: inherit;
	}

	.field select:focus,
	.field input:focus { outline: none; border-color: var(--color-gold); }
	.field select:disabled,
	.field input:disabled { opacity: 0.5; }

	.field-hint {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
	}

	.toggle-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		cursor: pointer;
		min-height: var(--tap-target);
	}

	.toggle-check {
		width: 18px;
		height: 18px;
		flex: none;
		accent-color: var(--color-gold);
		cursor: pointer;
	}

	.toggle-label {
		font-size: 0.9375rem;
		color: var(--color-text);
	}

	.inline-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		min-height: var(--tap-target);
	}

	.inline-label {
		font-size: 0.9375rem;
		color: var(--color-text);
		flex: 1;
	}

	.inline-select {
		height: 36px;
		padding: 0 var(--space-7) 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: var(--color-surface);
		font-size: 0.875rem;
		color: var(--color-text);
		max-width: 60%;
		font-family: inherit;
	}

	.inline-combobox { flex: 0 0 55%; }

	.advanced-toggle {
		background: none;
		border: none;
		padding: 0;
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
		cursor: pointer;
		font-family: inherit;
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
	}

	.advanced-toggle:hover { color: var(--color-text-muted); }

	.advanced-chevron {
		display: inline-flex;
		align-items: center;
		transition: transform var(--duration-fast) var(--ease-out);
	}

	.advanced-chevron.open { transform: rotate(90deg); }

	.section-rule {
		height: 1px;
		background: var(--color-border);
		margin: var(--space-1) 0;
	}

	.saving-hint {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.error { color: var(--color-clay); font-size: 0.875rem; }

	.notify-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		flex-wrap: wrap;
	}

	.notify-text {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		flex: 1 1 200px;
	}

	.notify-title {
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--color-text);
	}

	.secondary-btn {
		flex: none;
		height: 36px;
		padding: 0 var(--space-4);
		background: var(--color-surface-subtle);
		color: var(--color-text);
		font-weight: 600;
		font-size: 0.875rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-family: inherit;
		transition: border-color var(--duration-fast) var(--ease-out);
	}

	.secondary-btn:hover { border-color: var(--color-text-subtle); }
	.secondary-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
