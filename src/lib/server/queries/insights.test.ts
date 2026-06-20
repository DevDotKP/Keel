import { describe, it, expect } from 'vitest';

/**
 * Unit tests for the insights drift trend mechanic.
 *
 * The drift trend shows the user how their harbour adjustments are changing
 * over time. Smaller = more faithful tracking = "picture getting clearer."
 *
 * Key invariants:
 * 1. drift_paise is the ABS of the harbour adjustment amount (always >= 0)
 * 2. A period with zero drift_paise means perfect tracking
 * 3. "Improving" = latest period drift < previous period drift
 * 4. drift_paise only counts the 'Harbour adjustment' row, not organic uncat
 */

// ── Drift computation helpers (mirrors the SQL logic in insights.ts) ──────────

interface MockTransaction {
	amount_paise: number;
	is_uncategorized_fallback: 0 | 1;
	description: string;
}

function computeDriftFromTransactions(transactions: MockTransaction[]): number {
	// ABS of the harbour adjustment transaction only.
	// Mirrors: ABS(SUM(CASE WHEN is_uncategorized_fallback=1 AND description='Harbour adjustment'))
	const adjustmentSum = transactions
		.filter(t => t.is_uncategorized_fallback === 1 && t.description === 'Harbour adjustment')
		.reduce((sum, t) => sum + t.amount_paise, 0);
	return Math.abs(adjustmentSum);
}

function isDriftImproving(periods: Array<{ drift_paise: number }>): boolean {
	if (periods.length < 2) return false;
	// periods[0] is newest (ORDER BY period_start DESC)
	return periods[0].drift_paise < periods[1].drift_paise;
}

describe('drift_paise computation', () => {
	it('returns the absolute value of the harbour adjustment', () => {
		const txs: MockTransaction[] = [
			{ amount_paise: -5000, is_uncategorized_fallback: 0, description: 'Swiggy' },
			{ amount_paise: -3000, is_uncategorized_fallback: 1, description: 'Harbour adjustment' }
		];
		expect(computeDriftFromTransactions(txs)).toBe(3000);
	});

	it('returns abs value for a positive harbour adjustment (income drift)', () => {
		const txs: MockTransaction[] = [
			{ amount_paise: 5000, is_uncategorized_fallback: 1, description: 'Harbour adjustment' }
		];
		expect(computeDriftFromTransactions(txs)).toBe(5000);
	});

	it('returns zero when there is no harbour adjustment', () => {
		const txs: MockTransaction[] = [
			{ amount_paise: -5000, is_uncategorized_fallback: 0, description: 'Swiggy' }
		];
		expect(computeDriftFromTransactions(txs)).toBe(0);
	});

	it('returns zero for a period with perfect tracking (no adjustment recorded)', () => {
		const txs: MockTransaction[] = [];
		expect(computeDriftFromTransactions(txs)).toBe(0);
	});

	it('does NOT count organic uncategorized transactions as drift', () => {
		// User left some entries uncategorized — these fall into Uncategorized naturally.
		// They are is_uncategorized_fallback=1 but description is NOT 'Harbour adjustment'.
		// These should NOT be counted as drift.
		const txs: MockTransaction[] = [
			{ amount_paise: -2000, is_uncategorized_fallback: 1, description: 'auto to office' }, // organic uncat
			{ amount_paise: -4000, is_uncategorized_fallback: 1, description: 'Harbour adjustment' } // actual drift
		];
		// Only the harbour adjustment should count
		expect(computeDriftFromTransactions(txs)).toBe(4000);
	});

	it('handles multiple harbour adjustment rows (edge case: should never happen)', () => {
		// Harbour creates exactly one adjustment row, but test the SUM is correct
		const txs: MockTransaction[] = [
			{ amount_paise: -1000, is_uncategorized_fallback: 1, description: 'Harbour adjustment' },
			{ amount_paise: -500, is_uncategorized_fallback: 1, description: 'Harbour adjustment' }
		];
		expect(computeDriftFromTransactions(txs)).toBe(1500);
	});
});

describe('drift trend: improving detection', () => {
	it('marks as improving when latest drift < previous drift', () => {
		const periods = [
			{ drift_paise: 200 },  // newest: ₹2 drift
			{ drift_paise: 1500 }, // older: ₹15 drift
		];
		expect(isDriftImproving(periods)).toBe(true);
	});

	it('is NOT improving when latest drift > previous drift', () => {
		const periods = [
			{ drift_paise: 2000 }, // newest: ₹20 drift (worse)
			{ drift_paise: 500 },  // older: ₹5 drift
		];
		expect(isDriftImproving(periods)).toBe(false);
	});

	it('is NOT improving when drift is flat', () => {
		const periods = [
			{ drift_paise: 1000 },
			{ drift_paise: 1000 },
		];
		expect(isDriftImproving(periods)).toBe(false);
	});

	it('requires at least 2 periods to determine a trend', () => {
		expect(isDriftImproving([])).toBe(false);
		expect(isDriftImproving([{ drift_paise: 500 }])).toBe(false);
	});

	it('perfect tracking: latest drift = 0 is considered improving over non-zero', () => {
		const periods = [
			{ drift_paise: 0 },    // newest: perfect
			{ drift_paise: 500 },  // older: ₹5 drift
		];
		expect(isDriftImproving(periods)).toBe(true);
	});
});

describe('drift bar chart rendering logic', () => {
	it('bar height is proportional to drift, floored at 4px, with 48px max', () => {
		function barHeight(driftPaise: number, maxDrift: number): number {
			if (driftPaise === 0) return 2; // zero indicator line
			return Math.max(4, Math.round((driftPaise / maxDrift) * 48));
		}

		const maxDrift = 10000;
		expect(barHeight(0, maxDrift)).toBe(2);       // zero = thin line
		expect(barHeight(10000, maxDrift)).toBe(48);   // max = full height
		expect(barHeight(5000, maxDrift)).toBe(24);    // half
		expect(barHeight(100, maxDrift)).toBe(4);      // tiny drift → floor at 4px
	});

	it('max bar is computed from the actual data points, not a fixed scale', () => {
		const driftData = [
			{ drift_paise: 3000 },
			{ drift_paise: 8000 },
			{ drift_paise: 1500 },
		];
		const maxDrift = Math.max(...driftData.map(p => p.drift_paise), 1);
		expect(maxDrift).toBe(8000);
	});

	it('maxDrift floor of 1 prevents division by zero when all periods are perfect', () => {
		const driftData = [
			{ drift_paise: 0 },
			{ drift_paise: 0 },
		];
		const maxDrift = Math.max(...driftData.map(p => p.drift_paise), 1);
		expect(maxDrift).toBe(1);
		// No division by zero
		const barH = driftData[0].drift_paise === 0 ? 2 : Math.round((0 / maxDrift) * 48);
		expect(barH).toBe(2);
	});
});
