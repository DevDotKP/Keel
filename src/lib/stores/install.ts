import { writable } from 'svelte/store';

// Fired by the browser when the app meets PWA install criteria.
// Calling .prompt() on the stored event triggers the native install UI.
export const installPrompt = writable<BeforeInstallPromptEvent | null>(null);
