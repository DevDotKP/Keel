<script lang="ts">
	import { page } from '$app/state';
	import { Anchor, LayoutDashboard, TrendingUp, Settings } from 'lucide-svelte';

	const links = [
		{ href: '/',         label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/insights', label: 'Insights',  icon: TrendingUp },
		{ href: '/harbour',  label: 'Harbour',   icon: Anchor },
		{ href: '/settings', label: 'Settings',  icon: Settings }
	] as const;
</script>

<nav class="app-nav" aria-label="Main navigation">
	<!-- Brand: visible only in the sidebar on desktop -->
	<a href="/" class="nav-brand" aria-label="Keel home">
		<Anchor size={20} aria-hidden="true" />
		<span>Keel</span>
	</a>

	{#each links as { href, label, icon: Icon }}
		<a
			{href}
			class="nav-item"
			class:active={page.url.pathname === href}
			aria-current={page.url.pathname === href ? 'page' : undefined}
		>
			<Icon size={22} aria-hidden="true" />
			<span class="nav-label">{label}</span>
		</a>
	{/each}
</nav>

<style>
	/* ── Mobile: bottom bar ──────────────────────────────────────────────────── */
	.app-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: var(--nav-height);
		display: flex;
		flex-direction: row;
		background: var(--color-surface);
		border-top: 1px solid var(--color-border);
		z-index: var(--z-nav);
	}

	.nav-brand {
		display: none;
	}

	.nav-item {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		color: var(--color-text-muted);
		text-decoration: none;
		font-size: 0.6875rem;
		font-weight: 500;
		min-height: var(--tap-target);
		transition: color var(--duration-fast) var(--ease-out);
	}

	.nav-item.active {
		color: var(--color-text);
		font-weight: 600;
	}

	/* Mobile active indicator: gold line at top of tab */
	.nav-item.active::before {
		content: '';
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 24px;
		height: 2px;
		border-radius: 0 0 var(--radius-full) var(--radius-full);
		background: var(--color-gold);
	}

	.nav-label {
		line-height: 1;
	}

	/* ── Desktop: left sidebar ≥768px ────────────────────────────────────────── */
	@media (min-width: 768px) {
		.app-nav {
			bottom: auto;
			right: auto;
			top: 0;
			left: 0;
			width: var(--sidebar-width);
			height: 100dvh;
			flex-direction: column;
			border-top: none;
			border-right: 1px solid var(--color-border);
			padding: var(--space-6) 0;
			gap: var(--space-1);
			overflow-y: auto;
		}

		.nav-brand {
			display: flex;
			align-items: center;
			gap: var(--space-3);
			padding: var(--space-2) var(--space-5);
			margin-bottom: var(--space-4);
			color: var(--color-text);
			text-decoration: none;
			font-family: var(--font-display);
			font-size: 1.25rem;
			font-weight: 700;
			letter-spacing: -0.01em;
		}

		.nav-brand :global(svg) {
			color: var(--color-gold);
			flex: none;
		}

		.nav-item {
			flex: none;
			flex-direction: row;
			justify-content: flex-start;
			gap: var(--space-3);
			padding: var(--space-3) var(--space-5);
			font-size: 0.9375rem;
			border-radius: 0;
			min-height: var(--tap-target);
		}

		/* Desktop active indicator: gold left bar */
		.nav-item.active::before {
			top: 50%;
			left: 0;
			transform: translateY(-50%);
			width: 3px;
			height: 24px;
			border-radius: 0 var(--radius-full) var(--radius-full) 0;
		}

		.nav-label {
			font-size: 0.9375rem;
		}
	}
</style>
