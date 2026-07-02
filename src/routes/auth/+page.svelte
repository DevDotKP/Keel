<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { ShieldCheck, LifeBuoy, Tag } from 'lucide-svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Email + password state. 'signin', 'signup', and 'reset' share one form.
	let mode = $state<'signin' | 'signup' | 'reset'>('signin');
	let email = $state('');
	let password = $state('');
	let recoveryInput = $state('');
	let submitting = $state(false);
	// Set after signup/reset: shown exactly once, user must confirm they saved it.
	let issuedCode = $state<string | null>(null);
	let codeCopied = $state(false);

	function errorFromParam(e: string | null): string | null {
		if (e === 'oauth') return 'Google sign-in failed. Try again.';
		if (e === 'unverified') return 'Your Google account email is not verified.';
		if (e === 'invalid') return 'Sign-in link expired or already used.';
		return null;
	}

	let formError = $state<string | null>(errorFromParam(untrack(() => data.error)));

	onMount(() => {
		// Landing here means signed out (or session expired). Purge cached page
		// navigations so the previous user's balances can't be read offline on a
		// shared device. Best-effort; static assets stay cached.
		navigator.serviceWorker?.controller?.postMessage({ type: 'purge-pages' });
	});

	function proceed() {
		// Full reload so the server hook picks up the new session cookie.
		const next = data.next && data.next.startsWith('/') && !data.next.startsWith('//') ? data.next : '/';
		window.location.href = next;
	}

	async function submitPassword(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
			formError = 'Enter a valid email address, like name@example.com.';
			return;
		}
		if (mode !== 'signin' && password.length < 8) {
			formError = 'Choose a password of at least 8 characters.';
			return;
		}
		submitting = true;

		const endpoint =
			mode === 'signup' ? '/api/auth/signup' : mode === 'reset' ? '/api/auth/reset' : '/api/auth/login';
		const payload =
			mode === 'reset'
				? { email, recovery_code: recoveryInput, new_password: password }
				: { email, password };
		const res = await fetch(endpoint, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});

		if (!res.ok) {
			submitting = false;
			const body = (await res.json().catch(() => ({}))) as { message?: string };
			formError = body.message ?? 'Something went wrong. Try again.';
			return;
		}

		const body = (await res.json().catch(() => ({}))) as { recovery_code?: string };
		if (body.recovery_code) {
			// Session is live, but hold the redirect until they save the code.
			issuedCode = body.recovery_code;
			submitting = false;
			return;
		}
		proceed();
	}

	async function copyCode() {
		if (!issuedCode) return;
		try {
			await navigator.clipboard.writeText(issuedCode);
			codeCopied = true;
		} catch {
			/* clipboard blocked: the code is on screen, user can copy manually */
		}
	}
</script>

<svelte:head>
	<title>Keel · the tracker for people who quit trackers</title>
</svelte:head>

