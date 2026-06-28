<script lang="ts">
	import { Tags, CalendarClock, TrendingUp, Trash2, X, ChevronRight, Users } from 'lucide-svelte';
	import MenuLink from '$lib/components/MenuLink.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { installPrompt } from '$lib/stores/install';
	import { setCurrency } from '$lib/utils/money';

	const CURRENCIES = [
		{ code: 'INR', label: '₹ INR — Indian Rupee' },
		{ code: 'USD', label: '$ USD — US Dollar' },
		{ code: 'EUR', label: '€ EUR — Euro' },
		{ code: 'GBP', label: '£ GBP — British Pound' },
		{ code: 'AED', label: 'AED — UAE Dirham' },
		{ code: 'SGD', label: 'S$ SGD — Singapore Dollar' },
		{ code: 'JPY', label: '¥ JPY — Japanese Yen' },
		{ code: 'CAD', label: 'CA$ CAD — Canadian Dollar' },
		{ code: 'AUD', label: 'A$ AUD — Australian Dollar' }
	];

	let { data }: { data: PageData } = $props();

	let saving = $state(false);
	let error = $state<string | null>(null);

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

	function replayTour() {
		try { localStorage.removeItem('keel_tour_v1'); } catch { /* ignore */ }
		location.href = '/';
	}

	async function handlePortfolioToggle(checked: boolean) {
		await patch({ show_portfolio: checked ? 1 : 0 });
	}

	async function handleCurrencyChange(code: string) {
		saving = true;
		error = null;
		const res = await fetch('/api/account', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ currency: code })
		});
		saving = false;
		if (!res.ok) { error = 'Could not save. Try again.'; return; }
		setCurrency(code);
		await invalidateAll();
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

		{#if data.members.length > 1}
			<p class="field-hint">Admins can invite and manage the household. Members can add and view entries.</p>
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
					<button class="invite-send-btn" onclick={sendInvite} disabled={inviteBusy || !inviteEmail}>
						{inviteBusy ? 'Sending…' : 'Send'}
					</button>
				</div>
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

	<!-- Money cycle nav link -->
	<nav class="cycle-nav" aria-label="Money cycle">
		<MenuLink href="/settings/cycle" title="Money cycle" sub="Cadence, payday alignment, reminders">
			{#snippet icon()}<CalendarClock size={20} />{/snippet}
		</MenuLink>
	</nav>

	<!-- Currency -->
	<div class="inline-field">
		<label class="inline-field-label" for="currency">Currency</label>
		<select
			id="currency"
			class="inline-select"
			value={data.accountCurrency ?? 'INR'}
			onchange={(e) => handleCurrencyChange(e.currentTarget.value)}
			disabled={saving}
		>
			{#each CURRENCIES as c}
				<option value={c.code}>{c.label}</option>
			{/each}
		</select>
	</div>

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
			<a href="/legal/privacy">Privacy</a>
			<a href="/legal/refund">Refund</a>
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
		align-items: center;
		gap: var(--space-2);
	}

	.invite-input {
		flex: 1;
		min-width: 0;
		height: 40px;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: var(--color-surface);
		font-size: 0.875rem;
		color: var(--color-text);
		font-family: inherit;
	}

	.invite-input:focus { outline: none; border-color: var(--color-gold); }

	.invite-role {
		flex: none;
		width: auto;
		height: 40px;
		padding: 0 var(--space-6) 0 var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: var(--color-surface);
		font-size: 0.875rem;
		color: var(--color-text);
		font-family: inherit;
	}

	.invite-send-btn {
		flex: none;
		height: 40px;
		padding: 0 var(--space-4);
		background: var(--color-text);
		color: var(--color-surface);
		font-weight: 600;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-family: inherit;
		font-size: 0.875rem;
		white-space: nowrap;
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

	.field-hint {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
	}

	.error { color: var(--color-clay); font-size: 0.875rem; }

	/* Currency inline field */
	.inline-field {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		min-height: var(--tap-target);
	}

	.inline-field-label {
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
		font-family: inherit;
		max-width: 60%;
	}

	.inline-select:focus { outline: none; border-color: var(--color-gold); }
	.inline-select:disabled { opacity: 0.5; }

	/* Cycle nav (single MenuLink, same border treatment as manage-links) */
	.cycle-nav {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
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
		gap: 0;
		align-items: center;
		flex-wrap: wrap;
	}

	.about-legal a {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		text-decoration: none;
		text-underline-offset: 3px;
		padding: var(--space-1) 0;
	}

	/* Separator lives inside the second+ link so it never orphans on its own line */
	.about-legal a + a::before {
		content: '·';
		margin: 0 var(--space-2);
		color: var(--color-text-subtle);
	}

	.about-legal a:hover { color: var(--color-text); text-decoration: underline; }

	.about-copy {
		font-size: 0.75rem;
		color: var(--color-text-subtle);
	}
</style>
