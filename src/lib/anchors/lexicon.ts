// Hinglish anchor lexicon: seed vocabulary for the India-rooted anchor engine.
// Maps spoken phrases to structured hints.
// Format: { pattern (lowercase), category hint, description hint }
// TODO(haiku): expand this seed list with more Indian merchants, UPI handles,
// food vendors, transport phrases, and rupee amount phrasings.

export interface LexiconEntry {
	patterns: string[]; // lowercase substrings or regexes to match
	category_hint: string; // suggested category name
	description_hint?: string; // optional cleaned description
}

export const HINGLISH_LEXICON: LexiconEntry[] = [
	// ── Food and drink ──────────────────────────────────────────────────────
	{ patterns: ['chai', 'tea'], category_hint: 'Food & Drink', description_hint: 'Chai' },
	{ patterns: ['coffee', 'cafe coffee day', 'ccd', 'starbucks'], category_hint: 'Food & Drink' },
	{ patterns: ['swiggy'], category_hint: 'Food & Drink', description_hint: 'Swiggy order' },
	{ patterns: ['zomato'], category_hint: 'Food & Drink', description_hint: 'Zomato order' },
	{ patterns: ['biryani', 'dosa', 'idli', 'paratha', 'roti', 'thali'], category_hint: 'Food & Drink' },
	{ patterns: ['lunch', 'dinner', 'breakfast', 'khana'], category_hint: 'Food & Drink' },

	// ── Transport ────────────────────────────────────────────────────────────
	{ patterns: ['auto', 'autorickshaw', 'rick', 'rikshaw'], category_hint: 'Transport', description_hint: 'Auto' },
	{ patterns: ['uber', 'ola', 'rapido'], category_hint: 'Transport' },
	{ patterns: ['metro', 'local train', 'bus', 'ticket'], category_hint: 'Transport' },
	{ patterns: ['petrol', 'fuel', 'pump'], category_hint: 'Transport', description_hint: 'Fuel' },

	// ── Groceries ────────────────────────────────────────────────────────────
	{ patterns: ['kirana', 'sabji', 'sabzi', 'vegetable', 'grocery', 'blinkit', 'zepto', 'dunzo'], category_hint: 'Groceries' },
	{ patterns: ['milk', 'doodh', 'amul', 'mother dairy'], category_hint: 'Groceries' },

	// ── Utilities and bills ──────────────────────────────────────────────────
	{ patterns: ['electricity', 'bijli', 'bill', 'recharge', 'mobile recharge', 'jio', 'airtel', 'vi', 'bsnl'], category_hint: 'Bills' },
	{ patterns: ['rent', 'kiraya'], category_hint: 'Housing' },

	// ── Amount phrasings (rupee) ─────────────────────────────────────────────
	// These are handled by the amount parser, not category hints.
	// Listed here as documentation of supported spoken forms.
	// "dus rupaye" = 10 rupees, "pachaas" = 50, "sau" = 100, "hazaar" = 1000
];

// Hindi numerals (spoken) to digit strings.
export const HINDI_NUMERALS: Record<string, number> = {
	ek: 1, do: 2, teen: 3, char: 4, paanch: 5,
	chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
	gyarah: 11, barah: 12, terah: 13, chaudah: 14, pandrah: 15,
	solah: 16, satrah: 17, atharah: 18, unnis: 19, bees: 20,
	tees: 30, chaalees: 40, pachaas: 50, saath: 60, sattar: 70,
	assi: 80, nabbe: 90, sau: 100, hazaar: 1000, lakh: 100000
};
