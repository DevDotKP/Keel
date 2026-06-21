<script lang="ts">
	import Spinner from '$lib/components/Spinner.svelte';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { installPrompt } from '$lib/stores/install';
	import { INDIAN_STATES } from '$lib/holidays';

	let { data }: { data: PageData } = $props();

	let saving = $state(false);
	let error = $state<string | null>(null);

	// Derived: show payday input only when cadence is monthly and harbour_day looks numeric.
	let currentCadence = $derived(data.settings?.harbour_cadence ?? 'monthly');
	let currentHarbourDay = $derived(data.settings?.harbour_day ?? 'sunday');
	let paydayAligned = $derived(
		currentCadence === 'monthly' && /^\d+$/.test(currentHarbourDay)
	);
	let paydayDayValue = $derived(paydayAligned ? currentHarbourDay : '');

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
		// When switching away from monthly, clear any payday alignment.
		if (cadence !== 'monthly') {
			await patch({ harbour_cadence: cadence, harbour_day: 'sunday' });
		} else {
			await patch({ harbour_cadence: cadence });
		}
	}

	async function handlePaydayToggle(checked: boolean) {
		if (checked) {
			await patch({ harbour_day: '25' });
		} else {
			await patch({ harbour_day: 'sunday' });
		}
	}

	async function handlePaydayDayChange(day: string) {
		const n = parseInt(day, 10);
		if (isNaN(n) || n < 1 || n > 28) return;
		await patch({ harbour_day: String(n) });
	}

	async function handleNotifyTimeChange(time: string) {
		await patch({ harbour_notify_at: time });
	}

	async function handleStateChange(state: string) {
		if (!state) return;
		await patch({ home_state: state });
	}

	function ordinal(n: number): string {
		const s = ['th', 'st', 'nd', 'rd'];
		const v = n % 100;
		return s[(v - 20) % 10] ?? s[v] ?? s[0];
	}

	async function handleSignOut() {
		await fetch('/api/auth/signout', { method: 'POST' });
		location.href = '/auth';
	}

	// Household invite
	let inviteEmail = $state('');
	let inviteRole = $state<'admin' | 'member'>('member');
	let inviteBusy = $state(false);
	let inviteResult = $state<{ invite_url: string } | null>(null);
	let inviteError = $state<string | null>(null);

	async function sendInvite() {
		inviteBusy = true;
		inviteError = null;
		inviteResult = null;
		const res = await fetch('/api/household', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: inviteEmail, role: inviteRole })
		});
		inviteBusy = false;
		if (res.ok) {
			const data = await res.json() as { invite_url: string };
			inviteResult = data;
			inviteEmail = '';
			await invalidateAll();
		} else {
			const body = await res.json().catch(() => ({})) as { message?: string };
			inviteError = body.message ?? 'Could not send invite';
		}
	}
</script>

<svelte:head>
	<title>Settings - Keel</title>
</svelte:head>

