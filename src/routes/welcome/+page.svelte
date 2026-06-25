<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { Anchor } from 'lucide-svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { formatAmountInput } from '$lib/utils/money';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Seed editable form state from the loaded defaults once.
	let balance = $state('');
	let cadence = $state<'weekly' | 'fortnightly' | 'monthly'>(untrack(() => data.cadence ?? 'monthly'));
	let payday = $state(
		untrack(() => {
			const d = data.harbourDay ?? '';
			return /^\d+$/.test(d) || d === 'last_working_day' || d === 'first_working_day';
		})
	);
	let paydayAnchor = $state(
		untrack(() => {
			const d = data.harbourDay ?? '';
			if (d === 'first_working_day') return 'first_working_day';
			if (/^\d+$/.test(d)) return 'specific';
			return 'last_working_day';
		})
	);
	let paydayDay = $state(untrack(() => (/^\d+$/.test(data.harbourDay ?? '') ? Number(data.harbourDay) : 25)));
	let submitting = $state(false);

	const CADENCES: Array<{ value: typeof cadence; label: string }> = [
		{ value: 'weekly', label: 'Weekly' },
		{ value: 'fortnightly', label: 'Fortnightly' },
		{ value: 'monthly', label: 'Monthly' }
	];
</script>

<svelte:head>
	<title>Welcome - Keel</title>
</svelte:head>

<div class="welcome">
	<header class="welcome-head">
		<span class="brand-mark" aria-hidden="true"><Anchor size={22} /></span>
		<h1 class="welcome-title">Welcome to Keel</h1>
		<p class="welcome-meaning">A keel keeps a boat steady. You will come to Harbour now and then to settle up.</p>
		<p class="welcome-sub">Two quick things, so your numbers are real from day one.</p>
	</header>

	<form
		method="POST"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		<!-- Starting balance: the anchor. -->
		<section class="field field--hero">
			<label for="balance">What's in your spending account right now?</label>
			<div class="amount-row">
				<span class="currency-symbol" aria-hidden="true">₹</span>
				<input
					id="balance"
					name="balance"
					type="text"
					inputmode="decimal"
					placeholder="0"
					value={balance}
					oninput={(e) => (balance = formatAmountInput(e.currentTarget.value))}
					class="amount-input money"
					autocomplete="off"
				/>
			</div>
			<p class="field-hint">An estimate is fine. You can square it up anytime at Harbour.</p>
		</section>

		<!-- Cadence: when the Harbour reckoning lands. -->
		<section class="field">
			<span class="field-label">How often do you want to settle up?</span>
			<input type="hidden" name="cadence" value={cadence} />
			<div class="seg" role="radiogroup" aria-label="How often to settle up">
				{#each CADENCES as c (c.value)}
					<button
						type="button"
						class="seg-option"
						class:active={cadence === c.value}
						aria-pressed={cadence === c.value}
						onclick={() => (cadence = c.value)}
					>
						{c.label}
					</button>
				{/each}
			</div>
		</section>

		{#if cadence === 'monthly'}
			<label class="toggle-row">
				<input type="checkbox" name="payday" class="toggle-check" bind:checked={payday} />
				<span class="toggle-label">Start each cycle on my payday</span>
			</label>
			{#if payday}
				<section class="field">
					<label for="payday_anchor">When you're paid</label>
					<select id="payday_anchor" name="payday_anchor" bind:value={paydayAnchor}>
						<option value="last_working_day">Last working day of the month</option>
						<option value="first_working_day">First working day of the month</option>
						<option value="specific">A specific date</option>
					</select>
				</section>
				{#if paydayAnchor === 'specific'}
					<section class="field">
						<label for="payday_day">Day of month</label>
						<select id="payday_day" name="payday_day" bind:value={paydayDay}>
							{#each Array.from({ length: 31 }, (_, i) => i + 1) as day (day)}
								<option value={day}>{day}</option>
							{/each}
						</select>
					</section>
				{/if}
				<p class="field-hint">Keel starts your cycle then, skipping weekends so it lands on a real payday.</p>
			{/if}
		{/if}

		{#if form?.message}
			<p class="error" role="alert">{form.message}</p>
		{/if}

		<button type="submit" class="primary-btn" disabled={submitting}>
			{#if submitting}<Spinner size={18} label="Saving" />{:else}Start tracking{/if}
		</button>
		<button type="submit" name="skip" value="1" class="skip-btn" disabled={submitting}>
			Skip for now
		</button>
	</form>
</div>

<style>
	.welcome {
		max-width: 440px;
		margin: 0 auto;
		padding: var(--space-8) var(--space-6) calc(var(--space-8) + var(--nav-height));
		display: flex;
		flex-direction: column;
		gap: var(--space-8);
	}

	.welcome-head {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.brand-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: var(--radius-full);
		background: var(--color-surface-subtle);
		color: var(--color-gold);
		margin-bottom: var(--space-2);
	}

	.welcome-title {
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-text);
		line-height: 1.1;
	}

	.welcome-meaning {
		font-size: 0.9375rem;
		color: var(--color-text);
		line-height: 1.5;
	}

	.welcome-sub {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.field label,
	.field-label {
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--color-text-muted);
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
		min-width: 0;
		color: var(--color-gold);
	}

	.amount-input:focus {
		outline: none;
		border-bottom-color: var(--color-gold);
	}

	.field-hint {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
	}

	.seg {
		display: flex;
		gap: var(--space-2);
	}

	.seg-option {
		flex: 1;
		height: 44px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
		transition:
			border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.seg-option.active {
		border-color: var(--color-text);
		color: var(--color-text);
		font-weight: 600;
		background: var(--color-surface-subtle);
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

	.field select {
		height: 44px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: var(--color-surface);
		font-size: 1rem;
		color: var(--color-text);
	}

	.field select:focus {
		outline: none;
		border-color: var(--color-gold);
	}

	.error {
		color: var(--color-clay);
		font-size: 0.875rem;
	}

	.primary-btn {
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
	}

	.primary-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.skip-btn {
		align-self: center;
		background: none;
		border: none;
		padding: var(--space-2);
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
		font-family: inherit;
	}

	.skip-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* room for the global select chevron */
	.field select {
		padding-right: var(--space-8);
	}
</style>
