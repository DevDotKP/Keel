import { describe, it, expect } from 'vitest';
import { toIstIso, nowIso, parseFlexDate, today } from './date';

/**
 * Unit tests for IST date handling.
 *
 * Keel stores occurred_at with the IST offset (+05:30) so that D1's
 * lexicographic period-boundary comparisons (YYYY-MM-DD strings) are exact
 * for Indian users. The critical invariant: the YYYY-MM-DD prefix of the
 * stored occurred_at must match the user's calendar date in IST.
 */

describe('toIstIso', () => {
	it('converts a UTC midnight date to IST 05:30 on the same calendar day', () => {
		// 2026-06-15T00:00:00Z = 2026-06-15T05:30:00+05:30
		const utcMidnight = new Date('2026-06-15T00:00:00.000Z');
		const ist = toIstIso(utcMidnight);
		expect(ist).toBe('2026-06-15T05:30:00+05:30');
	});

	it('handles a near-midnight UTC time that crosses into the next IST day', () => {
		// 2026-06-14T19:00:00Z = 2026-06-15T00:30:00+05:30 (past midnight IST)
		const utc = new Date('2026-06-14T19:00:00.000Z');
		const ist = toIstIso(utc);
		expect(ist.slice(0, 10)).toBe('2026-06-15'); // correct IST date
		expect(ist).toBe('2026-06-15T00:30:00+05:30');
	});

	it('preserves the IST calendar day for entries between midnight and 5:30am IST', () => {
		// Voice entry at 1am IST = 2026-06-14T19:30:00Z (UTC previous day)
		// Without IST fix, comparing against period '2026-06-15' would fail.
		const utcPrevDay = new Date('2026-06-14T19:30:00.000Z');
		const ist = toIstIso(utcPrevDay);
		// The date portion is 2026-06-15 (IST) — correct for period comparison
		expect(ist.slice(0, 10)).toBe('2026-06-15');
	});

	it('output ends with +05:30 offset marker', () => {
		const ist = toIstIso(new Date('2026-06-15T12:00:00.000Z'));
		expect(ist.endsWith('+05:30')).toBe(true);
	});

	it('format is YYYY-MM-DDTHH:MM:SS+05:30 (no milliseconds)', () => {
		const ist = toIstIso(new Date('2026-06-15T06:30:00.000Z'));
		expect(ist).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+05:30$/);
	});
});

describe('nowIso', () => {
	it('returns a string ending in +05:30', () => {
		expect(nowIso().endsWith('+05:30')).toBe(true);
	});

	it('returns today\'s IST date in the YYYY-MM-DD prefix', () => {
		const ist = toIstIso(new Date());
		const expected = ist.slice(0, 10);
		expect(nowIso().slice(0, 10)).toBe(expected);
	});
});

describe('today', () => {
	it('returns today\'s IST date as YYYY-MM-DD', () => {
		const expected = toIstIso(new Date()).slice(0, 10);
		expect(today()).toBe(expected);
	});
});

describe('parseFlexDate', () => {
	it('returns IST offset for "today"', () => {
		const result = parseFlexDate('today');
		expect(result.endsWith('+05:30')).toBe(true);
	});

	it('returns IST offset for empty string fallback', () => {
		expect(parseFlexDate('').endsWith('+05:30')).toBe(true);
	});

	it('returns IST midnight for a date-only YYYY-MM-DD input', () => {
		const result = parseFlexDate('2026-06-15');
		expect(result).toBe('2026-06-15T00:00:00+05:30');
	});

	it('date-only input preserves the picked date — never shifts to UTC equivalent', () => {
		// Before fix: new Date('2026-06-15') = UTC midnight, .toISOString() = '2026-06-15T00:00:00.000Z'
		// That was fine for SQL comparison, but new Date('2026-06-01') with getTime() in IST
		// is actually June 1 5:30am IST. Explicit IST midnight is more correct.
		const result = parseFlexDate('2026-06-01');
		expect(result).toBe('2026-06-01T00:00:00+05:30');
	});

	it('returns IST offset for "yesterday"', () => {
		const result = parseFlexDate('yesterday');
		expect(result.endsWith('+05:30')).toBe(true);
		// yesterday's date should differ from today's
		const todayStr = parseFlexDate('today').slice(0, 10);
		const yesterdayStr = result.slice(0, 10);
		expect(yesterdayStr).not.toBe(todayStr);
	});

	it('returns IST offset for -Nd shorthand', () => {
		expect(parseFlexDate('-2d').endsWith('+05:30')).toBe(true);
		expect(parseFlexDate('-7d').endsWith('+05:30')).toBe(true);
	});

	it('falls back to nowIso for invalid input', () => {
		const result = parseFlexDate('not-a-date');
		expect(result.endsWith('+05:30')).toBe(true);
	});
});

describe('period boundary SQL comparison invariant', () => {
	// These simulate the D1 lexicographic comparison that period queries use.
	// occurred_at >= period_start AND occurred_at < period_end_exclusive
	// Where period_start and period_end are YYYY-MM-DD strings.

	function inPeriod(occurredAt: string, start: string, endExclusive: string): boolean {
		return occurredAt >= start && occurredAt < endExclusive;
	}

	it('IST midnight entry falls in the correct period', () => {
		// Entry at 2026-06-15T00:00:00+05:30 — midnight IST, should be in June period
		const occurred = '2026-06-15T00:00:00+05:30';
		expect(inPeriod(occurred, '2026-06-01', '2026-07-01')).toBe(true);
	});

	it('IST 1am entry that was previously UTC previous-day now falls correctly', () => {
		// 1am IST June 15 = UTC June 14 7:30pm
		// Old: '2026-06-14T19:30:00.000Z' → NOT in June 15 period (wrong)
		// New: '2026-06-15T01:00:00+05:30' → IN June 15 period (correct)
		const fixed = '2026-06-15T01:00:00+05:30';
		expect(inPeriod(fixed, '2026-06-15', '2026-06-16')).toBe(true);
		// Old value would fail:
		const broken = '2026-06-14T19:30:00.000Z';
		expect(inPeriod(broken, '2026-06-15', '2026-06-16')).toBe(false);
	});

	it('11pm IST entry stays in the same calendar day period', () => {
		const occurred = '2026-06-15T23:00:00+05:30';
		expect(inPeriod(occurred, '2026-06-15', '2026-06-16')).toBe(true);
	});

	it('entry at end of period does not bleed into next period', () => {
		// 2026-06-30T23:59:59+05:30 — last second of June in IST
		const occurred = '2026-06-30T23:59:59+05:30';
		expect(inPeriod(occurred, '2026-06-01', '2026-07-01')).toBe(true);
		expect(inPeriod(occurred, '2026-07-01', '2026-08-01')).toBe(false);
	});

	it('date-picker entry (IST midnight) is correctly in its period', () => {
		// User picks 2026-06-15 → stored as '2026-06-15T00:00:00+05:30'
		const occurred = parseFlexDate('2026-06-15');
		expect(inPeriod(occurred, '2026-06-01', '2026-07-01')).toBe(true);
		expect(inPeriod(occurred, '2026-07-01', '2026-08-01')).toBe(false);
	});
});
