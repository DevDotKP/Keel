<script lang="ts">
	import { dev } from '$app/environment';
	import { untrack } from 'svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Magic-link state (dev only)
	type MailState = 'idle' | 'submitting' | 'sent';
	let mailState = $state<MailState>('idle');
	let email = $state('');
	let devToken = $state<string | null>(null);

	function errorFromParam(e: string | null): string | null {
		if (e === 'oauth') return 'Google sign-in failed. Try again.';
		if (e === 'unverified') return 'Your Google account email is not verified.';
		if (e === 'invalid') return 'Sign-in link expired or already used.';
		return null;
	}

	let formError = $state<string | null>(errorFromParam(untrack(() => data.error)));

	async function sendMagicLink(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		mailState = 'submitting';

		const res = await fetch('/api/auth/send', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email })
		});

		if (!res.ok) {
			mailState = 'idle';
			formError = 'Something went wrong. Try again.';
			return;
		}

		const body = (await res.json().catch(() => ({}))) as { ok?: boolean; token?: string };
		devToken = body.token ?? null;
		mailState = 'sent';
	}
</script>

<svelte:head>
	<title>Sign in — Keel</title>
</svelte:head>

<div class="auth-card">
	<div class="brand">
		<span class="brand-name">Keel</span>
		<span class="brand-by">by Annapurna Labs</span>
	</div>

	<div class="sign-in">
		<h1 class="heading">Sign in to Keel</h1>

		{#if formError}
			<p class="error-msg" role="alert">{formError}</p>
		{/if}

		<!-- Google Sign-In (primary, always shown) -->
		<a href="/api/auth/google" class="google-btn" role="button">
			<svg class="google-logo" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
				<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
				<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
				<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
				<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
			</svg>
			Continue with Google
		</a>

		<!-- Magic-link fallback: dev only -->
		{#if dev}
			<div class="divider"><span>or (dev only)</span></div>

			{#if mailState === 'sent'}
				<div class="sent-state">
					<p class="sent-heading">Check your email</p>
					<p class="sent-body">
						Sent to <strong>{email}</strong>. Expires in 15 minutes.
					</p>
					{#if devToken}
						<div class="dev-token" role="note">
							<p class="dev-label">Sign-in link (no email sent):</p>
							<a href="/api/auth/verify?token={devToken}" class="dev-link">
								/api/auth/verify?token={devToken.slice(0, 16)}…
							</a>
						</div>
					{/if}
					<button class="link-btn" onclick={() => { mailState = 'idle'; devToken = null; }}>
						Use a different email
					</button>
				</div>
			{:else}
				<form class="magic-form" onsubmit={sendMagicLink} novalidate>
					<div class="field">
						<label for="email" class="field-label">Email</label>
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
							disabled={mailState === 'submitting'}
						/>
					</div>
					<button
						class="magic-btn"
						type="submit"
						disabled={mailState === 'submitting' || !email}
					>
						{#if mailState === 'submitting'}
							<Spinner size={16} label="Sending link" />
						{:else}
							Send magic link
						{/if}
					</button>
				</form>
			{/if}
		{/if}
	</div>
</div>

<style>
	.auth-card {
		width: 100%;
		max-width: 400px;
		display: flex;
		flex-direction: column;
		gap: var(--space-8);
	}

	.brand {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.brand-name {
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-text);
		line-height: 1;
	}

	.brand-by {
		font-size: 0.8125rem;
		color: var(--color-text-subtle);
	}

	.sign-in {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.heading {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.error-msg {
		font-size: 0.875rem;
		color: var(--color-clay);
		padding: var(--space-3) var(--space-4);
		background: color-mix(in srgb, var(--color-clay) 8%, transparent);
		border-radius: var(--radius-sm);
	}

	/* Google's official button spec: white bg, border, G logo, system font */
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
			border-color var(--duration-fast) var(--ease-out),
			box-shadow var(--duration-fast) var(--ease-out);
	}

	.google-btn:hover {
		background: #f8f9fa;
		border-color: #c6c6c6;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.google-btn:active {
		background: #f1f3f4;
	}

	.google-logo {
		width: 20px;
		height: 20px;
		flex: none;
	}

	/* Dev-only divider */
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

	/* Dev-only magic link form */
	.magic-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.field-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.field-input {
		height: 48px;
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 1rem;
		color: var(--color-text);
		width: 100%;
		font-family: inherit;
	}

	.field-input:focus {
		outline: none;
		border-color: var(--color-gold);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-gold) 15%, transparent);
	}

	.field-input:disabled {
		opacity: 0.5;
	}

	.magic-btn {
		height: 48px;
		background: var(--color-surface-subtle);
		color: var(--color-text-muted);
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
	}

	.magic-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.sent-state {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.sent-heading {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.sent-body {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	.dev-token {
		padding: var(--space-3) var(--space-4);
		background: color-mix(in srgb, var(--color-gold) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-gold) 30%, transparent);
		border-radius: var(--radius-sm);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.dev-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.dev-link {
		font-size: 0.8125rem;
		color: var(--color-text);
		word-break: break-all;
		font-family: monospace;
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
</style>
