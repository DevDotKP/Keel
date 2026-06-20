// Anchor engine: normalise Hinglish speech → structured TransactionDraft.
// Phase 1: lexicon + rules. Phase 2 (post-launch): ML on voice_samples corpus.

import Fuse from 'fuse.js';
import type { TransactionDraft } from '$lib/types';
import { HINGLISH_LEXICON, HINDI_NUMERALS } from './lexicon';
import { nowIso, toIstIso } from '$lib/utils/date';

export interface AnchorParseResult {
	draft: TransactionDraft; // category_id is null here — caller resolves via category_hint
	category_hint: string | null; // the matched category name from the lexicon
	confidence: number; // 0–1; caller always shows confirm sheet regardless
	raw_transcript: string;
}

// ── Amount extraction ─────────────────────────────────────────────────────────

// Matches: ₹150 | ₹1,500 | ₹1500.50
const RE_CURRENCY_PREFIX = /₹\s*([\d,]+(?:\.\d{1,2})?)/;
// Matches: 150 rs | 150 rs. | 150 rupees | 150 rupaye | 150 rupe
const RE_NUMBER_THEN_WORD = /([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|rupe(?:e|ya|ye|ys)?(?:s|)|rupaya?)/;
// Matches: rs 150 | rs. 150
const RE_WORD_THEN_NUMBER = /(?:rs\.?\s+)([\d,]+(?:\.\d{1,2})?)/;

function parseNumberStr(s: string): number {
	return parseFloat(s.replace(/,/g, ''));
}

// Hindi numeral phrase + optional rupee word: e.g. "das rupaye" → 10
function extractHindiNumeral(text: string): number | null {
	// Try compound: "das hazaar" = 10,000; "do sau" = 200
	// Simple pass: look for any known numeral word and sum up
	const words = text.split(/\s+/);
	let value = 0;
	let matched = false;

	for (let i = 0; i < words.length; i++) {
		const w = words[i];
		if (w in HINDI_NUMERALS) {
			const n = HINDI_NUMERALS[w];
			if (n >= 100) {
				// multiplier: if we have a running total, multiply it
				value = value > 0 ? value * n : n;
			} else {
				value += n;
			}
			matched = true;
		}
	}
	return matched && value > 0 ? value : null;
}

interface AmountMatch {
	paise: number;
	consumedText: string; // the portion of the transcript that was the amount
}

function extractAmount(text: string): AmountMatch | null {
	let m: RegExpExecArray | null;

	if ((m = RE_CURRENCY_PREFIX.exec(text))) {
		const rupees = parseNumberStr(m[1]);
		return { paise: Math.round(rupees * 100), consumedText: m[0] };
	}
	if ((m = RE_NUMBER_THEN_WORD.exec(text))) {
		const rupees = parseNumberStr(m[1]);
		return { paise: Math.round(rupees * 100), consumedText: m[0] };
	}
	if ((m = RE_WORD_THEN_NUMBER.exec(text))) {
		const rupees = parseNumberStr(m[1]);
		return { paise: Math.round(rupees * 100), consumedText: m[0] };
	}

	// Hindi numeral: check for numeral word near a rupee word
	const hasRupeeWord = /\b(?:rs\.?|rupe(?:e|ya|ye|ys)?(?:s|)|rupaya?)\b/.test(text);
	const hindiAmount = extractHindiNumeral(text);
	if (hindiAmount !== null && (hasRupeeWord || true)) {
		// return even without rupee word — context often omits it
		return { paise: hindiAmount * 100, consumedText: '' };
	}

	// Fallback: first isolated number in the transcript
	const numOnly = /\b(\d+(?:\.\d{1,2})?)\b/.exec(text);
	if (numOnly) {
		const rupees = parseFloat(numOnly[1]);
		if (rupees > 0 && rupees < 1_00_000) {
			return { paise: Math.round(rupees * 100), consumedText: numOnly[0] };
		}
	}

	return null;
}

// ── Date extraction ───────────────────────────────────────────────────────────

const DATE_KEYWORDS: Record<string, string> = {
	aaj: 'today',
	today: 'today',
	kal: 'yesterday',
	yesterday: 'yesterday',
	'kal raat': 'yesterday',
	parso: '-2d',
	'2 din pehle': '-2d',
	'2 days ago': '-2d'
};

function extractDate(text: string): { isoDate: string; consumedText: string } | null {
	for (const [phrase, value] of Object.entries(DATE_KEYWORDS)) {
		if (text.includes(phrase)) {
			let date: Date;
			if (value === 'today') {
				date = new Date();
			} else if (value === 'yesterday') {
				date = new Date();
				date.setDate(date.getDate() - 1);
			} else {
				const days = parseInt(value.replace('-', '').replace('d', ''), 10);
				date = new Date();
				date.setDate(date.getDate() - days);
			}
			return { isoDate: toIstIso(date), consumedText: phrase };
		}
	}
	return null;
}

// ── Category matching ─────────────────────────────────────────────────────────

interface LexiconMatch {
	categoryHint: string;
	descriptionHint: string | undefined;
	consumedPatterns: string[];
}

function matchLexicon(text: string): LexiconMatch | null {
	for (const entry of HINGLISH_LEXICON) {
		for (const pattern of entry.patterns) {
			if (text.includes(pattern)) {
				return {
					categoryHint: entry.category_hint,
					descriptionHint: entry.description_hint,
					consumedPatterns: entry.patterns.filter((p) => text.includes(p))
				};
			}
		}
	}
	return null;
}

function fuzzyMatchCategory(hint: string, knownCategories: string[]): string | null {
	if (!knownCategories.length) return null;
	const fuse = new Fuse(knownCategories, { threshold: 0.45 });
	const results = fuse.search(hint);
	return results[0]?.item ?? null;
}

// ── Description assembly ──────────────────────────────────────────────────────

function buildDescription(
	text: string,
	consumed: string[],
	descriptionHint: string | undefined
): string {
	if (descriptionHint) return descriptionHint;
	let remaining = text;
	for (const c of consumed) {
		if (c) remaining = remaining.replace(c, ' ');
	}
	// Strip rupee words and standalone numeral leftovers
	remaining = remaining
		.replace(/\b(?:rs\.?|rupe(?:e|ya|ye|ys)?(?:s|)|rupaya?)\b/g, '')
		.replace(/\s{2,}/g, ' ')
		.trim();
	return remaining || '';
}

// ── Public entry point ────────────────────────────────────────────────────────

export function parse(transcript: string, knownCategories: string[] = []): AnchorParseResult {
	const text = transcript.toLowerCase().trim();

	const consumed: string[] = [];

	// 1. Amount
	const amountMatch = extractAmount(text);
	const amountPaise = amountMatch?.paise ?? null;
	if (amountMatch?.consumedText) consumed.push(amountMatch.consumedText);

	// 2. Lexicon → category hint
	const lexiconMatch = matchLexicon(text);
	const rawCategoryHint = lexiconMatch?.categoryHint ?? null;
	if (lexiconMatch) consumed.push(...lexiconMatch.consumedPatterns);

	// 3. Fuzzy match against the user's known categories
	const categoryHint = rawCategoryHint
		? fuzzyMatchCategory(rawCategoryHint, knownCategories) ?? rawCategoryHint
		: null;

	// 4. Date
	const dateMatch = extractDate(text);
	const occurredAt = dateMatch?.isoDate ?? nowIso();
	if (dateMatch?.consumedText) consumed.push(dateMatch.consumedText);

	// 5. Description
	const description = buildDescription(text, consumed, lexiconMatch?.descriptionHint);

	// 6. Confidence: how many fields were resolved
	let resolved = 0;
	if (amountPaise !== null) resolved += 3; // most important
	if (categoryHint) resolved += 2;
	if (dateMatch) resolved += 1;
	const confidence = Math.min(resolved / 6, 1);

	return {
		draft: {
			amount_paise: amountPaise,
			category_id: null, // caller resolves category_hint → ID
			description,
			note: '',
			occurred_at: occurredAt
		},
		category_hint: categoryHint,
		confidence,
		raw_transcript: transcript
	};
}

/**
 * Quick category hint for typed descriptions — no amount or date parsing.
 * Returns the category_hint string from the lexicon, or null if no match.
 * Used by the add-transaction sheet to auto-fill category as the user types.
 */
export function matchCategory(text: string): string | null {
	if (!text || text.length < 3) return null;
	return matchLexicon(text.toLowerCase().trim())?.categoryHint ?? null;
}
