// Money utilities. All values are integer paise. No floats near money.

const formatter = new Intl.NumberFormat('en-IN', {
	style: 'currency',
	currency: 'INR',
	minimumFractionDigits: 0,
	maximumFractionDigits: 2
});

const formatterFraction = new Intl.NumberFormat('en-IN', {
	style: 'currency',
	currency: 'INR',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

/**
 * Format paise as a human-readable INR string.
 * 15000 → "₹150" or "₹150.50" when paise are non-zero.
 */
export function formatPaise(paise: number): string {
	const rupees = paise / 100;
	return paise % 100 === 0 ? formatter.format(rupees) : formatterFraction.format(rupees);
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
	return formatterFraction.format(paise / 100);
}

/** Return true if the transaction is an expense (negative paise). */
export function isExpense(amount_paise: number): boolean {
	return amount_paise < 0;
}

/** Absolute value of paise, for display. */
export function absPaise(amount_paise: number): number {
	return Math.abs(amount_paise);
}
