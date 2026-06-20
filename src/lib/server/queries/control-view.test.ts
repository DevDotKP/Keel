import { describe, it, expect } from 'vitest';

/**
 * Unit tests for the Control View (safe-to-spend) and Budget calculations.
 *
 * The Control View is the hero metric of Keel: "Safe to spend" = what you can
 * actually spend today without jeopardising obligations or daily reserves.
 *
 * Formula:
 *   remaining = opening_balance + income + expense (net, expense is negative)
 *   locked_reserve = daily_reserve_paise × days_remaining
 *   safe_to_spend = remaining − locked_obligations − locked_reserve
 *
 * This file tests the logic in isolation (no DB required).
 */

// ── Control view: safe-to-spend ───────────────────────────────────────────────

function computeSafeToSpend({
	openingBalancePaise,
	incomePaise,
	expensePaise, // positive = total expenses as a magnitude
	lockedObligationsPaise,
	dailyReservePaise,
	daysRemaining
}: {
	openingBalancePaise: number;
	incomePaise: number;
	expensePaise: number;
	lockedObligationsPaise: number;
	dailyReservePaise: number;
	daysRemaining: number;
}): { remaining: number; lockedReserve: number; safeToSpend: number } {
	const remaining = openingBalancePaise + incomePaise - expensePaise;
	const lockedReserve = dailyReservePaise * daysRemaining;
	const safeToSpend = remaining - lockedObligationsPaise - lockedReserve;
	return { remaining, lockedReserve, safeToSpend };
}

describe('control view: safe-to-spend', () => {
	it('returns remaining balance when no obligations or reserves', () => {
		const { safeToSpend, remaining } = computeSafeToSpend({
			openingBalancePaise: 500000,
			incomePaise: 0,
			expensePaise: 50000,
			lockedObligationsPaise: 0,
			dailyReservePaise: 0,
			daysRemaining: 10
		});
		expect(remaining).toBe(450000); // ₹4,500
		expect(safeToSpend).toBe(450000);
	});

	it('subtracts locked obligations from remaining', () => {
		const { safeToSpend } = computeSafeToSpend({
			openingBalancePaise: 500000,
			incomePaise: 0,
			expensePaise: 0,
			lockedObligationsPaise: 100000, // ₹1,000 rent unpaid
			dailyReservePaise: 0,
			daysRemaining: 0
		});
		expect(safeToSpend).toBe(400000); // ₹4,000 safe
	});

	it('subtracts daily reserve × days_remaining from safe-to-spend', () => {
		const { safeToSpend, lockedReserve } = computeSafeToSpend({
			openingBalancePaise: 1000000,
			incomePaise: 0,
			expensePaise: 0,
			lockedObligationsPaise: 0,
			dailyReservePaise: 5000, // ₹50/day reserve
			daysRemaining: 10
		});
		expect(lockedReserve).toBe(50000); // ₹500 reserved
		expect(safeToSpend).toBe(950000); // ₹9,500 safe
	});

	it('goes negative when obligations + reserves exceed remaining', () => {
		const { safeToSpend } = computeSafeToSpend({
			openingBalancePaise: 100000, // ₹1,000
			incomePaise: 0,
			expensePaise: 0,
			lockedObligationsPaise: 120000, // ₹1,200 obligations
			dailyReservePaise: 0,
			daysRemaining: 0
		});
		expect(safeToSpend).toBe(-20000); // over-committed by ₹200
	});

	it('income adds to remaining', () => {
		const { remaining } = computeSafeToSpend({
			openingBalancePaise: 100000,
			incomePaise: 50000, // ₹500 income
			expensePaise: 30000,
			lockedObligationsPaise: 0,
			dailyReservePaise: 0,
			daysRemaining: 0
		});
		expect(remaining).toBe(120000); // 1000 + 500 - 300 = 1200
	});

	it('all amounts are integer paise (no float drift)', () => {
		const { safeToSpend } = computeSafeToSpend({
			openingBalancePaise: 100001,
			incomePaise: 0,
			expensePaise: 33333,
			lockedObligationsPaise: 11111,
			dailyReservePaise: 1234,
			daysRemaining: 7
		});
		expect(Number.isInteger(safeToSpend)).toBe(true);
		// 100001 - 33333 - 11111 - (1234 * 7) = 66668 - 11111 - 8638 = 46919
		expect(safeToSpend).toBe(46919);
	});

	it('handles zero opening balance (new user)', () => {
		const { remaining, safeToSpend } = computeSafeToSpend({
			openingBalancePaise: 0,
			incomePaise: 0,
			expensePaise: 0,
			lockedObligationsPaise: 0,
			dailyReservePaise: 0,
			daysRemaining: 30
		});
		expect(remaining).toBe(0);
		expect(safeToSpend).toBe(0);
	});

	it('locks zero reserve when there are zero days remaining (last day of period)', () => {
		const { lockedReserve, safeToSpend } = computeSafeToSpend({
			openingBalancePaise: 500000,
			incomePaise: 0,
			expensePaise: 0,
			lockedObligationsPaise: 0,
			dailyReservePaise: 10000,
			daysRemaining: 0
		});
		expect(lockedReserve).toBe(0);
		expect(safeToSpend).toBe(500000);
	});
});

// ── Budget status ─────────────────────────────────────────────────────────────
// Budget is an optional soft cap per category. Zero budget = no cap.

interface BudgetStatus {
	spent_paise: number;
	budget_paise: number;
}

