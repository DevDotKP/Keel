// Date utilities. No external date library — only what Keel needs.
// India-first: all user-facing datetimes use IST (UTC+5:30) offset so that
// period boundary comparisons in D1 (lexicographic string comparison against
// YYYY-MM-DD date strings) always match the user's local calendar day.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30 = 19800000 ms

/**
 * Format a Date as an IST ISO 8601 string with +05:30 offset.
 * e.g. 2026-06-15T23:30:00+05:30
 *
 * D1 period boundaries are YYYY-MM-DD strings. SQL comparison is lexicographic,
 * so storing occurred_at with +05:30 ensures the date portion matches the
 * user's local date even for midnight entries.
 */
export function toIstIso(d: Date): string {
	const ist = new Date(d.getTime() + IST_OFFSET_MS);
	const ymd = ist.toISOString().slice(0, 10);
	const hms = ist.toISOString().slice(11, 19);
	return `${ymd}T${hms}+05:30`;
}

/** Return today's date as 'YYYY-MM-DD' in IST. */
export function today(): string {
	return toIstIso(new Date()).slice(0, 10);
}

/** Return now as an IST ISO datetime string with +05:30 offset. */
export function nowIso(): string {
	return toIstIso(new Date());
}

/** Format a Date as 'YYYY-MM-DD' in IST. */
export function toDateString(d: Date): string {
	return toIstIso(d).slice(0, 10);
}

/**
 * Parse flexible date input to an IST ISO datetime string.
 * Accepts: 'today', 'yesterday', '-1d', '-3d', YYYY-MM-DD, or any
 * value Date.parse understands. Falls back to now on invalid input.
 */
export function parseFlexDate(input: string): string {
	if (!input || input === 'today') return nowIso();
	if (input === 'yesterday') return toIstIso(subDays(new Date(), 1));
	const shorthand = input.match(/^-(\d+)d$/);
	if (shorthand) return toIstIso(subDays(new Date(), parseInt(shorthand[1], 10)));
	// Date-only input (YYYY-MM-DD) from the date picker: treat as IST midnight.
	// Do not parse via new Date() — that would yield UTC midnight (wrong date for IST).
	if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return `${input}T00:00:00+05:30`;
	const parsed = new Date(input);
	return isNaN(parsed.getTime()) ? nowIso() : toIstIso(parsed);
}

function subDays(date: Date, n: number): Date {
	const d = new Date(date);
	d.setDate(d.getDate() - n);
	return d;
}

/**
 * Format an ISO date string for display.
 * '2026-06-18' or '2026-06-18T00:00:00+05:30' → 'Thu, 18 Jun'
 */
export function formatDisplayDate(iso: string): string {
	return new Date(iso).toLocaleDateString('en-IN', {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});
}

/**
 * Format a logging timestamp as an IST clock time, e.g. '9:30 pm'.
 * Accepts SQLite UTC ('YYYY-MM-DD HH:MM:SS', as entered_at is stored) or any
 * ISO string. Offset is applied manually so it does not depend on the runtime
 * shipping IANA timezone data (Cloudflare Workers may not).
 */
export function formatIstTime(input: string): string {
	if (!input) return '';
	// SQLite datetime('now') is UTC with no zone marker; tag it as UTC.
	const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(input)
		? input.replace(' ', 'T') + 'Z'
		: input;
	const d = new Date(iso);
	if (isNaN(d.getTime())) return '';
	const ist = new Date(d.getTime() + IST_OFFSET_MS);
	let h = ist.getUTCHours();
	const m = ist.getUTCMinutes();
	const ampm = h >= 12 ? 'pm' : 'am';
	h = h % 12 || 12;
	return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
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
