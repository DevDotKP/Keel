import { describe, it, expect } from 'vitest';
import {
	resolvePaymentDate,
	daysInMonth,
	isWeekend,
	isWorkingDay,
	type SalaryAnchor
} from './workdays';
import { holidaysForState } from '$lib/holidays';

const NONE = new Set<string>();
const END: SalaryAnchor = { kind: 'end_of_month' };
const START: SalaryAnchor = { kind: 'start_of_month' };

describe('daysInMonth', () => {
	it('handles leap and non-leap February', () => {
		expect(daysInMonth(2024, 2)).toBe(29);
		expect(daysInMonth(2025, 2)).toBe(28);
		expect(daysInMonth(2025, 8)).toBe(31);
	});
});

describe('isWeekend / isWorkingDay', () => {
	it('flags Aug 2025 weekend correctly', () => {
		// Aug 31 2025 is a Sunday, Aug 30 a Saturday, Aug 29 a Friday.
		expect(isWeekend(2025, 8, 31)).toBe(true);
		expect(isWeekend(2025, 8, 30)).toBe(true);
		expect(isWeekend(2025, 8, 29)).toBe(false);
	});

	it('treats a national holiday as a non-working day', () => {
		const h = holidaysForState(null, 2026);
		expect(isWorkingDay(2026, 1, 26, h)).toBe(false); // Republic Day
		expect(isWorkingDay(2026, 1, 23, h)).toBe(true);
	});
});

describe('resolvePaymentDate', () => {
	it('rolls end-of-month back over a weekend (the 29th example)', () => {
		// Aug 2025: 31 Sun, 30 Sat -> credited the 29th (Fri).
		expect(resolvePaymentDate(END, 2025, 8, NONE)).toBe('2025-08-29');
	});

	it('rolls start-of-month forward so it stays in the same month', () => {
		// Feb 1 2025 is a Saturday, the 2nd a Sunday -> the 3rd (Mon).
		expect(resolvePaymentDate(START, 2025, 2, NONE)).toBe('2025-02-03');
	});

	it('rolls a mid-month day back across a holiday and a weekend', () => {
		// Aug 16 2025 is Saturday; the 15th is Independence Day -> the 14th (Thu).
		const h = holidaysForState(null, 2025);
		expect(resolvePaymentDate({ kind: 'day_of_month', day: 16 }, 2025, 8, h)).toBe('2025-08-14');
	});

	it('rolls a holiday-on-Monday back across the weekend', () => {
		// Jan 26 2026 (Republic Day) is a Monday -> back to Fri the 23rd.
		const h = holidaysForState(null, 2026);
		expect(resolvePaymentDate({ kind: 'day_of_month', day: 26 }, 2026, 1, h)).toBe('2026-01-23');
	});

	it('clamps a day beyond the month length', () => {
		// Day 31 in Feb clamps to the 28th (2025), which is a working Friday.
		expect(resolvePaymentDate({ kind: 'day_of_month', day: 31 }, 2025, 2, NONE)).toBe('2025-02-28');
	});

	it('leaves a working-day anchor untouched', () => {
		// Feb 2025 ends on Friday the 28th, a working day.
		expect(resolvePaymentDate(END, 2025, 2, NONE)).toBe('2025-02-28');
	});
});
