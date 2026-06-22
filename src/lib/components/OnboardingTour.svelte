<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { X, ChevronRight, ChevronLeft } from 'lucide-svelte';
	import { isSpeechSupported } from '$lib/utils/voice/capture';

	const TOUR_KEY = 'keel_tour_v1';

	// Don't promise voice where the browser can't do it (notably iOS Safari).
	const voiceSupported = isSpeechSupported();

	interface TourStep {
		title: string;
		body: string;
		target?: string; // CSS selector to spotlight
		placement?: 'above' | 'below'; // tooltip position relative to spotlight
	}

	const STEPS: TourStep[] = [
		{
			title: 'Welcome to Keel',
			body: 'A one-minute tour of the three things that matter. Skip anytime.'
		},
		{
			title: 'Safe to spend',
			body: "What's left after what you still owe this cycle. Not your bank balance.",
			target: '[aria-label="Safe to spend"]',
			placement: 'below'
		},
		{
			title: 'The cycle',
			body: 'Keel works in cycles: weekly, fortnightly, or monthly. Each one starts fresh.',
			target: '[aria-label="Safe to spend"]',
			placement: 'below'
		},
		{
			title: 'Log an expense',
			body: voiceSupported
				? 'Tap the gold button. Amount first. Or just say "Swiggy 200 rupees".'
				: 'Tap the gold button. Amount first. Quick, and forgiving if you miss one.',
			target: '.fab',
			placement: 'above'
		},
		{
			title: 'The Harbour',
			body: 'At cycle end, type your real balance. Keel squares the books. No guilt.'
		},
		{
			title: 'The gold dot',
			body: 'A gold dot means an entry is uncategorized. It waits for Harbour and never breaks your totals.'
		},
		{
			title: "That's Keel",
			body: 'Log as you spend. Square up at Harbour. Forgiving by design.'
		}
	];

	const PAD = 8; // spotlight padding around target
	const CARD_W = 320; // max card width
	const GAP = 14; // gap between spotlight and card

	let visible = $state(false);
	let stepIdx = $state(0);
	let spot = $state<{ top: number; left: number; width: number; height: number } | null>(null);

	onMount(() => {
		if (!localStorage.getItem(TOUR_KEY)) visible = true;
	});

	$effect(() => {
		if (!visible) return;
		const idx = stepIdx; // capture for dependency tracking
		void updateSpot(idx);
	});

	async function updateSpot(idx: number) {
		await tick();
		const sel = STEPS[idx]?.target;
		if (!sel) {
			spot = null;
			return;
		}
		const el = document.querySelector(sel);
		if (!el) {
			spot = null;
			return;
		}
		el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		await tick();
		const r = el.getBoundingClientRect();
		spot = {
			top: r.top - PAD,
			left: r.left - PAD,
			width: r.width + PAD * 2,
			height: r.height + PAD * 2
		};
	}

	function next() {
		if (stepIdx < STEPS.length - 1) stepIdx++;
		else dismiss();
	}

	function prev() {
		if (stepIdx > 0) stepIdx--;
	}

	function dismiss() {
		visible = false;
		localStorage.setItem(TOUR_KEY, '1');
	}

	function handleKey(e: KeyboardEvent) {
		if (!visible) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			dismiss();
		}
		if (e.key === 'ArrowRight') {
			e.preventDefault();
			next();
		}
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			prev();
		}
	}

	// Position the tooltip card near the spotlight target.
	function cardPos(s: typeof spot, placement: TourStep['placement']): string {
		if (!s) return '';
		const vw = typeof window !== 'undefined' ? window.innerWidth : 480;
		const w = Math.min(CARD_W, vw - 32);
		const top =
			placement === 'above'
				? s.top - GAP // translateY(-100%) shifts card above this
				: s.top + s.height + GAP;
		const left = Math.max(16, Math.min(s.left + s.width / 2 - w / 2, vw - w - 16));
		return `top:${top}px; left:${left}px; width:${w}px`;
	}
</script>

<svelte:window onkeydown={handleKey} />

