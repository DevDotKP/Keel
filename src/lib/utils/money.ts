// Money utilities. All values are integer paise. No floats near money.

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

/**
 * Format paise as a human-readable INR string.
 * 15000 → "₹150" or "₹150.50" when paise are non-zero.
 */
export function formatPaise(paise: number): string {
	const rupees = paise / 100;
	return formatINR(rupees, paise % 100 === 0 ? 0 : 2);
}

/**
 * Parse user input to integer paise.
 * Accepts: "12", "12.50", "12,50", "₹12.50", "1250" (bare paise not supported — always rupees).
 * Returns null if the input cannot be parsed.
 */
export function parseToPaise(input: string): number | null {
	if (!input || typeof input !== 'string') return null;
	const cleaned = input.replace(/[₹,\s]/g, '');
	// Validate: cleaned must be all digits with at most one decimal point
	if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
	const num = parseFloat(cleaned);
	if (!isFinite(num) || num < 0) return null;
	return Math.round(num * 100);
}

/**
 * Format a paise value as a compact display string for ledger columns.
 * Always right-aligned; uses tabular lining numerals via CSS.
 * 15050 → "₹150.50"
 */
export function formatPaiseLedger(paise: number): string {
	return formatINR(paise / 100, 2);
}

/** Return true if the transaction is an expense (negative paise). */
export function isExpense(amount_paise: number): boolean {
	return amount_paise < 0;
}

/** Absolute value of paise, for display. */
export function absPaise(amount_paise: number): number {
	return Math.abs(amount_paise);
}
