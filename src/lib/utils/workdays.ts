// Pure date logic for resolving recurring dates (salary, month-end obligations)
// around weekends and bank holidays. No I/O, no timezone state: callers pass the
// year/month and the holiday set for the user's state. Shared by recurring
// income and obligations so both behave identically.

export type SalaryAnchor =
	| { kind: 'end_of_month' }
	| { kind: 'start_of_month' }
	| { kind: 'day_of_month'; day: number }; // 1..28 (clamped to month length)

export type RollDirection = 'back' | 'forward';

/** ISO 'YYYY-MM-DD' dates (IST) that are bank holidays. See holidays.ts. */
export type HolidaySet = ReadonlySet<string>;

function pad(n: number): string {
	return n < 10 ? `0${n}` : String(n);
}

/** Build an ISO date string 'YYYY-MM-DD' (month is 1-based). */
export function isoDate(year: number, month: number, day: number): string {
	return `${year}-${pad(month)}-${pad(day)}`;
}

/** Days in a month (month is 1-based). */
export function daysInMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate();
}

/** 0 = Sunday ... 6 = Saturday. UTC-based so there is no timezone drift. */
function weekday(year: number, month: number, day: number): number {
	return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function isWeekend(year: number, month: number, day: number): boolean {
	const w = weekday(year, month, day);
	return w === 0 || w === 6;
}

export function isWorkingDay(
	year: number,
	month: number,
	day: number,
	holidays: HolidaySet
): boolean {
	return !isWeekend(year, month, day) && !holidays.has(isoDate(year, month, day));
}

/** The raw, pre-adjustment day for an anchor in a given month. */
function anchorDay(anchor: SalaryAnchor, year: number, month: number): number {
	switch (anchor.kind) {
		case 'end_of_month':
			return daysInMonth(year, month);
		case 'start_of_month':
			return 1;
		case 'day_of_month':
			// Clamp to the month length (e.g. day 30 in February).
			return Math.min(Math.max(anchor.day, 1), daysInMonth(year, month));
	}
}

/**
 * Resolve the actual credited date for an anchor in a month, adjusting around
 * weekends and bank holidays.
 *
 * Direction rule (locked): roll back for end-of-month and mid-month anchors;
 * roll forward for start-of-month so the 1st stays in the same month. Pass
 * `direction` to override.
 *
 * Adjustment is confined to the same month. If the preferred direction runs off
 * the month edge with no working day, it falls back to the nearest working day
 * in the opposite direction. Returns an ISO 'YYYY-MM-DD' date.
 */
export function resolvePaymentDate(
	anchor: SalaryAnchor,
	year: number,
	month: number,
	holidays: HolidaySet,
	direction?: RollDirection
): string {
	const dir: RollDirection = direction ?? (anchor.kind === 'start_of_month' ? 'forward' : 'back');
	const dim = daysInMonth(year, month);
	const start = anchorDay(anchor, year, month);
	const step = dir === 'back' ? -1 : 1;

	// Scan in the preferred direction from the anchor.
	for (let d = start; d >= 1 && d <= dim; d += step) {
		if (isWorkingDay(year, month, d, holidays)) return isoDate(year, month, d);
	}
	// Preferred direction exhausted: scan the opposite way from the anchor.
	for (let d = start - step; d >= 1 && d <= dim; d -= step) {
		if (isWorkingDay(year, month, d, holidays)) return isoDate(year, month, d);
	}
	// Degenerate (no working day in the month at all): return the raw anchor.
	return isoDate(year, month, start);
}
