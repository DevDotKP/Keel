<script lang="ts">
	import { untrack } from 'svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { Tags, CalendarClock } from 'lucide-svelte';
	import MenuLink from '$lib/components/MenuLink.svelte';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { installPrompt } from '$lib/stores/install';
	import { INDIAN_STATES } from '$lib/holidays';
	import Combobox from '$lib/components/Combobox.svelte';

	let { data }: { data: PageData } = $props();

	const stateOptions = INDIAN_STATES.map((s) => ({ value: s, label: s }));

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

	// ── Profile (display name + avatar) ──────────────────────────────────────
	let displayName = $state(untrack(() => data.user?.display_name ?? ''));
	let avatarBusy = $state(false);
	let profileError = $state<string | null>(null);

	async function patchProfile(fields: Record<string, unknown>): Promise<boolean> {
		const res = await fetch('/api/profile', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(fields)
		});
		if (!res.ok) {
			profileError = 'Could not save. Try again.';
			return false;
		}
		await invalidateAll();
		return true;
	}

	async function saveDisplayName() {
		profileError = null;
		const name = displayName.trim();
		if (name === (data.user?.display_name ?? '')) return;
		await patchProfile({ display_name: name || null });
	}

	// Resize a chosen image to a small centered square and return a JPEG data URL.
	function resizeToDataUrl(file: File, size: number, quality: number): Promise<string> {
		// Read as a data: URL (allowed by CSP) rather than a blob: object URL,
		// which the img-src 'self' data: policy blocks.
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onerror = () => reject(new Error('read'));
			reader.onload = () => {
				const img = new Image();
				img.onload = () => {
					const canvas = document.createElement('canvas');
					canvas.width = size;
					canvas.height = size;
					const ctx = canvas.getContext('2d');
					if (!ctx) return reject(new Error('no-canvas'));
					const min = Math.min(img.width, img.height);
					ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
					resolve(canvas.toDataURL('image/jpeg', quality));
				};
				img.onerror = () => reject(new Error('decode'));
				img.src = reader.result as string;
			};
			reader.readAsDataURL(file);
		});
	}

	async function onAvatarFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = ''; // allow re-selecting the same file later
		if (!file) return;
		profileError = null;
		if (!file.type.startsWith('image/')) {
			profileError = 'Choose an image file.';
			return;
		}
		if (file.size > 8 * 1024 * 1024) {
			profileError = 'Image too large. Max 8 MB.';
			return;
		}
		avatarBusy = true;
		try {
			let dataUrl = await resizeToDataUrl(file, 128, 0.82);
			if (dataUrl.length > 200_000) dataUrl = await resizeToDataUrl(file, 96, 0.7);
			if (dataUrl.length > 200_000) {
				profileError = 'Could not compress the image enough. Try another.';
			} else {
				await patchProfile({ avatar: dataUrl });
			}
		} catch {
			profileError = 'Could not read that image. Try a JPEG or PNG.';
		}
		avatarBusy = false;
	}

	async function removeAvatar() {
		avatarBusy = true;
		profileError = null;
		await patchProfile({ avatar: null });
		avatarBusy = false;
	}

	function initials(name: string | null | undefined, email: string | null | undefined): string {
		const base = (name && name.trim()) || (email ? email.split('@')[0] : '');
		const parts = base.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) return '?';
		if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

	<!-- Manage: the most-used destinations, lifted to the top -->
	<section class="settings-section">
		<nav class="manage-links" aria-label="Manage">
			<MenuLink href="/categories" title="Categories" sub="Spending and income categories, budgets, colours">
				{#snippet icon()}<Tags size={20} />{/snippet}
			</MenuLink>
			<MenuLink href="/obligations" title="Recurring &amp; income" sub="Rent, bills, EMIs, and recurring income">
				{#snippet icon()}<CalendarClock size={20} />{/snippet}
			</MenuLink>
		</nav>
	</section>

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
			<Combobox
				id="home-state"
				options={stateOptions}
				value={data.settings?.home_state ?? ''}
				placeholder="Search your state"
				disabled={saving}
				onchange={handleStateChange}
			/>
		</div>
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
						<span class="avatar" aria-hidden="true">
							{#if m.avatar}<img src={m.avatar} alt="" class="avatar-img" />{:else}{initials(m.display_name, m.email)}{/if}
						</span>
						<span class="member-main">
							<span class="member-name">{m.display_name || (m.email ?? '').split('@')[0]}</span>
							<span class="member-email-sub">{m.email}</span>
						</span>
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
			<p class="settings-hint">
				Admins can invite and manage the household. Members can add and view entries.
			</p>

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

	<!-- Profile -->
	<section class="settings-section">
		<h2 class="settings-section-head">Profile</h2>
		<div class="profile-row">
			<span class="avatar avatar--lg" aria-hidden="true">
				{#if data.user?.avatar}
					<img src={data.user.avatar} alt="" class="avatar-img" />
				{:else}
					{initials(data.user?.display_name, data.user?.email)}
				{/if}
			</span>
			<div class="profile-actions">
				<label class="secondary-btn avatar-btn">
					{avatarBusy ? 'Saving…' : data.user?.avatar ? 'Change photo' : 'Add photo'}
					<input type="file" accept="image/*" onchange={onAvatarFile} disabled={avatarBusy} hidden />
				</label>
				{#if data.user?.avatar}
					<button class="link-btn" onclick={removeAvatar} disabled={avatarBusy}>Remove</button>
				{/if}
			</div>
		</div>
		<p class="settings-hint">A square photo works best. Max 8 MB; it is resized small and stored privately.</p>
		<div class="field">
			<label for="display-name">Display name</label>
			<input
				id="display-name"
				type="text"
				placeholder="Your name"
				bind:value={displayName}
				onblur={saveDisplayName}
				maxlength="60"
			/>
		</div>
		{#if profileError}
			<p class="error" role="alert">{profileError}</p>
		{/if}
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

	.avatar {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--color-text) 10%, transparent);
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		font-weight: 600;
		overflow: hidden;
		text-transform: uppercase;
	}

	.avatar--lg {
		width: 64px;
		height: 64px;
		font-size: 1.25rem;
	}

	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.profile-row {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	.profile-actions {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.avatar-btn {
		cursor: pointer;
	}

	.link-btn {
		background: none;
		border: none;
		padding: 0;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
		font-family: inherit;
	}

	.link-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.member-main {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
		min-width: 0;
	}

	.member-name {
		font-size: 0.9375rem;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.member-email-sub {
		font-size: 0.75rem;
		color: var(--color-text-subtle);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
