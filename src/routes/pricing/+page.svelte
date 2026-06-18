<script lang="ts">
</script>

<svelte:head>
	<title>Pricing - Keel</title>
</svelte:head>

<div class="pricing-page">
	<h1 class="section-head">Simple pricing</h1>
	<p class="pricing-sub">
		Try Keel free. When you are ready, one payment unlocks it for good.
		No subscription. No renewal. Yours forever.
	</p>

	<!-- TODO(sonnet): render actual price from config, add Razorpay checkout button
	     when payments land. In MVP this page is informational only. -->
	<div class="price-card">
		<p class="price-label">Lifetime access</p>
		<p class="price-amount money-hero">Rs 999</p>
		<p class="price-note">One payment. No recurring charges.</p>
		<button class="primary-btn" disabled>Coming soon</button>
	</div>

	<nav class="legal-links" aria-label="Legal">
		<a href="/legal/terms">Terms</a>
		<a href="/legal/refund">Refund policy</a>
		<a href="/legal/contact">Contact</a>
	</nav>
</div>

<style>
	.pricing-page {
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-8);
		align-items: center;
		text-align: center;
	}

	.pricing-sub {
		color: var(--color-text-muted);
		max-width: 32ch;
		line-height: 1.6;
	}

	.price-card {
		width: 100%;
		max-width: 320px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-8) var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		align-items: center;
	}

	.price-label {
		font-weight: 600;
		font-size: 0.9375rem;
		color: var(--color-text-muted);
	}

	.price-note {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.primary-btn {
		width: 100%;
		height: 52px;
		background: var(--color-gold);
		color: var(--color-ink);
		font-weight: 700;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
	}

	.primary-btn:disabled { opacity: 0.4; cursor: not-allowed; }

	.legal-links {
		display: flex;
		gap: var(--space-4);
		font-size: 0.875rem;
	}

	.legal-links a {
		color: var(--color-text-muted);
	}
</style>
