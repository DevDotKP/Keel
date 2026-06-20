<script lang="ts">
	import { onMount } from 'svelte';
	import { installPrompt } from '$lib/stores/install';

	onMount(() => {
		const capture = (e: BeforeInstallPromptEvent) => {
			e.preventDefault();
			installPrompt.set(e);
		};
		const clear = () => installPrompt.set(null);
		window.addEventListener('beforeinstallprompt', capture);
		window.addEventListener('appinstalled', clear);
		return () => {
			window.removeEventListener('beforeinstallprompt', capture);
			window.removeEventListener('appinstalled', clear);
		};
	});
</script>
