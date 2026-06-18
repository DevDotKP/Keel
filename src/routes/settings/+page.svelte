<script lang="ts">
	import Spinner from '$lib/components/Spinner.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let saving = $state(false);
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
			<label for="cadence">How often do you want to harbour?</label>
			<select id="cadence">
				<option value="weekly">Weekly</option>
				<option value="fortnightly">Fortnightly</option>
				<option value="monthly">Monthly</option>
			</select>
		</div>
		<div class="field">
			<label for="notify-time">Notify me at</label>
			<input id="notify-time" type="time" value="20:00" />
		</div>
		<!-- TODO(sonnet): bind to data.settings, PATCH /api/settings on change. -->
	</section>

	<!-- Export -->
	<section class="settings-section">
		<h2 class="settings-section-head">Your data</h2>
		<p class="settings-hint">
			Your data belongs to you. Export everything at any time.
		</p>
		<div class="export-row">
			<a href="/api/export?format=csv" class="export-btn" download>Export CSV</a>
			<a href="/api/export?format=json" class="export-btn" download>Export JSON</a>
		</div>
	</section>

	<!-- Account -->
	<section class="settings-section">
		<h2 class="settings-section-head">Account</h2>
		<p class="settings-hint">Signed in with a magic link. No password needed.</p>
		<!-- TODO(sonnet): show current email from data.user.email. Sign out button. -->
		<button class="secondary-btn">Sign out</button>
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

	.export-row {
		display: flex;
		gap: var(--space-3);
	}

	.export-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: var(--tap-target);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		text-decoration: none;
		font-weight: 500;
		font-size: 0.9375rem;
	}

	.secondary-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: var(--tap-target);
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		font-weight: 500;
		cursor: pointer;
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
</style>
