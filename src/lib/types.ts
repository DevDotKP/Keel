// Shared domain types for Keel.
// All money is integer paise. Dates are ISO strings.

export type HarbourCadence = 'weekly' | 'fortnightly' | 'monthly';
export type TransactionSource = 'tap' | 'voice';
export type EntitlementStatus = 'trialing' | 'expired' | 'owned';

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
	deleted_at: string | null;
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
}

// ── View/aggregate types ──────────────────────────────────────────────────────

export interface AccountSummary {
	balance_paise: number;
	remaining_paise: number; // opening_balance + income - expenses for current period
	current_period: ReconciliationPeriod;
	harbour_visits: number; // count of harboured periods, never resets
	open_periods: number; // periods not yet harboured (>1 = amnesty needed)
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
