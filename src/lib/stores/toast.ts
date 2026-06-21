import { writable } from 'svelte/store';

export interface ToastState {
	message: string;
	actionLabel?: string;
}

interface ShowOptions {
	message: string;
	actionLabel?: string;
	/** Run when the user taps the action button. The expire callback is skipped. */
	onAction?: () => void;
	/** Run when the toast times out or is flushed (e.g. on navigation). */
	onExpire?: () => void;
	/** Visible duration in ms before the toast auto-commits. Default 5000. */
	duration?: number;
}

/**
 * A single-slot toast with an optional action.
 *
 * Built for deferred actions like undoable delete: the caller hides the row
 * optimistically, passes the real commit as `onExpire` and the restore as
 * `onAction`. The commit only fires once the undo window closes (timeout,
 * navigation, or a replacing toast), so Undo never has to hit a restore API.
 */
function createToast() {
	const { subscribe, set } = writable<ToastState | null>(null);
	let timer: ReturnType<typeof setTimeout> | null = null;
	let onAction: (() => void) | null = null;
	let onExpire: (() => void) | null = null;

	function clearTimer() {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	}

	/** Commit the pending expire callback (if any) and hide. */
	function flush() {
		clearTimer();
		const fn = onExpire;
		onAction = null;
		onExpire = null;
		set(null);
		fn?.();
	}

	function show(opts: ShowOptions) {
		// Commit any previously pending action before replacing it.
		flush();
		onAction = opts.onAction ?? null;
		onExpire = opts.onExpire ?? null;
		set({ message: opts.message, actionLabel: opts.actionLabel });
		timer = setTimeout(flush, opts.duration ?? 5000);
	}

	/** The user tapped the action: run onAction, skip the expire commit. */
	function act() {
		clearTimer();
		const fn = onAction;
		onAction = null;
		onExpire = null;
		set(null);
		fn?.();
	}

	return { subscribe, show, act, flush };
}

export const toast = createToast();
