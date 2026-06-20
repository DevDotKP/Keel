import { describe, it, expect } from 'vitest';
import { parse, matchCategory } from './index';

/**
 * Unit tests for the Hinglish anchor engine.
 *
 * The anchor engine is P4's core: it maps typed descriptions and spoken
 * transcripts to {amount_paise, category_hint, description, occurred_at}.
 *
 * These tests guard two export surfaces:
 * 1. `parse(transcript, knownCategories)` — full voice parse
 * 2. `matchCategory(text)` — quick category hint for typed descriptions
 */

// ── matchCategory: typed description auto-categorization ─────────────────────

describe('matchCategory: typed description', () => {
	it('matches Swiggy → Food & Dining', () => {
		expect(matchCategory('swiggy')).toBe('Food & Dining');
		expect(matchCategory('Swiggy order')).toBe('Food & Dining');
	});

	it('matches Zomato → Food & Dining', () => {
		expect(matchCategory('zomato')).toBe('Food & Dining');
	});

	it('matches Blinkit → Groceries', () => {
		expect(matchCategory('blinkit delivery')).toBe('Groceries');
	});

	it('matches BigBasket → Groceries', () => {
		expect(matchCategory('bigbasket order')).toBe('Groceries');
	});

	it('matches Uber → Transport', () => {
		expect(matchCategory('uber ride')).toBe('Transport');
	});

	it('matches Ola → Transport', () => {
		expect(matchCategory('ola cab')).toBe('Transport');
	});

	it('matches auto/autorickshaw → Transport', () => {
		expect(matchCategory('auto to office')).toBe('Transport');
		expect(matchCategory('autorickshaw')).toBe('Transport');
	});

	it('matches Rapido → Transport', () => {
		expect(matchCategory('rapido bike')).toBe('Transport');
	});

	it('matches petrol/fuel → Transport', () => {
		expect(matchCategory('petrol fill')).toBe('Transport');
		expect(matchCategory('fuel pump')).toBe('Transport');
	});

	it('matches Jio → Bills & Utilities', () => {
		expect(matchCategory('jio recharge')).toBe('Bills & Utilities');
	});

	it('matches Airtel → Bills & Utilities', () => {
		expect(matchCategory('airtel bill')).toBe('Bills & Utilities');
	});

	it('matches electricity → Bills & Utilities', () => {
		expect(matchCategory('electricity bill')).toBe('Bills & Utilities');
	});

	it('matches rent/kiraya → Rent', () => {
		expect(matchCategory('rent')).toBe('Rent');
		expect(matchCategory('house rent')).toBe('Rent');
	});

	it('matches Amazon → Shopping', () => {
		expect(matchCategory('amazon delivery')).toBe('Shopping');
	});

	it('matches Flipkart → Shopping', () => {
		expect(matchCategory('flipkart order')).toBe('Shopping');
	});

	it('matches Netflix → Entertainment', () => {
		expect(matchCategory('netflix subscription')).toBe('Entertainment');
	});

	it('matches Spotify → Entertainment', () => {
		expect(matchCategory('spotify premium')).toBe('Entertainment');
	});

	it('matches doctor/medicine → Health', () => {
		expect(matchCategory('doctor visit')).toBe('Health');
		expect(matchCategory('medicine pharmacy')).toBe('Health');
	});

	it('returns null for unknown descriptions', () => {
		expect(matchCategory('random thing i bought')).toBeNull();
		expect(matchCategory('xyz abc')).toBeNull();
		expect(matchCategory('')).toBeNull();
	});

	it('returns null for text shorter than 3 characters', () => {
		expect(matchCategory('ab')).toBeNull();
		expect(matchCategory('a')).toBeNull();
	});

	it('is case-insensitive', () => {
		expect(matchCategory('SWIGGY')).toBe('Food & Dining');
		expect(matchCategory('Netflix')).toBe('Entertainment');
		expect(matchCategory('UBER')).toBe('Transport');
	});
});

// ── parse: voice transcript parsing ──────────────────────────────────────────

