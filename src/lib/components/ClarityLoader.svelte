<script lang="ts">
	// Loads Microsoft Clarity after the browser goes idle — never blocks LCP.
	// Production-only: import.meta.env.PROD is false in dev, so this is a no-op
	// during local development and the tree-shaker removes the bundle entirely.
	// Gate off before any user other than the developer touches the app.
	$effect(() => {
		if (!import.meta.env.PROD) return;

		const CLARITY_ID = 'x9n1z284jh';

		const load = () => {
			const win = window as Window & { clarity?: (...args: unknown[]) => void };
			// Standard Clarity snippet, inlined to avoid an extra round-trip.
			if (!win.clarity) {
				const q: unknown[][] = [];
				win.clarity = (...args) => { q.push(args); };
				(win.clarity as unknown as { q: unknown[][] }).q = q;
			}
			const script = document.createElement('script');
			script.async = true;
			script.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
			const first = document.getElementsByTagName('script')[0];
			first?.parentNode?.insertBefore(script, first);
			// Mask all text — essential for a finance app.
			// No amount, description, or note ever appears in Clarity recordings.
			win.clarity('set', 'maskAllText', 'true');
			win.clarity('set', 'maskAllInputs', 'true');
		};

		if ('requestIdleCallback' in window) {
			const id = requestIdleCallback(load, { timeout: 3000 });
			return () => cancelIdleCallback(id);
		} else {
			const id = setTimeout(load, 800);
			return () => clearTimeout(id);
		}
	});
</script>
