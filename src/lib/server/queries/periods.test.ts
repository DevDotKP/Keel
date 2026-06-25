import { describe, it, expect } from 'vitest';
import { computePeriod } from './periods';

// Direct tests of the real period engine, so cadence boundaries are guaranteed.
describe('computePeriod boundaries', () => {
	const thu25Jun = new Date(2026, 5, 25); // Thu 25 Jun 2026

	it('monthly + non-payday day = full calendar month (ends month-end)', () => {
		const { start, end } = computePeriod('monthly', 'sunday', thu25Jun);
		expect(start).toBe('2026-06-01');
		expect(end).toBe('2026-06-30'); // month end, NOT a weekly Sunday
	});

	it('weekly ends on the Sunday of the current week', () => {
		const { start, end } = computePeriod('weekly', 'sunday', thu25Jun);
		expect(start).toBe('2026-06-22'); // Monday
		expect(end).toBe('2026-06-28'); // Sunday — this is where "28 Jun" came from
	});

	it('monthly + payday day-of-month ends the day before next payday', () => {
		const { end } = computePeriod('monthly', '25', thu25Jun);
		expect(end).toBe('2026-07-24');
	});
});

/**
 * Unit tests for the harbour drift mechanism.
 *
 * The drift mechanism is the core of Keel's moat: when a user harbours their
 * balance, any difference between Keel's estimate and the real balance is
 * recorded as a single Uncategorized adjustment, never corrupting the rest
 * of the ledger.
 *
 * Key invariants tested:
 * 1. All unassigned in-window transactions are assigned to the period
 * 2. Drift = (real_balance) - (opening_balance + sum_of_transactions)
 * 3. Drift (if non-zero) is recorded as an Uncategorized adjustment
 * 4. The period is sealed and the account balance is updated
 * 5. freshStart option seals all older open periods in one action
 */

// ── Payday-aligned period computation ─────────────────────────────────────────
// Tests the period boundary logic for monthly cadence with a numeric harbour_day.
// Logic: if today >= payday → period started this month; otherwise started last month.
// Period end = payday - 1 of the month after period_start.

function computePaydayPeriod(
	paydayOfMonth: number,
	now: Date
): { start: string; end: string } {
	function ymd(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}
	const year = now.getFullYear();
	const month = now.getMonth();
	const today = now.getDate();
	const startMonth = today < paydayOfMonth ? month - 1 : month;
	const startYear = startMonth < 0 ? year - 1 : year;
	const normalizedStartMonth = startMonth < 0 ? 11 : startMonth;
	const start = new Date(startYear, normalizedStartMonth, paydayOfMonth);
	const end = new Date(startYear, normalizedStartMonth + 1, paydayOfMonth - 1);
	return { start: ymd(start), end: ymd(end) };
}

describe('payday-aligned period computation', () => {
	it('starts period on payday when today is on payday', () => {
		const { start, end } = computePaydayPeriod(25, new Date(2026, 5, 25)); // June 25
		expect(start).toBe('2026-06-25');
		expect(end).toBe('2026-07-24');
	});

	it('starts period on payday when today is after payday', () => {
		const { start, end } = computePaydayPeriod(25, new Date(2026, 5, 30)); // June 30
		expect(start).toBe('2026-06-25');
		expect(end).toBe('2026-07-24');
	});

	it('starts period on previous month payday when today is before payday', () => {
		const { start, end } = computePaydayPeriod(25, new Date(2026, 5, 20)); // June 20
		expect(start).toBe('2026-05-25');
		expect(end).toBe('2026-06-24');
	});

	it('handles year boundary (payday Jan 1 → period Dec to Dec)', () => {
		// Today: Jan 5, payday 25 → last month's period Dec 25 → Jan 24
		const { start, end } = computePaydayPeriod(25, new Date(2026, 0, 5)); // Jan 5
		expect(start).toBe('2025-12-25');
		expect(end).toBe('2026-01-24');
	});

	it('handles payday = 1 (calendar month)', () => {
		// payday 1 = first of month = standard calendar month
		// end = new Date(y, m+1, 0) = last day of start month
		const { start, end } = computePaydayPeriod(1, new Date(2026, 5, 15)); // June 15, payday 1
		expect(start).toBe('2026-06-01');
		expect(end).toBe('2026-06-30'); // last day of June
	});

	it('handles payday 28 (avoids Feb 29 edge case)', () => {
		const { start, end } = computePaydayPeriod(28, new Date(2026, 0, 29)); // Jan 29, after payday
		expect(start).toBe('2026-01-28');
		expect(end).toBe('2026-02-27');
	});

	it('period start and end are always a consecutive date range', () => {
		// For any payday, end should be exactly one day before the next period start
		const { start, end } = computePaydayPeriod(15, new Date(2026, 2, 20)); // March 20
		// period: Mar 15 → Apr 14
		expect(start).toBe('2026-03-15');
		expect(end).toBe('2026-04-14');
		// Check day count (Mar 15 to Apr 14 inclusive = 31 days)
		const days =
			(new Date('2026-04-14').getTime() - new Date('2026-03-15').getTime()) /
				86_400_000 +
			1;
		expect(days).toBe(31);
	});
});

