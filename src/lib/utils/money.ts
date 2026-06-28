// Money utilities. All values are integer paise. No floats near money.

// Module-level active currency. Initialised at layout load via setCurrency().
// Module state is per-client-session in the Vite/SvelteKit bundle — safe for client-only use.
let _currency = 'INR';
export function setCurrency(c: string): void { _currency = c; }
export function activeCurrency(): string { return _currency; }

// Intl.NumberFormat('en-IN') is unreliable on older Android WebViews — it
// sometimes returns digits with no grouping separators at all. We probe once
// and fall back to a hand-rolled en-IN formatter when needed.
const _probe = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(100000);
const _intlWorks = _probe.includes(','); // "₹1,00,000" has commas; "₹100000" does not

/** Manual en-IN grouping: last 3 digits, then groups of 2 from the right. */
function manualINR(rupees: number, fracDigits: number): string {
	const neg = rupees < 0;
	const abs = Math.abs(rupees);
	const intPart = Math.floor(abs);
	const fracPart = Math.round((abs - intPart) * 100);
	const s = String(intPart);
	let grouped: string;
	if (s.length <= 3) {
		grouped = s;
	} else {
		const tail = s.slice(-3);
		const head = s.slice(0, -3);
		const parts: string[] = [];
		for (let i = head.length; i > 0; i -= 2) parts.unshift(head.slice(Math.max(0, i - 2), i));
		grouped = parts.join(',') + ',' + tail;
	}
	const frac = fracDigits > 0 ? '.' + String(fracPart).padStart(2, '0') : '';
	return (neg ? '-₹' : '₹') + grouped + frac;
}

function formatINR(rupees: number, fracDigits: number): string {
	if (!_intlWorks) return manualINR(rupees, fracDigits);
	return new Intl.NumberFormat('en-IN', {
		style: 'currency',
		currency: 'INR',
		minimumFractionDigits: fracDigits,
		maximumFractionDigits: fracDigits
	}).format(rupees);
}

function formatAmount(rupees: number, fracDigits: number, currency: string): string {
	if (currency === 'INR') return formatINR(rupees, fracDigits);
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency,
		minimumFractionDigits: fracDigits,
		maximumFractionDigits: fracDigits
	}).format(rupees);
}

/**
 * Format paise as a human-readable currency string.
 * 15000 → "₹150" or "$1.50" depending on active currency.
 */
export function formatPaise(paise: number, currency = _currency): string {
	const rupees = paise / 100;
	return formatAmount(rupees, paise % 100 === 0 ? 0 : 2, currency);
}

/**
 * Parse user input to integer paise.
 * Accepts: "12", "12.50", "₹12.50", "1,250", "$12" etc.
 * Returns null if the input cannot be parsed.
 */
export function parseToPaise(input: string): number | null {
	if (!input || typeof input !== 'string') return null;
	// Strip only the currency symbol, grouping commas, and whitespace.
	// Anything else left (letters, a minus sign) makes the input invalid.
	const cleaned = input.replace(/[₹,\s]/g, '');
	if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
	const num = parseFloat(cleaned);
	if (!isFinite(num)) return null;
	return Math.round(num * 100);
}

/** en-IN digit grouping: last 3 digits, then groups of 2 from the right. */
function groupIndianDigits(s: string): string {
	if (s.length <= 3) return s;
	const tail = s.slice(-3);
	const head = s.slice(0, -3);
	const parts: string[] = [];
	for (let i = head.length; i > 0; i -= 2) parts.unshift(head.slice(Math.max(0, i - 2), i));
	return parts.join(',') + ',' + tail;
}

/** Western digit grouping: groups of 3 from the right. */
function groupWesternDigits(s: string): string {
	if (s.length <= 3) return s;
	const parts: string[] = [];
	for (let i = s.length; i > 0; i -= 3) parts.unshift(s.slice(Math.max(0, i - 3), i));
	return parts.join(',');
}

/**
 * Format a raw amount string for display in an input as the user types.
 * Uses Indian grouping for INR, Western grouping for all other currencies.
 * Preserves a trailing dot and up to two decimals.
 */
export function formatAmountInput(value: string): string {
	const raw = value.replace(/[^\d.]/g, '');
	if (!raw) return '';
	const firstDot = raw.indexOf('.');
	let intDigits: string;
	let dec = '';
	let hasDot = false;
	if (firstDot === -1) {
		intDigits = raw;
	} else {
		hasDot = true;
		intDigits = raw.slice(0, firstDot);
		dec = raw.slice(firstDot + 1).replace(/\./g, '').slice(0, 2);
	}
	intDigits = intDigits.replace(/^0+(?=\d)/, '');
	const grouped = _currency === 'INR'
		? groupIndianDigits(intDigits || '0')
		: groupWesternDigits(intDigits || '0');
	return hasDot ? `${grouped}.${dec}` : grouped;
}