<div class="landing">
	<div class="brand">
		<img src="/icons/icon-192-v2.png" alt="" class="brand-logo-mark" width="34" height="34" />
		<span class="brand-name">Keel</span>
		<span class="brand-by">by Annapurna Labs</span>
	</div>

	<header class="hero">
		<h1 class="hero-title">The tracker for people who quit trackers.</h1>
		<p class="hero-sub">See what is safe to spend at a glance. Fall behind without breaking your numbers.</p>
	</header>

	<!-- Product preview: the value, as a picture. Pure CSS, no external assets. -->
	<div class="preview" aria-hidden="true">
		<div class="pv-top">
			<span class="pv-label">Safe to spend</span>
			<span class="pv-amount">₹42,300</span>
			<span class="pv-sub">Free to spend before your next harbour</span>
		</div>
		<ul class="pv-ledger">
			<li class="pv-row">
				<span class="pv-name">Swiggy</span>
				<span class="pv-amt">−₹240</span>
			</li>
			<li class="pv-row">
				<span class="pv-dot"></span>
				<span class="pv-name">Auto</span>
				<span class="pv-amt">−₹60</span>
			</li>
			<li class="pv-row">
				<span class="pv-name">Salary</span>
				<span class="pv-amt pv-amt--in">+₹85,000</span>
			</li>
		</ul>
	</div>

	<!-- Sign in -->
	<div class="sign-in">
		{#if formError}
			<p class="error-msg" role="alert">{formError}</p>
		{/if}

		<form method="POST" action="/api/demo" class="demo-cta">
			<button type="submit" class="demo-btn">Try the live demo</button>
		</form>
		<p class="demo-note">No sign-up. A sandbox with sample data and voice entry. Nothing is saved.</p>
		<div class="divider"><span>or sign in</span></div>

		<a href="/api/auth/google{data.next ? `?next=${encodeURIComponent(data.next)}` : ''}" class="google-btn" role="button">
			<svg class="google-logo" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
				<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
				<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
				<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
				<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
			</svg>
			Continue with Google
		</a>

		<div class="divider"><span>or use email</span></div>

		{#if issuedCode}
			<!-- Shown exactly once. The session is already live; we hold the redirect
			     until the user confirms they saved the code. -->
			<div class="code-panel" role="alert">
				<p class="code-heading">Save your recovery code</p>
				<p class="code-body">
					This code is the only way to reset your password. Keel cannot email you a reset link.
					Save it in your password manager or notes now; it will not be shown again.
				</p>
				<p class="code-value money">{issuedCode}</p>
				<div class="code-actions">
					<button type="button" class="pw-btn" onclick={copyCode}>
						{codeCopied ? 'Copied' : 'Copy code'}
					</button>
					<button type="button" class="pw-btn pw-btn--primary" onclick={proceed}>
						I saved it, continue
					</button>
				</div>
			</div>
		{:else}
			<form class="pw-form" onsubmit={submitPassword} novalidate>
				<div class="pw-field">
					<label class="pw-label" for="email">Email</label>
					<input
						id="email"
						type="email"
						name="email"
						bind:value={email}
						class="field-input"
						placeholder="you@example.com"
						autocomplete="email"
						inputmode="email"
						required
						disabled={submitting}
					/>
				</div>
				{#if mode === 'reset'}
					<div class="pw-field">
						<label class="pw-label" for="recovery-code">Recovery code</label>
						<input
							id="recovery-code"
							type="text"
							name="recovery-code"
							bind:value={recoveryInput}
							class="field-input"
							placeholder="xxxx-xxxx-xxxx-xxxx"
							autocomplete="off"
							spellcheck="false"
							required
							disabled={submitting}
						/>
					</div>
				{/if}
				<div class="pw-field">
					<div class="pw-label-row">
						<label class="pw-label" for="password">
							{mode === 'reset' ? 'New password' : 'Password'}
						</label>
						{#if mode === 'signin'}
							<button
								type="button"
								class="link-btn"
								onclick={() => { mode = 'reset'; formError = null; }}
							>
								Forgot password?
							</button>
						{/if}
					</div>
					<input
						id="password"
						type="password"
						name="password"
						bind:value={password}
						class="field-input"
						placeholder={mode === 'signin' ? 'Your password' : 'At least 8 characters'}
						autocomplete={mode === 'signin' ? 'current-password' : 'new-password'}
						required
						minlength={mode === 'signin' ? undefined : 8}
						disabled={submitting}
					/>
				</div>
				<button
					class="pw-btn"
					type="submit"
					disabled={submitting || !email || !password || (mode === 'reset' && !recoveryInput)}
				>
					{#if submitting}
						<Spinner
							size={16}
							label={mode === 'signup' ? 'Creating account' : mode === 'reset' ? 'Resetting' : 'Signing in'}
						/>
					{:else}
						{mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in'}
					{/if}
				</button>
				{#if mode === 'signup'}
					<p class="pw-note">
						You will get a recovery code: the only way to reset a lost password. If your email
						is a Google account, "Continue with Google" also works and can never lock you out.
					</p>
				{/if}
				{#if mode === 'reset'}
					<p class="pw-note">
						Lost the code too? If your email is a Google account, "Continue with Google" still
						signs you in. Otherwise there is no way back in; that is the cost of no email access.
					</p>
				{/if}
				<p class="mode-switch">
					{#if mode === 'signin'}
						<span>New to Keel?</span>
						<button type="button" class="link-btn" onclick={() => { mode = 'signup'; formError = null; }}>
							Create an account
						</button>
					{:else}
						<span>Already have an account?</span>
						<button type="button" class="link-btn" onclick={() => { mode = 'signin'; formError = null; }}>
							Sign in
						</button>
					{/if}
				</p>
			</form>
		{/if}
	</div>

	<!-- Why Keel: scannable, icon-led, not prose. -->
	<ul class="pillars">
		<li class="pillar">
			<span class="pillar-icon" aria-hidden="true"><LifeBuoy size={20} /></span>
			<span class="pillar-body">
				<span class="pillar-title">Forgiving</span>
				<span class="pillar-text">Miss an entry and nothing breaks. Loose ends wait at Harbour.</span>
			</span>
		</li>
		<li class="pillar">
			<span class="pillar-icon" aria-hidden="true"><ShieldCheck size={20} /></span>
			<span class="pillar-body">
				<span class="pillar-title">Private</span>
				<span class="pillar-text">No SMS, email, or bank scraping. You type only what matters.</span>
			</span>
		</li>
		<li class="pillar">
			<span class="pillar-icon" aria-hidden="true"><Tag size={20} /></span>
			<span class="pillar-body">
				<span class="pillar-title">One-time</span>
				<span class="pillar-text">Free to start. A one-time price later, never a subscription.</span>
			</span>
		</li>
	</ul>

	<footer class="auth-foot">
		<a href="/pricing">Pricing</a>
		<a href="/legal/privacy">Privacy</a>
		<a href="/legal/terms">Terms</a>
	</footer>
</div>

<style>
	.landing {
		width: 100%;
		max-width: 420px;
		margin: 0 auto;
		padding: var(--space-8) var(--space-6) var(--space-10);
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.brand-logo-mark {
		width: 34px;
		height: 34px;
		border-radius: 9px;
	}

	.brand-name {
		font-family: var(--font-display);
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--color-text);
		line-height: 1;
	}

	.brand-by {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
	}

	.hero {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.hero-title {
		font-family: var(--font-display);
		font-size: 1.875rem;
		font-weight: 700;
		line-height: 1.12;
		color: var(--color-text);
		letter-spacing: -0.01em;
	}

	.hero-sub {
		font-size: 1rem;
		line-height: 1.5;
		color: var(--color-text-muted);
	}

	/* ── Product preview (the picture) ───────────────────────────────────────── */
	.preview {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: 0 10px 30px rgba(12, 35, 64, 0.10);
		overflow: hidden;
	}

	.pv-top {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--space-5) var(--space-5) var(--space-4);
		background: var(--color-surface-subtle);
		border-bottom: 1px solid var(--color-border);
	}

	.pv-label {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-text-subtle);
	}

	.pv-amount {
		font-family: var(--font-display);
		font-size: 2.25rem;
		font-weight: 700;
		color: var(--color-gold);
		font-variant-numeric: tabular-nums lining-nums;
		line-height: 1.1;
	}

	.pv-sub {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.pv-ledger {
		list-style: none;
		display: flex;
		flex-direction: column;
		padding: var(--space-2) var(--space-5) var(--space-4);
	}

	.pv-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.pv-row:last-child {
		border-bottom: none;
	}

	.pv-dot {
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		background: var(--color-gold);
		flex: none;
	}

	.pv-name {
		flex: 1;
		font-size: 0.875rem;
		color: var(--color-text);
	}

	.pv-amt {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
		font-variant-numeric: tabular-nums lining-nums;
	}

	.pv-amt--in {
		color: var(--color-positive);
	}

	/* ── Sign in ─────────────────────────────────────────────────────────────── */
	.sign-in {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.error-msg {
		font-size: 0.875rem;
		color: var(--color-clay);
		padding: var(--space-3) var(--space-4);
		background: color-mix(in srgb, var(--color-clay) 8%, transparent);
		border-radius: var(--radius-sm);
	}

	.demo-cta {
		display: flex;
	}

	.demo-btn {
		flex: 1;
		height: 52px;
		background: var(--color-gold);
		color: var(--color-ink);
		font-size: 1rem;
		font-weight: 700;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-family: inherit;
	}

	.demo-note {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		text-align: center;
		line-height: 1.4;
	}

	/* Google's official button spec: white bg, border, G logo */
	.google-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		height: 52px;
		padding: 0 var(--space-5);
		background: #ffffff;
		border: 1px solid #dadce0;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 600;
		color: #3c4043;
		text-decoration: none;
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			box-shadow var(--duration-fast) var(--ease-out);
	}

	.google-btn:hover {
		background: #f8f9fa;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.google-logo {
		width: 20px;
		height: 20px;
		flex: none;
	}

	.divider {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		color: var(--color-text-subtle);
		font-size: 0.8125rem;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--color-border);
	}

	.pw-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.pw-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.pw-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.pw-label-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.field-input {
		flex: 1;
		min-width: 0;
		height: 48px;
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 1rem;
		color: var(--color-text);
		font-family: inherit;
	}

	.field-input:focus {
		outline: none;
		border-color: var(--color-gold);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-gold) 15%, transparent);
	}

	.pw-btn {
		height: 48px;
		padding: 0 var(--space-4);
		background: var(--color-surface-subtle);
		color: var(--color-text);
		font-weight: 600;
		font-size: 0.9375rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		font-family: inherit;
		white-space: nowrap;
	}

	.pw-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.pw-note {
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--color-text-subtle);
	}

	.pw-btn--primary {
		background: var(--color-gold);
		color: var(--color-ink);
		border-color: var(--color-gold);
		font-weight: 700;
	}

	.code-panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		border: 1px solid var(--color-gold);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-gold) 6%, transparent);
	}

	.code-heading {
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.code-body {
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--color-text-muted);
	}

	.code-value {
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-align: center;
		padding: var(--space-3);
		background: var(--color-surface);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-sm);
		user-select: all;
	}

	.code-actions {
		display: flex;
		gap: var(--space-2);
	}

	.code-actions .pw-btn {
		flex: 1;
	}

	.mode-switch {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		display: flex;
		gap: var(--space-2);
		justify-content: center;
	}

	.link-btn {
		background: none;
		border: none;
		padding: 0;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		cursor: pointer;
		text-decoration: underline;
		text-align: left;
		font-family: inherit;
	}

	/* ── Pillars ─────────────────────────────────────────────────────────────── */
	.pillars {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-top: var(--space-2);
		border-top: 1px solid var(--color-border);
	}

	.pillar {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
	}

	.pillar-icon {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md);
		background: var(--color-surface-subtle);
		color: var(--color-text);
	}

	.pillar-body {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.pillar-title {
		font-size: 0.9375rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.pillar-text {
		font-size: 0.875rem;
		line-height: 1.45;
		color: var(--color-text-muted);
	}

	.auth-foot {
		display: flex;
		gap: var(--space-4);
		padding-top: var(--space-2);
	}

	.auth-foot a {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		text-underline-offset: 3px;
	}
</style>
