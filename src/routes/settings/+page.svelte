<script lang="ts">
	import { onMount } from 'svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { Tags, CalendarClock, TrendingUp, Trash2, X, ChevronRight, Users } from 'lucide-svelte';
	import MenuLink from '$lib/components/MenuLink.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { installPrompt } from '$lib/stores/install';
	import { INDIAN_STATES } from '$lib/holidays';
	import Combobox from '$lib/components/Combobox.svelte';
	import {
		isPushSupported,
		iosNeedsInstall,
		isSubscribed,
		subscribeToPush,
		unsubscribeFromPush
	} from '$lib/utils/push';

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

	function replayTour() {
		try { localStorage.removeItem('keel_tour_v1'); } catch { /* ignore */ }
		location.href = '/';
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

	async function handlePortfolioToggle(checked: boolean) {
		await patch({ show_portfolio: checked ? 1 : 0 });
	}

	async function handleRolloverChange(policy: string) {
		await patch({ budget_rollover: policy });
	}

	// ── Household ─────────────────────────────────────────────────────────────
	let isAdmin = $derived(
		data.members.find((m) => m.user_id === data.currentUserId)?.role === 'admin'
	);
	let adminCount = $derived(data.members.filter((m) => m.role === 'admin').length);
	let memberBusyId = $state<string | null>(null);
	let removeMember = $state<{ id: string; name: string } | null>(null);
	let copiedInviteId = $state<string | null>(null);

	let inviteOpen = $state(false);
	let inviteEmail = $state('');
	let inviteRole = $state<'admin' | 'member'>('member');
	let inviteBusy = $state(false);
	let inviteResult = $state<{ invite_url: string } | null>(null);
	let inviteError = $state<string | null>(null);

	async function changeRole(memberId: string, role: string) {
		memberBusyId = memberId;
		inviteError = null;
		const res = await fetch(`/api/household/members/${memberId}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ role })
		});
		memberBusyId = null;
		if (res.ok) await invalidateAll();
		else {
			const b = (await res.json().catch(() => ({}))) as { message?: string };
			inviteError = b.message ?? 'Could not update the role.';
		}
	}

	async function doRemoveMember(id: string) {
		memberBusyId = id;
		inviteError = null;
		const res = await fetch(`/api/household/members/${id}`, { method: 'DELETE' });
		memberBusyId = null;
		removeMember = null;
		if (res.ok) await invalidateAll();
		else {
			const b = (await res.json().catch(() => ({}))) as { message?: string };
			inviteError = b.message ?? 'Could not remove the member.';
		}
	}

	async function revokeInvite(id: string) {
		const res = await fetch(`/api/household/invites/${id}`, { method: 'DELETE' });
		if (res.ok) await invalidateAll();
	}

	function copyInviteLink(token: string, id: string) {
		navigator.clipboard.writeText(`${window.location.origin}/join?token=${token}`);
		copiedInviteId = id;
		setTimeout(() => { if (copiedInviteId === id) copiedInviteId = null; }, 1500);
	}

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
			const body = await res.json() as { invite_url: string };
			inviteResult = body;
			inviteEmail = '';
			await invalidateAll();
		} else {
			const body = await res.json().catch(() => ({})) as { message?: string };
			inviteError = body.message ?? 'Could not send invite';
		}
	}

	function initials(name: string | null | undefined, email: string | null | undefined): string {
		const base = (name && name.trim()) || (email ? email.split('@')[0] : '');
		const parts = base.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) return '?';
		if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	}
</script>

<svelte:head>
	<title>Settings - Keel</title>
</svelte:head>

<div class="settings-page">
	<h1 class="page-head">Settings</h1>

	<!-- Profile nav row -->
	<a href="/settings/profile" class="profile-row">
		<span class="avatar" aria-hidden="true">
			{#if data.user?.avatar}
				<img src={data.user.avatar} alt="" class="avatar-img" />
			{:else}
				{initials(data.user?.display_name, data.user?.email)}
			{/if}
		</span>
		<span class="profile-row-text">
			<span class="profile-row-name">
				{data.user?.display_name || data.user?.email?.split('@')[0] || 'You'}
			</span>
			<span class="profile-row-email">{data.user?.email || ''}</span>
		</span>
		<ChevronRight size={18} class="profile-chevron" aria-hidden="true" />
	</a>

	<!-- Household -->
	<section class="household-card" aria-label="Your household">
		<div class="household-header">
			<span class="household-icon" aria-hidden="true"><Users size={18} /></span>
			<span class="household-title">Your household</span>
			{#if isAdmin}
				<button
					class="invite-trigger"
					onclick={() => { inviteOpen = !inviteOpen; inviteResult = null; inviteError = null; }}
					aria-expanded={inviteOpen}
				>
					{inviteOpen ? 'Cancel' : '+ Invite'}
				</button>
			{/if}
		</div>

		{#if data.members.length > 0}
			<ul class="member-list">
				{#each data.members as m}
					<li class="member-row">
						<span class="avatar" aria-hidden="true">
							{#if m.avatar}<img src={m.avatar} alt="" class="avatar-img" />{:else}{initials(m.display_name, m.email)}{/if}
						</span>
						<span class="member-main">
							<span class="member-name">
								{m.display_name || (m.email ?? '').split('@')[0]}
								{#if m.user_id === data.currentUserId}<span class="member-you">you</span>{/if}
							</span>
							<span class="member-sub">{m.email}</span>
						</span>
						{#if isAdmin && m.user_id !== data.currentUserId}
							{@const lastAdmin = m.role === 'admin' && adminCount <= 1}
							<select
								class="role-select"
								value={m.role}
								onchange={(e) => changeRole(m.id, e.currentTarget.value)}
								disabled={memberBusyId === m.id || lastAdmin}
								aria-label="Role for {m.display_name || m.email}"
							>
								<option value="member">Member</option>
								<option value="admin">Admin</option>
							</select>
							<button
								class="member-remove"
								onclick={() => (removeMember = { id: m.id, name: m.display_name || (m.email ?? '').split('@')[0] })}
								disabled={memberBusyId === m.id || lastAdmin}
								aria-label="Remove {m.display_name || m.email}"
							>
								<Trash2 size={16} aria-hidden="true" />
							</button>
						{:else}
							<span class="member-role-badge">{m.role}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		{#if data.pendingInvites.length > 0}
			<ul class="invite-list" aria-label="Pending invites">
				{#each data.pendingInvites as inv (inv.id)}
					<li class="invite-item">
						<span class="member-main">
							<span class="member-name">{inv.email}</span>
							<span class="member-sub">Invited · pending</span>
						</span>
						{#if isAdmin}
							<button class="copy-btn" onclick={() => copyInviteLink(inv.token, inv.id)}>
								{copiedInviteId === inv.id ? 'Copied' : 'Copy link'}
							</button>
							<button class="member-remove" onclick={() => revokeInvite(inv.id)} aria-label="Revoke invite for {inv.email}">
								<X size={16} aria-hidden="true" />
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		{#if data.members.length <= 1 && !inviteOpen && isAdmin}
			<p class="household-solo">Just you. Invite a partner or family member to share expenses.</p>
		{/if}

		{#if inviteOpen && isAdmin}
			<div class="invite-form">
				<div class="invite-row">
					<input
						type="email"
						placeholder="Email address"
						bind:value={inviteEmail}
						class="invite-input"
						disabled={inviteBusy}
					/>
					<select bind:value={inviteRole} class="invite-role" disabled={inviteBusy}>
						<option value="member">Member</option>
						<option value="admin">Admin</option>
					</select>
				</div>
				<button class="invite-send-btn" onclick={sendInvite} disabled={inviteBusy || !inviteEmail}>
					{inviteBusy ? 'Sending…' : 'Send invite'}
				</button>
				<p class="field-hint">Admins can invite and manage. Members can add and view entries.</p>
				{#if inviteError}
					<p class="error" role="alert">{inviteError}</p>
				{/if}
				{#if inviteResult}
					{@const fullLink = `${window.location.origin}${inviteResult.invite_url}`}
					<div class="invite-link-row">
						<code class="invite-link">{fullLink}</code>
						<button class="copy-btn" onclick={() => navigator.clipboard.writeText(fullLink)}>Copy</button>
					</div>
				{/if}
			</div>
		{/if}
	</section>

	<ConfirmDialog
		open={removeMember !== null}
		title="Remove member?"
		message={removeMember ? `${removeMember.name} will lose access to this household. Their past entries stay in the ledger.` : ''}
		confirmLabel="Remove"
		onconfirm={() => { const id = removeMember?.id; removeMember = null; if (id) doRemoveMember(id); }}
		oncancel={() => (removeMember = null)}
	/>

	<!-- Cycle & Harbour -->
	<section class="settings-section" aria-label="Your money cycle">
		<h2 class="section-head">Money cycle</h2>

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
	</section>

	<!-- Manage -->
	<section class="settings-section" aria-label="Manage">
		<h2 class="section-head">Manage</h2>
		<nav class="manage-links" aria-label="Manage">
			<MenuLink href="/categories" title="Categories" sub="Spending categories, budgets, colours">
				{#snippet icon()}<Tags size={20} />{/snippet}
			</MenuLink>
			<MenuLink href="/obligations" title="Recurring &amp; income" sub="Rent, bills, EMIs, and recurring income">
				{#snippet icon()}<CalendarClock size={20} />{/snippet}
			</MenuLink>
			{#if data.settings?.show_portfolio === 1}
				<MenuLink href="/portfolio" title="Portfolio" sub="Investments and value over time">
					{#snippet icon()}<TrendingUp size={20} />{/snippet}
				</MenuLink>
			{/if}
		</nav>
		<label class="toggle-row">
			<input
				type="checkbox"
				class="toggle-check"
				checked={data.settings?.show_portfolio === 1}
				onchange={(e) => handlePortfolioToggle(e.currentTarget.checked)}
				disabled={saving}
			/>
			<span class="toggle-label">Track investments</span>
		</label>
	</section>

	<!-- App -->
	<section class="settings-section" aria-label="App">
		<h2 class="section-head">App</h2>
		{#if $installPrompt}
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
		{/if}
		<div class="export-row">
			<a href="/api/export?format=csv" class="export-btn" download>Export CSV</a>
			<a href="/api/export?format=json" class="export-btn" download>Export JSON</a>
		</div>
		<button class="link-btn" onclick={replayTour}>Replay the intro tour</button>
	</section>

	<!-- About Keel -->
	<section class="about-keel" aria-label="About Keel">
		<div class="about-brand">
			<h2 class="about-wordmark">Keel</h2>
			<p class="about-tagline">The tracker that forgives.</p>
		</div>
		<p class="about-body">
			Log as you go. Come to Harbour to settle. A missed entry becomes uncategorized — never a broken total. Named for the part of a boat that keeps it steady.
		</p>
		<p class="about-maker">By <a href="https://annapurnalabs.in" class="about-link">Annapurna Labs</a></p>
		<nav class="about-legal" aria-label="Legal">
			<a href="/legal/terms">Terms</a>
			<span aria-hidden="true">·</span>
			<a href="/legal/privacy">Privacy</a>
			<span aria-hidden="true">·</span>
			<a href="/legal/refund">Refund</a>
			<span aria-hidden="true">·</span>
			<a href="/legal/contact">Contact</a>
		</nav>
		<p class="about-copy">© 2026 Annapurna Labs. All rights reserved.</p>
	</section>
</div>

<style>
	.settings-page {
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
		padding-bottom: calc(var(--space-6) + var(--nav-height));
		max-width: 600px;
		margin: 0 auto;
	}

	.page-head {
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-text);
	}

	/* Profile nav row */
	.profile-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		text-decoration: none;
		min-height: 64px;
		transition: border-color var(--duration-fast) var(--ease-out);
	}

	.profile-row:hover { border-color: var(--color-text-subtle); }

	.avatar {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--color-text) 10%, transparent);
		color: var(--color-text-muted);
		font-size: 0.875rem;
		font-weight: 600;
		overflow: hidden;
		text-transform: uppercase;
	}

	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.profile-row-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}

	.profile-row-name {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.profile-row-email {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.profile-row :global(.profile-chevron) {
		flex: none;
		color: var(--color-text-subtle);
	}

	/* Household */
	.household-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-5);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	.household-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.household-icon {
		display: flex;
		align-items: center;
		color: var(--color-text-muted);
		flex: none;
	}

	.household-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		flex: 1;
	}

	.invite-trigger {
		background: none;
		border: none;
		padding: var(--space-1) var(--space-2);
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-gold);
		cursor: pointer;
		font-family: inherit;
		min-height: var(--tap-target);
		display: flex;
		align-items: center;
	}

	.invite-trigger:hover { opacity: 0.8; }

	.household-solo {
		font-size: 0.875rem;
		color: var(--color-text-subtle);
		line-height: 1.5;
		padding: var(--space-2) 0;
	}

	.member-list,
	.invite-list {
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.member-row,
	.invite-item {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.member-row:last-child,
	.invite-item:last-child { border-bottom: none; }

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

	.member-you {
		font-size: 0.6875rem;
		color: var(--color-text-muted);
		font-style: italic;
		margin-left: var(--space-1);
	}

	.member-sub {
		font-size: 0.75rem;
		color: var(--color-text-subtle);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.member-role-badge {
		flex: none;
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-subtle);
		padding: 2px var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
	}

	.role-select {
		flex: none;
		width: auto;
		max-width: 110px;
		height: 36px;
		padding: 0 var(--space-6) 0 var(--space-2);
		font-size: 0.8125rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: var(--color-surface);
		color: var(--color-text);
	}

	.member-remove {
		flex: none;
		display: inline-flex;
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
		transition: opacity var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out);
	}

	.member-remove:hover:not(:disabled) { opacity: 1; color: var(--color-clay); }
	.member-remove:disabled { opacity: 0.2; cursor: not-allowed; }

	.invite-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-top: var(--space-2);
		border-top: 1px solid var(--color-border);
	}

	.invite-row {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.invite-input {
		flex: 1;
		min-width: 160px;
		height: 44px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: var(--color-surface);
		font-size: 0.9375rem;
		color: var(--color-text);
		font-family: inherit;
	}

	.invite-input:focus { outline: none; border-color: var(--color-gold); }

	.invite-role {
		height: 44px;
		padding: 0 var(--space-7) 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: var(--color-surface);
		font-size: 0.9375rem;
		color: var(--color-text);
	}

	.invite-send-btn {
		height: 44px;
		padding: 0 var(--space-5);
		background: var(--color-text);
		color: var(--color-surface);
		font-weight: 600;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-family: inherit;
		font-size: 0.9375rem;
		transition: opacity var(--duration-fast) var(--ease-out);
	}

	.invite-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

	.invite-link-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
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
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		cursor: pointer;
		font-family: inherit;
		white-space: nowrap;
	}

	.copy-btn:hover { color: var(--color-text); border-color: var(--color-text-subtle); }

	/* Section */
	.settings-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.section-head {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-subtle);
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

	/* Compact inline rows (label left, control right) */
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

	/* Notifications */
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

	/* Manage */
	.manage-links {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	/* Toggles */
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

	/* App section */
	.export-row { display: flex; gap: var(--space-3); }

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

	.export-btn:hover { background: var(--color-surface-subtle); }

	.secondary-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 44px;
		padding: 0 var(--space-4);
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		font-weight: 500;
		font-size: 0.9375rem;
		font-family: inherit;
		cursor: pointer;
		transition: background var(--duration-fast) var(--ease-out);
	}

	.secondary-btn:hover { background: var(--color-surface-subtle); }
	.secondary-btn:disabled { opacity: 0.5; cursor: not-allowed; }

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
		min-height: var(--tap-target);
		display: flex;
		align-items: center;
	}

	.link-btn:hover { color: var(--color-text); }

	/* About Keel */
	.about-keel {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-6) var(--space-6) var(--space-5);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	.about-brand {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.about-wordmark {
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-text);
		letter-spacing: -0.02em;
		line-height: 1;
	}

	.about-tagline {
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--color-text-muted);
		font-style: italic;
	}

	.about-body {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		line-height: 1.65;
	}

	.about-maker {
		font-size: 0.875rem;
		color: var(--color-text-subtle);
		padding-top: var(--space-2);
		border-top: 1px solid var(--color-border);
	}

	.about-link {
		color: var(--color-text-muted);
		text-underline-offset: 3px;
	}

	.about-link:hover { color: var(--color-text); }

	.about-legal {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		flex-wrap: wrap;
	}

	.about-legal a {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		text-decoration: none;
		text-underline-offset: 3px;
	}

	.about-legal a:hover {
		color: var(--color-text);
		text-decoration: underline;
	}

	.about-legal span { font-size: 0.8125rem; color: var(--color-text-subtle); }

	.about-copy {
		font-size: 0.75rem;
		color: var(--color-text-subtle);
	}
</style>
