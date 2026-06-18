<script lang="ts">
	import { page } from '$app/state';
	import { LayoutDashboard, TrendingUp, Anchor, Settings } from 'lucide-svelte';

	const links = [
		{ href: '/',         label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/insights', label: 'Insights',  icon: TrendingUp },
		{ href: '/harbour',  label: 'Harbour',   icon: Anchor },
		{ href: '/settings', label: 'Settings',  icon: Settings }
	] as const;
</script>

<nav class="bottom-nav" aria-label="Main navigation">
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
	.bottom-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: var(--nav-height);
		display: flex;
		background: var(--color-surface);
		border-top: 1px solid var(--color-border);
		z-index: var(--z-nav);
	}

	.nav-item {
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
		color: var(--color-gold);
	}

	.nav-label {
		line-height: 1;
	}
</style>
