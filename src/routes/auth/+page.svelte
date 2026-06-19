<script lang="ts">
	import Spinner from '$lib/components/Spinner.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { error: urlError } = data;

	type AuthState = 'idle' | 'submitting' | 'sent';

	const initialError =
		urlError === 'invalid' ? 'Link expired or already used. Request a new one.' : null;

	let authState = $state<AuthState>('idle');
	let email = $state('');
	let formError = $state<string | null>(initialError);
	// The verify token, when the server reveals it (dev, or closed-testing flag).
	let devToken = $state<string | null>(null);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		authState = 'submitting';

		const res = await fetch('/api/auth/send', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email })
		});

		if (!res.ok) {
			authState = 'idle';
			formError = 'Something went wrong. Try again.';
			return;
		}

		// If the server returns a token (dev or closed-testing reveal), surface the link.
		const body = (await res.json().catch(() => ({}))) as { ok?: boolean; token?: string };
		devToken = body.token ?? null;

		authState = 'sent';
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

	{#if authState === 'sent'}
		<div class="sent-state">
			<p class="sent-heading">Check your email</p>
			<p class="sent-body">
				We sent a sign-in link to <strong>{email}</strong>. It expires in 15 minutes.
			</p>
			{#if devToken}
				<div class="dev-token" role="note">
					<p class="dev-label">Sign-in link (closed testing, no email sent):</p>
					<a href="/api/auth/verify?token={devToken}" class="dev-link">
						/api/auth/verify?token={devToken.slice(0, 16)}…
					</a>
				</div>
			{/if}
			<button
				class="link-btn"
				onclick={() => {
					authState = 'idle';
					devToken = null;
				}}
			>
				Use a different email
			</button>
		</div>
	{:else}
		<form class="auth-form" onsubmit={handleSubmit} novalidate>
			<h1 class="form-heading">Sign in to Keel</h1>
			<p class="form-sub">Enter your email — we'll send a magic link, no password needed.</p>

			{#if formError}
				<p class="form-error" role="alert">{formError}</p>
			{/if}

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
					disabled={authState === 'submitting'}
				/>
			</div>

			<button class="submit-btn" type="submit" disabled={authState === 'submitting' || !email}>
				{#if authState === 'submitting'}
					<Spinner size={18} label="Sending link" />
				{:else}
					Send magic link
				{/if}
			</button>
		</form>
	{/if}
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

	.auth-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.form-heading {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-text);
		line-height: 1.3;
	}

	.form-sub {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		margin-top: calc(var(--space-5) * -0.5);
	}

	.form-error {
		font-size: 0.875rem;
		color: var(--color-clay);
		padding: var(--space-3) var(--space-4);
		background: color-mix(in srgb, var(--color-clay) 8%, transparent);
		border-radius: var(--radius-sm);
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
	}

	.field-input:focus {
		outline: none;
		border-color: var(--color-gold);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-gold) 15%, transparent);
	}

	.field-input:disabled {
		opacity: 0.5;
	}

	.submit-btn {
		height: 52px;
		background: var(--color-gold);
		color: var(--color-ink);
		font-weight: 700;
		font-size: 1rem;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		transition: opacity var(--duration-fast) var(--ease-out);
	}

	.submit-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.sent-state {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.sent-heading {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.sent-body {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		line-height: 1.5;
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
</style>