<div class="settings-page">
	<h1 class="section-head">Settings</h1>

	<!-- Harbour cadence -->
	<section class="settings-section">
		<h2 class="settings-section-head">Harbour</h2>
		<div class="field">
			<label for="cadence">How often</label>
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
				<span class="toggle-label">Start periods on my payday</span>
			</label>
			{#if paydayAligned}
				<div class="field">
					<label for="payday-day">Payday — day of month</label>
					<select
						id="payday-day"
						value={paydayDayValue}
						onchange={(e) => handlePaydayDayChange(e.currentTarget.value)}
						disabled={saving}
					>
						{#each Array.from({ length: 28 }, (_, i) => i + 1) as day}
							<option value={String(day)}>{day}</option>
						{/each}
					</select>
					<p class="field-hint">Periods run from the {paydayDayValue}{ordinal(Number(paydayDayValue))} to the day before your next payday.</p>
				</div>
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
		{#if saving}
			<p class="saving-hint">
				<Spinner size={14} label="Saving" />
				<span>Saving…</span>
			</p>
		{/if}
	</section>

	<!-- Location: picks the bank-holiday calendar for recurring scheduling -->
	<section class="settings-section">
		<h2 class="settings-section-head">Location</h2>
		<p class="settings-hint">
			Your state. Keel uses it to skip bank holidays when scheduling recurring income.
		</p>
		<div class="field">
			<label for="home-state">State</label>
			<select
				id="home-state"
				value={data.settings?.home_state ?? ''}
				onchange={(e) => handleStateChange(e.currentTarget.value)}
				disabled={saving}
			>
				<option value="" disabled>Select your state</option>
				{#each INDIAN_STATES as st}
					<option value={st}>{st}</option>
				{/each}
			</select>
		</div>
	</section>

	<!-- Manage -->
	<section class="settings-section">
		<h2 class="settings-section-head">Manage</h2>
		<nav class="manage-links" aria-label="Manage">
			<a href="/categories" class="manage-link">
				<span>Categories</span>
				<span class="manage-chevron" aria-hidden="true">›</span>
			</a>
			<a href="/obligations" class="manage-link">
				<span>Recurring &amp; obligations</span>
				<span class="manage-chevron" aria-hidden="true">›</span>
			</a>
		</nav>
	</section>

	<!-- Install: shown only when the browser signals the app is installable -->
	{#if $installPrompt}
		<section class="settings-section">
			<h2 class="settings-section-head">App</h2>
			<p class="settings-hint">Add Keel to your home screen for faster access and offline use.</p>
			<button
				class="secondary-btn"
				onclick={async () => {
					const prompt = $installPrompt;
					if (!prompt) return;
					await prompt.prompt();
					installPrompt.set(null);
				}}
			>
				Add to home screen
			</button>
		</section>
	{/if}

	<!-- Household -->
	<section class="settings-section">
		<h2 class="settings-section-head">Household</h2>

		{#if data.members.length > 0}
			<ul class="member-list">
				{#each data.members as m}
					<li class="member-row">
						<span class="member-email">{m.email}</span>
						<span class="member-role">{m.role}</span>
						{#if m.user_id === data.currentUserId}
							<span class="member-you">you</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		{#if data.pendingInvites.length > 0}
			<p class="settings-hint">Pending: {data.pendingInvites.map(i => i.email).join(', ')}</p>
		{/if}

		<!-- Invite form: only for admins -->
		{#if data.members.find(m => m.user_id === data.currentUserId)?.role === 'admin'}
			<div class="invite-row">
				<input
					type="email"
					placeholder="Email to invite"
					bind:value={inviteEmail}
					class="invite-input"
					disabled={inviteBusy}
				/>
				<select bind:value={inviteRole} class="invite-role" disabled={inviteBusy}>
					<option value="member">Member</option>
					<option value="admin">Admin</option>
				</select>
				<button class="secondary-btn" onclick={sendInvite} disabled={inviteBusy || !inviteEmail}>
					{inviteBusy ? 'Sending…' : 'Invite'}
				</button>
			</div>
			{#if inviteError}
				<p class="error" role="alert">{inviteError}</p>
			{/if}
			{#if inviteResult}
				{@const fullLink = `${window.location.origin}${inviteResult.invite_url}`}
				<p class="invite-link-hint">
					Share this link with {inviteEmail || 'the invitee'}:
				</p>
				<div class="invite-link-row">
					<code class="invite-link">{fullLink}</code>
					<button
						class="copy-btn"
						onclick={() => navigator.clipboard.writeText(fullLink)}
						aria-label="Copy invite link"
					>
						Copy
					</button>
				</div>
			{/if}
		{/if}
	</section>

	<!-- Export -->
	<section class="settings-section">
		<h2 class="settings-section-head">Your data</h2>
		<p class="settings-hint">Your data belongs to you. Export everything at any time.</p>
		<div class="export-row">
			<a href="/api/export?format=csv" class="export-btn" download>Export CSV</a>
			<a href="/api/export?format=json" class="export-btn" download>Export JSON</a>
		</div>
	</section>

	<!-- Account -->
	<section class="settings-section">
		<h2 class="settings-section-head">Account</h2>
		<p class="settings-hint">Signed in as <strong>{data.user?.email || 'user'}</strong>. No password needed.</p>
		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}
		<button class="secondary-btn" onclick={handleSignOut} disabled={saving}>Sign out</button>
	</section>

	<!-- Attribution -->
	<footer class="settings-footer">
		<p>Keel by <a href="https://annapurnalabs.in">Annapurna Labs</a></p>
		<nav aria-label="Legal links">
			<a href="/legal/terms">Terms</a>
			<a href="/legal/privacy">Privacy</a>
			<a href="/legal/refund">Refund</a>
			<a href="/legal/contact">Contact</a>
		</nav>
		<p class="copyright">© 2026 Annapurna Labs. All rights reserved.</p>
	</footer>
</div>

<style>
	.settings-page {
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-8);
		padding-bottom: calc(var(--space-6) + var(--nav-height));
	}

	.settings-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.settings-section-head {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.settings-hint {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
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
	.field input {
		height: 44px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 1rem;
		color: var(--color-text);
	}

	.field select:focus,
	.field input:focus {
		outline: none;
		border-color: var(--color-gold);
	}

	.field select:disabled,
	.field input:disabled {
		opacity: 0.5;
	}

	.saving-hint {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.manage-links {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.manage-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) var(--space-4);
		min-height: var(--tap-target);
		color: var(--color-text);
		text-decoration: none;
		border-bottom: 1px solid var(--color-border);
		font-size: 0.9375rem;
		transition: background var(--duration-fast) var(--ease-out);
	}

	.manage-link:last-child {
		border-bottom: none;
	}

	.manage-link:hover {
		background: var(--color-surface-subtle);
	}

	.manage-chevron {
		color: var(--color-text-subtle);
		font-size: 1.25rem;
	}

	.export-row {
		display: flex;
		gap: var(--space-3);
	}

	.export-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 44px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		text-decoration: none;
		font-weight: 500;
		font-size: 0.9375rem;
		transition: background var(--duration-fast) var(--ease-out);
	}

	.export-btn:hover {
		background: var(--color-surface-subtle);
	}

	.secondary-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 44px;
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		font-weight: 500;
		cursor: pointer;
		transition: background var(--duration-fast) var(--ease-out);
	}

	.secondary-btn:hover {
		background: var(--color-surface-subtle);
	}

	.secondary-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error {
		color: var(--color-clay);
		font-size: 0.875rem;
	}

	.settings-footer {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-border);
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.settings-footer nav {
		display: flex;
		gap: var(--space-4);
	}

	.settings-footer a {
		color: var(--color-text-muted);
		text-underline-offset: 3px;
	}

	.copyright {
		color: var(--color-text-subtle);
		font-size: 0.8125rem;
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

	.field-hint {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
		margin-top: calc(var(--space-2) * -0.5);
	}

	.member-list {
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.member-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-border);
		font-size: 0.9375rem;
	}

	.member-row:last-child { border-bottom: none; }

	.member-email {
		flex: 1;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.member-role {
		flex: none;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-subtle);
	}

	.member-you {
		flex: none;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		font-style: italic;
	}

	.invite-row {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.invite-input {
		flex: 1;
		min-width: 160px;
		height: 40px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 0.9375rem;
		color: var(--color-text);
	}

	.invite-input:focus { outline: none; border-color: var(--color-gold); }

	.invite-role {
		height: 40px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 0.9375rem;
		color: var(--color-text);
	}

	.invite-link-hint {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		line-height: 1.6;
	}

	.invite-link-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-1);
	}

	.invite-link {
		flex: 1;
		min-width: 0;
		display: block;
		font-size: 0.8125rem;
		background: var(--color-surface-subtle);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		word-break: break-all;
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.copy-btn {
		flex: none;
		height: 36px;
		padding: 0 var(--space-3);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		cursor: pointer;
		font-family: inherit;
		white-space: nowrap;
	}

	.copy-btn:hover {
		color: var(--color-text);
		border-color: var(--color-text-subtle);
	}
</style>