{#if visible}
	{@const step = STEPS[stepIdx]}
	{@const isCenter = !spot}
	{@const isLast = stepIdx === STEPS.length - 1}

	<!-- Dark overlay. Spotlight creates its own via box-shadow; center steps use background-color. -->
	<div class="tour-overlay" class:tour-overlay--dim={isCenter} aria-hidden="true"></div>

	<!-- Spotlight cutout (box-shadow trick: this div punches a hole in the overlay) -->
	{#if spot}
		<div
			class="tour-spotlight"
			style="top:{spot.top}px; left:{spot.left}px; width:{spot.width}px; height:{spot.height}px"
			aria-hidden="true"
		></div>
	{/if}

	<!-- Tooltip / modal card -->
	<div
		class="tour-card"
		class:tour-card--center={isCenter}
		class:tour-card--above={!isCenter && step.placement === 'above'}
		style={!isCenter ? cardPos(spot, step.placement) : ''}
		role="dialog"
		aria-modal="true"
		aria-label={step.title}
		aria-live="polite"
	>
		<div class="tour-header">
			<h2 class="tour-title">{step.title}</h2>
			<button class="tour-close" onclick={dismiss} aria-label="Skip tour">
				<X size={16} />
			</button>
		</div>

		<p class="tour-body">{step.body}</p>

		<div class="tour-footer">
			<div class="tour-dots" role="status" aria-label="Step {stepIdx + 1} of {STEPS.length}">
				{#each STEPS as _, i}
					<span class="tour-dot" class:active={i === stepIdx} aria-hidden="true"></span>
				{/each}
			</div>

			<div class="tour-btns">
				{#if stepIdx > 0}
					<button class="tour-btn tour-btn--back" onclick={prev}>
						<ChevronLeft size={14} aria-hidden="true" />
						Back
					</button>
				{/if}
				<!-- svelte-ignore a11y_autofocus -->
				<button class="tour-btn tour-btn--next" onclick={next} autofocus>
					{isLast ? 'Get started' : 'Next'}
					{#if !isLast}<ChevronRight size={14} aria-hidden="true" />{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Intercepts all background interaction */
	.tour-overlay {
		position: fixed;
		inset: 0;
		z-index: 600;
		background: transparent;
		pointer-events: all;
	}

	/* Center steps (no spotlight) show a dim backdrop */
	.tour-overlay--dim {
		background: rgba(12, 35, 64, 0.65);
	}

	/*
	 * Spotlight: transparent div whose massive box-shadow creates the dark overlay.
	 * The div itself stays clear, forming the "hole".
	 * pointer-events: none so background scroll still works (tour doesn't need it).
	 */
	.tour-spotlight {
		position: fixed;
		z-index: 601;
		pointer-events: none;
		border-radius: var(--radius-md);
		background: transparent;
		box-shadow: 0 0 0 9999px rgba(12, 35, 64, 0.72);
	}

	/* Card sits above spotlight */
	.tour-card {
		position: fixed;
		z-index: 602;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow:
			0 8px 32px rgba(12, 35, 64, 0.18),
			0 2px 8px rgba(12, 35, 64, 0.08);
		overflow: hidden;
		pointer-events: auto;
	}

	.tour-card--center {
		top: 50%;
		left: 50%;
		width: min(340px, calc(100vw - 32px));
		transform: translate(-50%, -50%);
	}

	/* Placed above target: shift the card upward by its own height */
	.tour-card--above {
		transform: translateY(-100%);
	}

	.tour-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-5) var(--space-5) var(--space-3);
	}

	.tour-title {
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-text);
		margin: 0;
		line-height: 1.25;
	}

	.tour-close {
		flex: none;
		background: none;
		border: none;
		padding: 4px;
		color: var(--color-text-subtle);
		cursor: pointer;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
	}

	.tour-close:hover {
		color: var(--color-text);
		background: var(--color-surface-subtle);
	}

	.tour-body {
		font-size: 1rem;
		color: var(--color-text-muted);
		line-height: 1.55;
		margin: 0;
		padding: 0 var(--space-5) var(--space-2);
	}

	.tour-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-5) var(--space-5);
	}

	.tour-dots {
		display: flex;
		gap: 5px;
		align-items: center;
	}

	.tour-dot {
		height: 6px;
		width: 6px;
		border-radius: 3px;
		background: var(--color-border);
		transition:
			background 150ms ease-out,
			width 150ms ease-out;
	}

	.tour-dot.active {
		background: var(--color-gold);
		width: 16px;
	}

	.tour-btns {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}

	.tour-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		border: none;
		min-height: 36px;
		white-space: nowrap;
		font-family: inherit;
	}

	.tour-btn--next {
		background: var(--color-gold);
		color: var(--color-ink);
	}

	.tour-btn--next:hover {
		filter: brightness(1.06);
	}

	.tour-btn--back {
		background: none;
		color: var(--color-text-muted);
		border: 1px solid var(--color-border);
	}

	.tour-btn--back:hover {
		color: var(--color-text);
		border-color: var(--color-text-subtle);
	}

	/* Respect reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.tour-dot {
			transition: none;
		}
	}
</style>
