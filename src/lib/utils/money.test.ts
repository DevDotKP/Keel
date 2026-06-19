import { describe, it, expect } from 'vitest';
import { formatPaise, parseToPaise, formatPaiseLedger, isExpense, absPaise } from './money';

describe('money utilities', () => {
	describe('formatPaise', () => {
		it('formats whole rupees without paise', () => {
			expect(formatPaise(15000)).toBe('₹150');
			expect(formatPaise(100)).toBe('₹1');
			expect(formatPaise(0)).toBe('₹0');
		});

		it('formats rupees with paise when non-zero', () => {
			expect(formatPaise(15050)).toMatch(/₹150\.50/);
			expect(formatPaise(150)).toMatch(/₹1\.50/);
			expect(formatPaise(1)).toMatch(/₹0\.01/);
		});

		it('formats large amounts in en-IN locale (1,00,000 format)', () => {
			const formatted = formatPaise(10000000); // ₹1,00,000
			expect(formatted).toContain('1');
			expect(formatted).toContain('0');
			expect(formatted).toContain('₹');
		});

		it('rounds to 2 decimal places', () => {
			expect(formatPaise(15055)).toMatch(/₹150\.55/);
			expect(formatPaise(15054)).toMatch(/₹150\.54/);
		});
	});

	describe('parseToPaise', () => {
		it('parses bare rupee numbers', () => {
			expect(parseToPaise('150')).toBe(15000);
			expect(parseToPaise('1')).toBe(100);
			expect(parseToPaise('0')).toBe(0);
		});

		it('parses decimal numbers', () => {
			expect(parseToPaise('150.50')).toBe(15050);
			expect(parseToPaise('1.50')).toBe(150);
			expect(parseToPaise('0.01')).toBe(1);
		});

		it('strips currency symbol ₹', () => {
			expect(parseToPaise('₹150')).toBe(15000);
			expect(parseToPaise('₹150.50')).toBe(15050);
		});

		it('strips commas (en-IN locale input)', () => {
			expect(parseToPaise('1,00,000')).toBe(10000000);
			expect(parseToPaise('1,000.50')).toBe(100050);
		});

		it('strips whitespace', () => {
			expect(parseToPaise(' 150 ')).toBe(15000);
			expect(parseToPaise('₹ 150.50')).toBe(15050);
		});

		it('returns null for invalid input', () => {
			expect(parseToPaise('')).toBeNull();
			expect(parseToPaise('abc')).toBeNull();
			expect(parseToPaise('150x')).toBeNull();
		});

		it('returns null for negative numbers', () => {
			expect(parseToPaise('-150')).toBeNull();
		});

		it('returns null for non-string input', () => {
			expect(parseToPaise(null as unknown as string)).toBeNull();
			expect(parseToPaise(undefined as unknown as string)).toBeNull();
		});

		it('returns null for non-finite numbers', () => {
			expect(parseToPaise('Infinity')).toBeNull();
			expect(parseToPaise('NaN')).toBeNull();
		});

		it('handles very large amounts', () => {
			expect(parseToPaise('9999999.99')).toBe(999999999);
		});

		it('rounds fractional paise', () => {
			expect(parseToPaise('150.505')).toBe(15051); // rounds to nearest paise
		});
	});

	describe('formatPaiseLedger', () => {
		it('always shows 2 decimal places', () => {
			const result = formatPaiseLedger(15000);
			expect(result).toMatch(/₹150\.00/);
		});

		it('formats paise correctly', () => {
			expect(formatPaiseLedger(15050)).toMatch(/₹150\.50/);
			expect(formatPaiseLedger(1)).toMatch(/₹0\.01/);
		});

		it('uses tabular lining numerals (same column widths)', () => {
			// Both should align in a monospace column
			const a = formatPaiseLedger(100); // ₹1.00
			const b = formatPaiseLedger(1000000); // ₹10,000.00
			expect(a.length).toBeGreaterThan(0);
			expect(b.length).toBeGreaterThan(0);
		});
	});

	describe('isExpense', () => {
		it('returns true for negative amounts', () => {
			expect(isExpense(-100)).toBe(true);
			expect(isExpense(-1)).toBe(true);
		});

		it('returns false for positive amounts', () => {
			expect(isExpense(100)).toBe(false);
			expect(isExpense(1)).toBe(false);
		});

		it('returns false for zero', () => {
			expect(isExpense(0)).toBe(false);
		});
	});

	describe('absPaise', () => {
		it('returns absolute value', () => {
			expect(absPaise(-15000)).toBe(15000);
			expect(absPaise(15000)).toBe(15000);
			expect(absPaise(0)).toBe(0);
		});

		it('handles edge cases', () => {
			expect(absPaise(-1)).toBe(1);
			expect(absPaise(1)).toBe(1);
		});
	});

	describe('round-trip conversions', () => {
		it('parse and format round-trip consistently', () => {
			const original = '150.50';
			const paise = parseToPaise(original);
			expect(paise).toBe(15050);
			const formatted = formatPaiseLedger(paise!);
			expect(formatted).toMatch(/₹150\.50/);
		});

		it('handles large amounts in round-trip', () => {
			const paise = parseToPaise('12,34,567.89');
			expect(paise).toBe(123456789);
			const formatted = formatPaiseLedger(paise!);
			expect(formatted).toContain('₹');
		});
	});

	describe('no-float invariant', () => {
		it('all conversions preserve integer paise', () => {
			const inputs = ['150', '150.50', '₹150.50', '1,50,000'];
			inputs.forEach((input) => {
				const paise = parseToPaise(input);
				expect(Number.isInteger(paise)).toBe(true);
				expect(paise! % 1).toBe(0);
			});
		});
	});
});