/**
 * Format a paise value as a compact display string for ledger columns.
 * Always right-aligned; uses tabular lining numerals via CSS.
 */
export function formatPaiseLedger(paise: number, currency = _currency): string {
	return formatAmount(paise / 100, 2, currency);
}

/** Return true if the transaction is an expense (negative paise). */
export function isExpense(amount_paise: number): boolean {
	return amount_paise < 0;
}

/** Absolute value of paise, for display. */
export function absPaise(amount_paise: number): number {
	return Math.abs(amount_paise);
}

// ── Amount in words ──────────────────────────────────────────────────────────

const _ONES = [
	'', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
	'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
	'Seventeen', 'Eighteen', 'Nineteen'
];
const _TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function _twoDigit(x: number): string {
	if (x === 0) return '';
	if (x < 20) return _ONES[x];
	const t = Math.floor(x / 10), o = x % 10;
	return o === 0 ? _TENS[t] : `${_TENS[t]} ${_ONES[o]}`;
}

// Indian informal style: "Three Ninety Seven" not "Three Hundred Ninety Seven".
// Saying the hundreds digit then the two-digit remainder is how spoken amounts
// sound in India: "ek hazaar teen sattaanave" → "One Thousand Three Ninety Seven".
function _threeDigitIN(x: number): string {
	if (x === 0) return '';
	const h = Math.floor(x / 100), rem = x % 100;
	if (h === 0) return _twoDigit(rem);
	if (rem === 0) return `${_ONES[h]} Hundred`;
	// Drop "Hundred" between the hundreds digit and the two-digit remainder
	return `${_ONES[h]} ${_twoDigit(rem)}`;
}

function _spellThousandsIN(rupees: number): string {
	const thousands = Math.floor(rupees / 1000);
	const rest = rupees % 1000;
	const tPart = `${_twoDigit(thousands)} Thousand`;
	return rest > 0 ? `${tPart} ${_threeDigitIN(rest)}` : tPart;
}

/**
 * Confirmation words for an amount. Used below amount inputs.
 * INR 1,000–99,999 : "One Thousand Three Ninety Seven" (Indian informal, exact)
 * INR 1 lakh+      : "1.5 lakh" / "2 crore" (abbreviated, acceptable at scale)
 * Non-INR          : "1.4 thousand" / "2.5 million" (abbreviated)
 * Under 1,000      : "" (the number is short enough to read directly)
 */
export function amountInWordsIndian(paise: number): string {
	const rupees = Math.round(Math.abs(paise) / 100);
	if (rupees === 0) return '';

	// Under 1,000: spell out in full, with "Hundred" (e.g. 649 -> "Six Hundred Forty Nine").
	// Reads naturally standalone, where the informal "drop Hundred" style would be ambiguous.
	if (rupees < 1000) {
		const h = Math.floor(rupees / 100);
		const rem = rupees % 100;
		if (h === 0) return _twoDigit(rem);
		return rem === 0 ? `${_ONES[h]} Hundred` : `${_ONES[h]} Hundred ${_twoDigit(rem)}`;
	}

	// 1,000–99,999: always spell out in full Indian informal style.
	// No currency check — the words are a useful confirmation hint for any currency,
	// and this avoids any dependency on the module-level _currency state at render time.
	if (rupees < 1e5) return _spellThousandsIN(rupees);

	// >= 1,00,000: abbreviated. INR → lakh/crore. Non-INR → thousand/million/billion.
	if (_currency !== 'INR') {
		if (rupees >= 1_000_000_000) {
			const b = Math.round(rupees / 1e8) / 10;
			return `${Number.isInteger(b) ? b : b.toFixed(1)} billion`;
		}
		if (rupees >= 1_000_000) {
			const m = Math.round(rupees / 1e5) / 10;
			return `${Number.isInteger(m) ? m : m.toFixed(1)} million`;
		}
		// 1,00,000–9,99,999: e.g. "150 thousand"
		const k = Math.round(rupees / 100) / 10;
		return `${Number.isInteger(k) ? k : k.toFixed(1)} thousand`;
	}

	if (rupees >= 1e7) {
		const cr = Math.round(rupees / 1e6) / 10;
		return `${Number.isInteger(cr) ? cr : cr.toFixed(1)} crore`;
	}
	const lk = Math.round(rupees / 1e4) / 10;
	return `${Number.isInteger(lk) ? lk : lk.toFixed(1)} lakh`;
}