describe('parse: amount extraction', () => {
	it('extracts rupee prefix amount (₹150)', () => {
		const result = parse('₹150 swiggy');
		expect(result.draft.amount_paise).toBe(15000);
	});

	it('extracts number + rupees suffix (150 rupees)', () => {
		const result = parse('150 rupees swiggy');
		expect(result.draft.amount_paise).toBe(15000);
	});

	it('extracts number + rs suffix (150 rs)', () => {
		const result = parse('swiggy 150 rs');
		expect(result.draft.amount_paise).toBe(15000);
	});

	it('extracts decimals and rounds to paise (99.50 rupees)', () => {
		const result = parse('₹99.50 chai');
		expect(result.draft.amount_paise).toBe(9950);
	});

	it('extracts comma-formatted amounts (1,500 rupees)', () => {
		const result = parse('amazon ₹1,500');
		expect(result.draft.amount_paise).toBe(150000);
	});

	it('returns null amount_paise when no amount is found', () => {
		const result = parse('swiggy order for lunch');
		// No amount in transcript
		expect(result.draft.amount_paise).toBeNull();
	});

	it('extracts Hindi numeral amounts (das rupaye = ₹10)', () => {
		const result = parse('chai das rupaye');
		expect(result.draft.amount_paise).toBe(1000); // ₹10
	});
});

describe('parse: category hint resolution', () => {
	it('returns category_hint from lexicon match', () => {
		const result = parse('swiggy 200 rupees');
		expect(result.category_hint).toBe('Food & Dining');
	});

	it('fuzzy-matches against provided knownCategories', () => {
		const result = parse('swiggy 200 rs', ['Food & Dining', 'Transport', 'Shopping']);
		expect(result.category_hint).toBe('Food & Dining');
	});

	it('returns the lexicon hint even when knownCategories is empty', () => {
		const result = parse('uber 300 rs', []);
		expect(result.category_hint).toBe('Transport');
	});

	it('returns null category_hint for unknown merchants', () => {
		const result = parse('some random payment 500 rs');
		expect(result.category_hint).toBeNull();
	});
});

describe('parse: description assembly', () => {
	it('uses description_hint when available (Swiggy → "Swiggy order")', () => {
		const result = parse('swiggy 200 rupees');
		expect(result.draft.description).toBe('Swiggy order');
	});

	it('builds description from remaining text when no hint (restaurant name)', () => {
		const result = parse('restaurant lunch 300 rs');
		// "300 rs" consumed, "restaurant lunch" remains
		expect(result.draft.description.length).toBeGreaterThan(0);
	});

	it('strips amount text from description', () => {
		const result = parse('auto 200 rupees office');
		// "200 rupees" should be consumed from description
		expect(result.draft.description).not.toContain('200 rupees');
	});
});

describe('parse: date extraction', () => {
	it('extracts "today" as today\'s date', () => {
		const result = parse('swiggy 200 rs today');
		const today = new Date().toISOString().slice(0, 10);
		expect(result.draft.occurred_at?.slice(0, 10)).toBe(today);
	});

	it('extracts "yesterday" / "kal" as yesterday\'s date', () => {
		const result = parse('uber 300 rs yesterday');
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const expectedDate = yesterday.toISOString().slice(0, 10);
		expect(result.draft.occurred_at?.slice(0, 10)).toBe(expectedDate);
	});

	it('extracts "aaj" as today (Hindi)', () => {
		const result = parse('aaj swiggy 150 rs');
		const today = new Date().toISOString().slice(0, 10);
		expect(result.draft.occurred_at?.slice(0, 10)).toBe(today);
	});

	it('defaults to today when no date keyword is present', () => {
		const result = parse('swiggy 200 rs');
		const today = new Date().toISOString().slice(0, 10);
		// Should default to now (today)
		expect(result.draft.occurred_at?.slice(0, 10)).toBe(today);
	});
});

describe('parse: confidence scoring', () => {
	it('returns higher confidence when amount and category are resolved', () => {
		const withBoth = parse('swiggy 200 rupees');
		const withNone = parse('something');
		expect(withBoth.confidence).toBeGreaterThan(withNone.confidence);
	});

	it('confidence is between 0 and 1', () => {
		const cases = [
			'swiggy 200 rupees today',
			'200 rs',
			'swiggy',
			'nothing'
		];
		for (const text of cases) {
			const { confidence } = parse(text);
			expect(confidence).toBeGreaterThanOrEqual(0);
			expect(confidence).toBeLessThanOrEqual(1);
		}
	});

	it('category_id is always null in the draft (caller resolves hint → ID)', () => {
		const result = parse('swiggy 200 rs', ['Food & Dining']);
		expect(result.draft.category_id).toBeNull();
	});

	it('always echoes the original transcript in raw_transcript', () => {
		const transcript = 'Swiggy 200 rupaye aaj';
		const result = parse(transcript, []);
		expect(result.raw_transcript).toBe(transcript);
	});
});
