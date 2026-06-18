// Date utilities. No external date library — only what Keel needs.

/** Return today's date as 'YYYY-MM-DD'. */
export function today(): string {
	return toDateString(new Date());
}

/** Return now as an ISO datetime string. */
export function nowIso(): string {
	return new Date().toISOString();
}

/** Format a Date as 'YYYY-MM-DD'. */
export function toDateString(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/**
 * Parse flexible date input to an ISO datetime string.
 * Accepts: 'today', 'yesterday', '-1d', '-3d', or any value Date.parse understands.
 * Falls back to now on invalid input.
 */
export function parseFlexDate(input: string): string {
	if (!input || input === 'today') return nowIso();
	if (input === 'yesterday') return subDays(new Date(), 1).toISOString();
	const shorthand = input.match(/^-(\d+)d$/);
	if (shorthand) return subDays(new Date(), parseInt(shorthand[1], 10)).toISOString();
	const parsed = new Date(input);
	return isNaN(parsed.getTime()) ? nowIso() : parsed.toISOString();
}

function subDays(date: Date, n: number): Date {
	const d = new Date(date);
	d.setDate(d.getDate() - n);
	return d;
}

/**
 * Format an ISO date string for display.
 * '2026-06-18' → 'Thu, 18 Jun'
 */
export function formatDisplayDate(iso: string): string {
	return new Date(iso).toLocaleDateString('en-IN', {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});
}

/**
 * Return the Monday of the week containing the given date.
 * Used for computing period_start when cadence is weekly.
 */
export function weekStart(date: Date = new Date()): Date {
	const d = new Date(date);
	const day = d.getDay(); // 0 = Sun
	const diff = day === 0 ? -6 : 1 - day;
	d.setDate(d.getDate() + diff);
	d.setHours(0, 0, 0, 0);
	return d;
}