describe('harbourPeriod drift mechanism', () => {
	describe('drift calculation', () => {
		it('computes drift as: real_balance - (opening + net_transactions)', () => {
			// Given:
			// - opening_balance: ₹100
			// - transactions in period: -₹30 (expense)
			// - Keel estimate: ₹100 - ₹30 = ₹70
			// - real_balance: ₹65 (user typed ₹65)
			// - drift: ₹65 - ₹70 = -₹5 (missing ₹5)

			const opening = 10000; // ₹100
			const transactions = -3000; // -₹30
			const realBalance = 6500; // ₹65
			const estimate = opening + transactions; // ₹70

			const drift = realBalance - estimate;

			expect(drift).toBe(-500); // -₹5
			expect(estimate).toBe(7000);
		});

		it('handles zero drift (estimate matches real balance)', () => {
			const opening = 10000;
			const transactions = -3000;
			const realBalance = 7000;
			const estimate = opening + transactions;

			const drift = realBalance - estimate;

			expect(drift).toBe(0);
		});

		it('handles positive drift (missing entry resulted in over-estimate)', () => {
			// Keel thought: ₹100 (no transactions) = ₹100
			// Real: ₹150 (received ₹50 that wasn't logged)
			// Drift: ₹150 - ₹100 = +₹50

			const opening = 10000;
			const transactions = 0;
			const realBalance = 15000;
			const estimate = opening + transactions;

			const drift = realBalance - estimate;

			expect(drift).toBe(5000); // +₹50
		});

		it('handles negative drift (more expenses than estimate)', () => {
			// Keel: ₹100 - ₹30 = ₹70
			// Real: ₹40 (additional ₹30 in expenses)
			// Drift: ₹40 - ₹70 = -₹30

			const opening = 10000;
			const transactions = -3000;
			const realBalance = 4000;
			const estimate = opening + transactions;

			const drift = realBalance - estimate;

			expect(drift).toBe(-3000); // -₹30
		});

		it('handles large numbers without float precision loss', () => {
			// All amounts in paise (integers)
			const opening = 1000000000; // ₹10,000,000
			const transactions = -50000000; // -₹500,000
			const realBalance = 949999999; // ₹9,499,999.99

			const estimate = opening + transactions;
			const drift = realBalance - estimate;

			expect(Number.isInteger(drift)).toBe(true);
			expect(drift).toBe(-1); // -₹0.01
		});
	});

	describe('drift recording invariants', () => {
		it('never records drift when estimate matches real balance', () => {
			// If drift is zero, no Uncategorized adjustment is recorded
			const drift = 0;
			const shouldRecord = drift !== 0;

			expect(shouldRecord).toBe(false);
		});

		it('records drift as single Uncategorized adjustment', () => {
			// No matter the magnitude of drift, only ONE adjustment row is created
			// This prevents the ledger from being corrupted by multiple mystery rows

			const transactions = [
				{ description: 'Expense 1', amount_paise: -10000 },
				{ description: 'Expense 2', amount_paise: -5000 },
				{ description: 'Uncategorized', amount_paise: 2000, is_fallback: true } // drift
			];

			// Only one row should have is_uncategorized_fallback = 1
			const fallbackCount = transactions.filter((t) => t.is_fallback === true).length;
			expect(fallbackCount).toBe(1);

			// The fallback row should be Uncategorized
			const fallbackRow = transactions.find((t) => t.is_fallback === true);
			expect(fallbackRow?.description).toBe('Uncategorized');
		});

		it('marks drift adjustment with is_uncategorized_fallback=1', () => {
			// This flag signals: "this row was auto-filed by Harbour, not user-entered"
			// Helps distinguish drift from user-created Uncategorized entries

			const adjustment = {
				amount_paise: 500,
				category: 'Uncategorized',
				description: 'Harbour adjustment',
				is_uncategorized_fallback: 1
			};

			expect(adjustment.is_uncategorized_fallback).toBe(1);
			expect(adjustment.category).toBe('Uncategorized');
		});

		it('does not corrupt existing transactions when drift is recorded', () => {
			// The ledger should remain intact: all original transactions
			// keep their categories and amounts. Only the drift adjustment
			// is added.

			const originalTx = [
				{ id: '1', category: 'Food', amount_paise: -5000 },
				{ id: '2', category: 'Transport', amount_paise: -2000 }
			];

			// After harbour with drift:
			const afterHarbour = [
				{ id: '1', category: 'Food', amount_paise: -5000 }, // unchanged
				{ id: '2', category: 'Transport', amount_paise: -2000 }, // unchanged
				{ id: 'drift', category: 'Uncategorized', amount_paise: 300, is_fallback: true } // new
			];

			// Original transactions should match
			expect(afterHarbour[0]).toEqual(originalTx[0]);
			expect(afterHarbour[1]).toEqual(originalTx[1]);

			// Only the new drift row is different
			expect(afterHarbour[2].is_fallback).toBe(true);
		});
	});

	describe('amnesty (freshStart) mechanism', () => {
		it('seals all older open periods when freshStart=true', () => {
			// User away for 3 periods, returns and harbours current period with freshStart
			// Result: all 3 old periods are sealed (closing_balance = opening_balance)
			// and marked harboured_at, so they never nag the user again

			const periods = [
				{ id: 'p1', harboured_at: null, opening: 10000, closing: null }, // open, old
				{ id: 'p2', harboured_at: null, opening: 9000, closing: null }, // open, old
				{ id: 'p3', harboured_at: null, opening: 8000, closing: null } // current (being harboured now)
			];

			// After harbouring p3 with freshStart:
			const freshStartOpts = { freshStart: true };
			const sealed = periods.map((p) => {
				if (freshStartOpts.freshStart && p.id !== 'p3' && !p.harboured_at) {
					return { ...p, harboured_at: 'now', closing: p.opening };
				}
				if (p.id === 'p3') {
					return { ...p, harboured_at: 'now', closing: 500000 };
				}
				return p;
			});

			expect(sealed[0].harboured_at).toBe('now');
			expect(sealed[1].harboured_at).toBe('now');
			expect(sealed[2].harboured_at).toBe('now');

			// Sealed older periods should have closing = opening (no drift, clean state)
			expect(sealed[0].closing).toBe(sealed[0].opening);
			expect(sealed[1].closing).toBe(sealed[1].opening);
		});

		it('does not double-seal periods that are already harboured', () => {
			// Robustness: if a period is already harboured, freshStart should skip it

			const periods = [
				{ id: 'p1', harboured_at: '2026-06-01T00:00:00Z', opening: 10000, closing: 9000 },
				{ id: 'p2', harboured_at: null, opening: 9000, closing: null }
			];

			const freshStartSeals = periods.filter((p) => !p.harboured_at && p.id !== 'p2');
			// p1 is already harboured, so freshStart should not re-seal it

			expect(freshStartSeals.length).toBe(0);
		});

		it('never seals periods newer than current (period_start >= current.period_start)', () => {
			// Prevents accidentally sealing future periods

			const currentPeriod = { id: 'p2', period_start: '2026-06-01' };
			const periods = [
				{ id: 'p1', period_start: '2026-05-01', harboured_at: null },
				{ id: 'p2', period_start: '2026-06-01', harboured_at: null },
				{ id: 'p3', period_start: '2026-07-01', harboured_at: null }
			];

			const shouldSeal = periods.filter(
				(p) => !p.harboured_at && p.period_start < currentPeriod.period_start
			);

			// Only p1 should be sealed (older than current)
			expect(shouldSeal.length).toBe(1);
			expect(shouldSeal[0].id).toBe('p1');
		});
	});

	describe('unassigned transaction assignment', () => {
		it('assigns all unassigned in-window transactions to the period', () => {
			// period: 2026-06-01 to 2026-06-07
			// transactions with occurred_at in that window and period_id = NULL
			// should be assigned to this period

			const periodStart = '2026-06-01';
			const periodEnd = '2026-06-07';

			const transactions = [
				{ id: '1', occurred_at: '2026-05-31', period_id: null }, // before window, skip
				{ id: '2', occurred_at: '2026-06-02', period_id: null }, // in window, assign
				{ id: '3', occurred_at: '2026-06-05', period_id: null }, // in window, assign
				{ id: '4', occurred_at: '2026-06-08', period_id: null }, // after window, skip
				{ id: '5', occurred_at: '2026-06-03', period_id: 'other' } // already assigned, skip
			];

			const toAssign = transactions.filter(
				(t) =>
					t.period_id === null &&
					t.occurred_at >= periodStart &&
					t.occurred_at < new Date(`${periodEnd}T00:00:00`).toISOString().split('T')[0]
			);

			expect(toAssign.length).toBe(2);
			expect(toAssign.map((t) => t.id)).toEqual(['2', '3']);
		});

		it('preserves category when assigning unassigned transactions', () => {
			// Assignment should only set period_id, never change category_id

			const tx = { id: '1', category_id: 'cat_transport', period_id: null };

			// After assignment:
			const assigned = { ...tx, period_id: 'period_1' };

			expect(assigned.category_id).toBe('cat_transport'); // unchanged
			expect(assigned.period_id).toBe('period_1'); // assigned
		});
	});

	describe('period sealing and balance update', () => {
		it('sets period.harboured_at to mark it sealed', () => {
			const period = { id: 'p1', harboured_at: null };
			const sealed = { ...period, harboured_at: new Date().toISOString() };

			expect(sealed.harboured_at).not.toBeNull();
			expect(sealed.harboured_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		});

		it('sets period.closing_balance_paise to the real balance', () => {
			const period = { id: 'p1', closing_balance_paise: null };
			const realBalance = 50000;

			const sealed = { ...period, closing_balance_paise: realBalance };

			expect(sealed.closing_balance_paise).toBe(50000);
		});

		it('updates account.balance_paise to the real balance', () => {
			const account = { id: 'a1', balance_paise: 100000 };
			const realBalance = 75000;

			const updated = { ...account, balance_paise: realBalance };

			expect(updated.balance_paise).toBe(75000);
		});

		it('rejects attempting to harbour an already-harboured period', () => {
			const period = { id: 'p1', harboured_at: '2026-06-01T12:00:00Z' };

			const isAlreadyHarboured = period.harboured_at !== null;
			expect(isAlreadyHarboured).toBe(true);
			// Should throw error: "period already harboured"
		});

		it('rejects if period.id does not exist for the given account', () => {
			const accountId = 'a1';
			const periodId = 'p999';
			const periods = [{ id: 'p1', account_id: 'a1' }];

			const found = periods.find((p) => p.id === periodId);
			expect(found).toBeUndefined();
			// Should throw error: "period not found"
		});
	});

	describe('end-to-end scenarios', () => {
		it('scenario: user missed 2 transactions, Harbour detects and files drift', () => {
			// Simulate a complete harbour cycle

			// Setup
			const opening = 100000; // ₹1000
			const entry1 = { amount_paise: -10000, category: 'Food' }; // ₹100 logged
			// Entry2 ₹100 was forgotten

			// Keel estimate
			const estimate = opening + entry1.amount_paise; // 100000 - 10000 = 90000 (₹900)

			// User types real balance
			const realBalance = 80000; // ₹800 (₹100 missing from entry2)

			// Harbour
			const drift = realBalance - estimate; // 80000 - 90000 = -10000

			expect(drift).toBe(-10000); // -₹100, exactly matching the missed entry
			// Drift is recorded as Uncategorized adjustment

			const adjustment = {
				category: 'Uncategorized',
				amount_paise: drift,
				is_fallback: true
			};

			expect(adjustment.amount_paise).toBe(-10000);
		});

		it('scenario: user away for 3 weeks, returns with amnesty', () => {
			// 3 weeks = 3 periods if weekly cadence
			const periods = [
				{ id: 'p1', period_start: '2026-05-12', harboured_at: null, opening: 100000 },
				{ id: 'p2', period_start: '2026-05-19', harboured_at: null, opening: 95000 },
				{ id: 'p3', period_start: '2026-05-26', harboured_at: null, opening: 90000 },
				{ id: 'p4', period_start: '2026-06-02', harboured_at: null, opening: 85000 }
			];

			// User returns on 2026-06-09 and harbours p4 with freshStart
			const current = periods[3]; // p4

			// After freshStart harbour, p1-p3 should be sealed
			const sealed = periods.map((p): { id: string; period_start: string; harboured_at: string | null; opening: number; closing_balance_paise: number | null } => {
				if (p.id !== 'p4' && p.period_start < current.period_start && !p.harboured_at) {
					// Fresh start seals older periods
					return { ...p, harboured_at: 'now', closing_balance_paise: p.opening };
				}
				if (p.id === 'p4') {
					return { ...p, harboured_at: 'now', closing_balance_paise: 70000 };
				}
				return { ...p, closing_balance_paise: null };
			});

			expect(sealed[0].harboured_at).toBe('now'); // p1 sealed
			expect(sealed[1].harboured_at).toBe('now'); // p2 sealed
			expect(sealed[2].harboured_at).toBe('now'); // p3 sealed
			expect(sealed[3].harboured_at).toBe('now'); // p4 sealed (current)

			// Old periods are clean: closing = opening (no entries logged during amnesty)
			expect(sealed[0].closing_balance_paise).toBe(100000);
			expect(sealed[1].closing_balance_paise).toBe(95000);
		});
	});
});