function isOverBudget({ spent_paise, budget_paise }: BudgetStatus): boolean {
	return budget_paise > 0 && spent_paise > budget_paise;
}

function budgetUsedPercent({ spent_paise, budget_paise }: BudgetStatus): number {
	if (budget_paise <= 0) return 0;
	return Math.round((spent_paise / budget_paise) * 100);
}

function isNearBudget({ spent_paise, budget_paise }: BudgetStatus): boolean {
	if (budget_paise <= 0) return false;
	const pct = spent_paise / budget_paise;
	return pct >= 0.8 && pct < 1.0; // warn at 80%
}

describe('budget status', () => {
	it('is over-budget when spent > budget', () => {
		expect(isOverBudget({ spent_paise: 10001, budget_paise: 10000 })).toBe(true);
	});

	it('is NOT over-budget when spent = budget (exactly at cap)', () => {
		expect(isOverBudget({ spent_paise: 10000, budget_paise: 10000 })).toBe(false);
	});

	it('is NOT over-budget when spent < budget', () => {
		expect(isOverBudget({ spent_paise: 9999, budget_paise: 10000 })).toBe(false);
	});

	it('is never over-budget when budget is zero (no cap set)', () => {
		expect(isOverBudget({ spent_paise: 999999, budget_paise: 0 })).toBe(false);
	});

	it('computes used percentage correctly', () => {
		expect(budgetUsedPercent({ spent_paise: 5000, budget_paise: 10000 })).toBe(50);
		expect(budgetUsedPercent({ spent_paise: 10000, budget_paise: 10000 })).toBe(100);
		expect(budgetUsedPercent({ spent_paise: 12000, budget_paise: 10000 })).toBe(120);
		expect(budgetUsedPercent({ spent_paise: 0, budget_paise: 10000 })).toBe(0);
	});

	it('returns 0% when no budget is set', () => {
		expect(budgetUsedPercent({ spent_paise: 50000, budget_paise: 0 })).toBe(0);
	});

	it('flags near-budget at 80–99%', () => {
		expect(isNearBudget({ spent_paise: 8000, budget_paise: 10000 })).toBe(true);  // 80%
		expect(isNearBudget({ spent_paise: 9999, budget_paise: 10000 })).toBe(true);  // 99.9%
		expect(isNearBudget({ spent_paise: 10000, budget_paise: 10000 })).toBe(false); // 100% = over, not near
		expect(isNearBudget({ spent_paise: 7999, budget_paise: 10000 })).toBe(false); // 79.9%
	});

	it('never flags near-budget when budget is zero', () => {
		expect(isNearBudget({ spent_paise: 99999, budget_paise: 0 })).toBe(false);
	});
});

// ── Obligation settlement ─────────────────────────────────────────────────────

interface MockObligation {
	id: string;
	name: string;
	amount_paise: number;
	is_active: 1 | 0;
	paid: boolean;
}

function sumUnpaidObligations(obligations: MockObligation[]): number {
	return obligations
		.filter(o => o.is_active === 1 && !o.paid)
		.reduce((sum, o) => sum + o.amount_paise, 0);
}

function sumPaidObligations(obligations: MockObligation[]): number {
	return obligations
		.filter(o => o.is_active === 1 && o.paid)
		.reduce((sum, o) => sum + o.amount_paise, 0);
}

describe('obligation settlement', () => {
	const obligations: MockObligation[] = [
		{ id: '1', name: 'Rent', amount_paise: 1500000, is_active: 1, paid: false },
		{ id: '2', name: 'Jio', amount_paise: 59900, is_active: 1, paid: true },
		{ id: '3', name: 'Netflix', amount_paise: 64900, is_active: 1, paid: false },
		{ id: '4', name: 'Old loan', amount_paise: 500000, is_active: 0, paid: false } // inactive
	];

	it('sums only unpaid active obligations for locked amount', () => {
		const locked = sumUnpaidObligations(obligations);
		// Rent (1500000) + Netflix (64900), not Jio (paid) or old loan (inactive)
		expect(locked).toBe(1564900);
	});

	it('excludes inactive obligations from locked total', () => {
		const locked = sumUnpaidObligations(obligations);
		// Old loan is inactive, should not be locked
		expect(locked).toBe(1564900);
		expect(locked).not.toContain(500000); // old loan amount not included
	});

	it('sums only paid active obligations', () => {
		const paid = sumPaidObligations(obligations);
		expect(paid).toBe(59900); // only Jio
	});

	it('returns zero when all obligations are paid', () => {
		const allPaid: MockObligation[] = [
			{ id: '1', name: 'Rent', amount_paise: 1500000, is_active: 1, paid: true },
			{ id: '2', name: 'Jio', amount_paise: 59900, is_active: 1, paid: true }
		];
		expect(sumUnpaidObligations(allPaid)).toBe(0);
	});

	it('returns zero when no obligations exist', () => {
		expect(sumUnpaidObligations([])).toBe(0);
	});

	it('marking an obligation paid removes it from the locked total', () => {
		const before = sumUnpaidObligations(obligations);
		// Simulate paying Netflix
		const afterPaying = obligations.map(o =>
			o.id === '3' ? { ...o, paid: true } : o
		);
		const after = sumUnpaidObligations(afterPaying);
		// Netflix (64900) removed from locked
		expect(before - after).toBe(64900);
	});

	it('amounts are always integer paise', () => {
		const amounts = obligations.map(o => o.amount_paise);
		expect(amounts.every(a => Number.isInteger(a))).toBe(true);
	});
});
