// Shared domain types for Keel.
// All money is integer paise. Dates are ISO strings.

export type HarbourCadence = 'weekly' | 'fortnightly' | 'monthly';
export type TransactionSource = 'tap' | 'voice';
export type EntitlementStatus = 'trialing' | 'expired' | 'owned';
export type CategoryBucket = 'committed' | 'flexible';

// ── Domain types ──────────────────────────────────────────────────────────────

export interface User {
	id: string;
	email: string;
	created_at: string;
}

export interface Entitlement {
	user_id: string;
	status: EntitlementStatus;
	trial_ends_at: string | null;
	purchased_at: string | null;
	provider: string | null;
	provider_ref: string | null;
}

export interface Settings {
	user_id: string;
	harbour_cadence: HarbourCadence;
	harbour_day: string; // 'sunday', 'monday', 'payday', etc.
	harbour_notify_at: string; // 'HH:MM'
}

export interface Account {
	id: string;
	user_id: string;
	name: string;
	currency: 'INR';
	balance_paise: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
}

export interface Category {
	id: string;
	user_id: string;
	name: string;
	color: string;
	is_system: 0 | 1;
	sort_order: number;
	parent_id: string | null; // null = top-level; one level of nesting only
	bucket: CategoryBucket; // committed = essential/obligation, flexible = discretionary
	daily_reserve_paise: number; // paise locked per remaining day (0 = none)
	deleted_at: string | null;
}

/** A category with its children attached, for grouped display. */
export interface CategoryTree extends Category {
	children: Category[];
}

export interface Obligation {
	id: string;
	user_id: string;
	name: string;
	amount_paise: number;
	category_id: string | null;
	cadence: HarbourCadence;
	is_active: 0 | 1;
	created_at: string;
	deleted_at: string | null;
}

/** An obligation plus whether it has been settled in the current period. */
export interface ObligationStatus extends Obligation {
	paid: boolean;
}

export interface ReconciliationPeriod {
	id: string;
	account_id: string;
	period_start: string; // 'YYYY-MM-DD'
	period_end: string; // 'YYYY-MM-DD'
	cadence: HarbourCadence;
	opening_balance_paise: number;
	closing_balance_paise: number | null; // null until harboured
	harboured_at: string | null; // null until harboured
}

export interface Transaction {
	id: string;
	account_id: string;
	category_id: string;
	period_id: string | null; // null = unassigned, swept at harbour
	amount_paise: number; // negative = expense, positive = income
	description: string;
	occurred_at: string; // ISO datetime, user-supplied
	entered_at: string;
	source: TransactionSource;
	is_uncategorized_fallback: 0 | 1;
	deleted_at: string | null;
}

export interface VoiceSample {
	id: string;
	user_id: string;
	raw_transcript: string;
	parsed_json: string; // JSON of AnchorParseResult
	final_json: string; // JSON of the confirmed TransactionDraft
	was_corrected: 0 | 1;
	created_at: string;
}

// ── Input/draft types ─────────────────────────────────────────────────────────

export interface NewTransaction {
	account_id: string;
	category_id: string;
	amount_paise: number;
	description: string;
	occurred_at: string;
	source: TransactionSource;
}

/** Prefill state shared between voice and tap paths. */
export interface TransactionDraft {
	amount_paise: number | null;
	category_id: string | null;
	description: string;
	occurred_at: string; // defaults to now
}

export interface NewCategory {
	user_id: string;
	name: string;
	color: string;
	parent_id?: string | null;
	bucket?: CategoryBucket;
	daily_reserve_paise?: number;
}

export interface NewObligation {
	user_id: string;
	name: string;
	amount_paise: number;
	category_id?: string | null;
	cadence?: HarbourCadence;
}

// ── View/aggregate types ──────────────────────────────────────────────────────

export interface AccountSummary {
	balance_paise: number;
	remaining_paise: number; // opening_balance + income - expenses for current period
	current_period: ReconciliationPeriod;
	harbour_visits: number; // count of harboured periods, never resets
	open_periods: number; // periods not yet harboured (>1 = amnesty needed)

	// The control view: what is actually free to spend.
	safe_to_spend_paise: number; // remaining - unpaid obligations - reserved essentials
	locked_obligations_paise: number; // unpaid obligations due this period
	locked_reserve_paise: number; // days_remaining * total daily reserve
	daily_reserve_paise: number; // sum of per-category daily reserves
	days_remaining: number; // days from today to period end (today excluded)
}

export interface PeriodSummary {
	period: ReconciliationPeriod;
	by_category: CategoryTotal[];
	total_expense_paise: number;
	total_income_paise: number;
	uncategorized_paise: number;
}

export interface CategoryTotal {
	category: Category;
	total_paise: number;
	transaction_count: number;
}

export interface DriftPoint {
	period_start: string;
	drift_paise: number; // closing_balance_paise - keel_estimate_paise
}
