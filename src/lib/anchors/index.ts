// Anchor engine: normalise Hinglish speech → structured TransactionDraft.
// Phase 1 is lexicon + rules. Phase 2 (post-launch) trains ML on voice_samples.

import type { TransactionDraft } from '$lib/types';
import { HINGLISH_LEXICON, HINDI_NUMERALS } from './lexicon';
import { nowIso } from '$lib/utils/date';

export interface AnchorParseResult {
	draft: TransactionDraft;
	confidence: number; // 0–1; caller shows confirm sheet regardless
	raw_transcript: string;
}

/**
 * Parse a Hinglish voice transcript into a TransactionDraft.
 * Always returns a draft (possibly with null fields) — the confirm step catches errors.
 * Low confidence = user sees more empty fields to fill.
 *
 * @param transcript - raw lowercased transcript from the Speech API
 * @param knownCategories - user's category names, used for fuzzy matching
 */
export function parse(
	transcript: string,
	knownCategories: string[] = []
): AnchorParseResult {
	// TODO(sonnet): implement in phases:
	// 1. Amount extraction: scan for digit patterns + "rupaye/rs/₹" + HINDI_NUMERALS.
	// 2. Category hint: scan HINGLISH_LEXICON patterns against transcript.
	// 3. Fuzzy category match: use knownCategories + fuse.js to find the best match.
	// 4. Description: strip the amount and matched lexicon tokens; remainder is description.
	// 5. Date: look for "kal", "yesterday", "aaj" → parseFlexDate.
	// 6. Compute confidence from how many fields were resolved.

	// Stub: return an empty draft.
	void HINGLISH_LEXICON; // referenced to satisfy tree-shaking
	void HINDI_NUMERALS;
	void knownCategories;

	return {
		draft: {
			amount_paise: null,
			category_id: null,
			description: transcript.trim(),
			occurred_at: nowIso()
		},
		confidence: 0,
		raw_transcript: transcript
	};
}
