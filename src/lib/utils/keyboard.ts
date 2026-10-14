// On-screen keyboard handling for bottom sheets.
//
// Mobile browsers draw the keyboard over fixed elements (iOS always, Android
// Chrome by default), so a sheet pinned to the bottom ends up half hidden.
// visualViewport reports the area the user can actually see; the gap below it
// is the keyboard. The action exposes that gap as --kb-inset and the visible
// height as --vv-height, so the sheet can sit on top of the keyboard and shrink
// to fit, and keeps the focused field in view once the keyboard settles.

const TEXT_FIELD = 'input:not([type="date"]):not([type="time"]):not([type="checkbox"]):not([type="radio"]), textarea';

function isTextField(el: Element | null): el is HTMLElement {
	return el instanceof HTMLElement && el.matches(TEXT_FIELD);
}

/** Put the keyboard away if a text field has it. Leaves button focus alone. */
export function dismissKeyboard() {
	const el = document.activeElement;
	if (isTextField(el)) el.blur();
}

export function keyboardAware(node: HTMLElement) {
	const vv = typeof window !== 'undefined' ? window.visualViewport : null;

	function revealFocused() {
		const el = document.activeElement;
		if (isTextField(el) && node.contains(el)) el.scrollIntoView({ block: 'nearest' });
	}

	function measure() {
		if (!vv) return;
		const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
		node.style.setProperty('--kb-inset', `${inset}px`);
		node.style.setProperty('--vv-height', `${Math.round(vv.height)}px`);
		node.toggleAttribute('data-keyboard', inset > 0);
	}

	function onResize() {
		measure();
		revealFocused();
	}

	// Moving between fields while the keyboard is already up fires no resize.
	function onFocusIn() {
		requestAnimationFrame(revealFocused);
	}

	// Tapping empty space puts the keyboard away, as in native apps. Fires on
	// click (not pointerdown) so the layout never shifts under a pending tap.
	function onClick(e: MouseEvent) {
		const target = e.target as Element | null;
		if (target?.closest('input, textarea, select, button, label, a')) return;
		dismissKeyboard();
	}

	measure();
	vv?.addEventListener('resize', onResize);
	vv?.addEventListener('scroll', measure);
	node.addEventListener('focusin', onFocusIn);
	node.addEventListener('click', onClick);

	return {
		destroy() {
			vv?.removeEventListener('resize', onResize);
			vv?.removeEventListener('scroll', measure);
			node.removeEventListener('focusin', onFocusIn);
			node.removeEventListener('click', onClick);
		}
	};
}
