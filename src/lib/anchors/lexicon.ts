// Hinglish anchor lexicon: seed vocabulary for the India-rooted anchor engine.
// Category hint names match the default categories seeded at signup exactly.

export interface LexiconEntry {
	patterns: string[]; // lowercase substrings to match
	category_hint: string; // suggested category name (must match a real category)
	description_hint?: string; // optional cleaned description
}

export const HINGLISH_LEXICON: LexiconEntry[] = [
	// ── Food & Dining ────────────────────────────────────────────────────────────
	{ patterns: ['swiggy'], category_hint: 'Food & Dining', description_hint: 'Swiggy order' },
	{ patterns: ['zomato'], category_hint: 'Food & Dining', description_hint: 'Zomato order' },
	{ patterns: ['barbeque nation', 'barbeque', 'bbq nation'], category_hint: 'Food & Dining' },
	{ patterns: ['chai', 'tea'], category_hint: 'Food & Dining', description_hint: 'Chai' },
	{ patterns: ['coffee', 'cafe coffee day', 'ccd', 'starbucks', 'third wave', 'blue tokai'], category_hint: 'Food & Dining' },
	{ patterns: ['biryani', 'dosa', 'idli', 'paratha', 'roti', 'thali', 'vada pav', 'pav bhaji', 'chaat'], category_hint: 'Food & Dining' },
	{ patterns: ['lunch', 'dinner', 'breakfast', 'khana', 'bhojan', 'snack'], category_hint: 'Food & Dining' },
	{ patterns: ['restaurant', 'hotel', 'dhaba', 'canteen', 'mess', 'food court'], category_hint: 'Food & Dining' },
	{ patterns: ['mcdonalds', 'kfc', 'dominos', 'pizza hut', 'subway', 'burger king', 'taco bell'], category_hint: 'Food & Dining' },

	// ── Groceries ────────────────────────────────────────────────────────────────
	{ patterns: ['blinkit', 'grofers'], category_hint: 'Groceries', description_hint: 'Blinkit' },
	{ patterns: ['zepto'], category_hint: 'Groceries', description_hint: 'Zepto' },
	{ patterns: ['bigbasket', 'big basket'], category_hint: 'Groceries', description_hint: 'BigBasket' },
	{ patterns: ['dmart', 'd-mart', 'd mart'], category_hint: 'Groceries', description_hint: 'DMart' },
	{ patterns: ['dunzo'], category_hint: 'Groceries', description_hint: 'Dunzo' },
	{ patterns: ['kirana', 'sabji', 'sabzi', 'vegetable', 'grocery', 'groceries'], category_hint: 'Groceries' },
	{ patterns: ['milk', 'doodh', 'amul', 'mother dairy', 'nandini'], category_hint: 'Groceries' },
	{ patterns: ['fruits', 'fal', 'mandi', 'fresh'], category_hint: 'Groceries' },

	// ── Transport ────────────────────────────────────────────────────────────────
	{ patterns: ['uber'], category_hint: 'Transport', description_hint: 'Uber' },
	{ patterns: ['ola'], category_hint: 'Transport', description_hint: 'Ola' },
	{ patterns: ['rapido'], category_hint: 'Transport', description_hint: 'Rapido' },
	{ patterns: ['auto', 'autorickshaw', 'rickshaw', 'rikshaw'], category_hint: 'Transport', description_hint: 'Auto' },
	{ patterns: ['metro', 'local train', 'train ticket', 'irctc'], category_hint: 'Transport' },
	{ patterns: ['bus', 'bus ticket', 'ksrtc', 'msrtc', 'dtc'], category_hint: 'Transport' },
	{ patterns: ['petrol', 'diesel', 'fuel', 'pump', 'cng', 'hp pump', 'iocl', 'bpcl'], category_hint: 'Transport', description_hint: 'Fuel' },
	{ patterns: ['parking', 'toll', 'fastag'], category_hint: 'Transport' },
	{ patterns: ['flight', 'indigo', 'air india', 'spicejet', 'vistara', 'akasa'], category_hint: 'Transport' },
	{ patterns: ['ola electric', 'electric scooter', 'ev charge'], category_hint: 'Transport' },

	// ── Bills & Utilities ─────────────────────────────────────────────────────────
	{ patterns: ['jio', 'jio recharge'], category_hint: 'Bills & Utilities', description_hint: 'Jio recharge' },
	{ patterns: ['airtel', 'airtel recharge'], category_hint: 'Bills & Utilities', description_hint: 'Airtel recharge' },
	{ patterns: ['vi ', 'vodafone', 'idea'], category_hint: 'Bills & Utilities', description_hint: 'Mobile bill' },
	{ patterns: ['bsnl'], category_hint: 'Bills & Utilities' },
	{ patterns: ['electricity', 'bijli', 'bescom', 'tata power', 'adani electricity', 'msedcl', 'bses', 'tneb'], category_hint: 'Bills & Utilities', description_hint: 'Electricity bill' },
	{ patterns: ['water bill', 'municipal'], category_hint: 'Bills & Utilities' },
	{ patterns: ['internet', 'broadband', 'wifi', 'act', 'hathway', 'jio fiber', 'airtel fiber'], category_hint: 'Bills & Utilities' },
	{ patterns: ['gas bill', 'lpg', 'indane', 'hp gas', 'bharat gas'], category_hint: 'Bills & Utilities', description_hint: 'Gas cylinder' },
	{ patterns: ['maintenance', 'society', 'maintenance bill'], category_hint: 'Bills & Utilities' },

	// ── Rent ─────────────────────────────────────────────────────────────────────
	{ patterns: ['rent', 'kiraya', 'house rent', 'pg rent', 'hostel'], category_hint: 'Rent' },

	// ── Shopping ─────────────────────────────────────────────────────────────────
	{ patterns: ['amazon'], category_hint: 'Shopping', description_hint: 'Amazon' },
	{ patterns: ['flipkart'], category_hint: 'Shopping', description_hint: 'Flipkart' },
	{ patterns: ['myntra'], category_hint: 'Shopping', description_hint: 'Myntra' },
	{ patterns: ['ajio'], category_hint: 'Shopping', description_hint: 'Ajio' },
	{ patterns: ['meesho'], category_hint: 'Shopping', description_hint: 'Meesho' },
	{ patterns: ['nykaa'], category_hint: 'Shopping', description_hint: 'Nykaa' },
	{ patterns: ['tata cliq', 'tatacliq', 'reliance digital', 'croma'], category_hint: 'Shopping' },
	{ patterns: ['clothes', 'kapde', 'shirt', 'jeans', 'shoes', 'footwear', 'dress', 'saree'], category_hint: 'Shopping' },

	// ── Health ────────────────────────────────────────────────────────────────────
	{ patterns: ['pharmeasy', 'pharm easy', '1mg', 'netmeds', 'medplus'], category_hint: 'Health', description_hint: 'Medicine' },
	{ patterns: ['apollo', 'apollo pharmacy', 'apollo hospitals'], category_hint: 'Health' },
	{ patterns: ['cult', 'cult.fit', 'gym', 'yoga', 'fitness', 'healthifyme'], category_hint: 'Health' },
	{ patterns: ['doctor', 'clinic', 'hospital', 'medicine', 'dawa', 'tablet', 'test', 'lab'], category_hint: 'Health' },
	{ patterns: ['practo', 'tata 1mg', 'lybrate'], category_hint: 'Health' },

	// ── Entertainment ────────────────────────────────────────────────────────────
	{ patterns: ['netflix'], category_hint: 'Entertainment', description_hint: 'Netflix' },
	{ patterns: ['spotify'], category_hint: 'Entertainment', description_hint: 'Spotify' },
	{ patterns: ['hotstar', 'disney+', 'disney plus'], category_hint: 'Entertainment', description_hint: 'Hotstar' },
	{ patterns: ['jiosaavn', 'saavn'], category_hint: 'Entertainment' },
	{ patterns: ['jioCinema', 'jio cinema'], category_hint: 'Entertainment' },
	{ patterns: ['amazon prime', 'prime video'], category_hint: 'Entertainment', description_hint: 'Prime Video' },
	{ patterns: ['youtube premium', 'youtube'], category_hint: 'Entertainment' },
	{ patterns: ['movie', 'pvr', 'inox', 'bookmyshow', 'film', 'cinema'], category_hint: 'Entertainment' },
	{ patterns: ['game', 'gaming', 'steam', 'playstation', 'xbox'], category_hint: 'Entertainment' },

	// ── Investments ──────────────────────────────────────────────────────────────
	{ patterns: ['zerodha'], category_hint: 'Investments', description_hint: 'Zerodha' },
	{ patterns: ['groww'], category_hint: 'Investments', description_hint: 'Groww' },
	{ patterns: ['upstox'], category_hint: 'Investments', description_hint: 'Upstox' },
	{ patterns: ['kuvera', 'coin by zerodha', 'paytm money'], category_hint: 'Investments' },
	{ patterns: ['sip', 'mutual fund', 'mf invest', 'lumpsum'], category_hint: 'Investments', description_hint: 'Mutual fund' },
	{ patterns: ['fd ', 'fixed deposit'], category_hint: 'Investments', description_hint: 'Fixed deposit' },
	{ patterns: ['ppf', 'nps', 'elss', 'epf', 'provident fund'], category_hint: 'Investments' },
	{ patterns: ['stocks', 'shares', 'equity', 'invest'], category_hint: 'Investments' },
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
