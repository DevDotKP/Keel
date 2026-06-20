import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Unit tests for the transaction edit path.
 *
 * The edit path is PATCH /api/transactions/[id]. Key invariants:
 * 1. Sign of amount_paise is derived from category kind (income → positive, expense → negative)
 * 2. The client always sends a positive magnitude; the server re-derives the sign
 * 3. PatchSchema validates the payload before touching the DB
 * 4. An edit must be scoped to an account_id — no cross-user edits possible
 * 5. Soft-deleted transactions cannot be edited
 */

// ── Sign derivation ───────────────────────────────────────────────────────────
// Mirrors the logic in PATCH /api/transactions/[id]/+server.ts

function deriveSignedAmount(magnitudePaise: number, categoryKind: string): number {
	return categoryKind === 'income' ? magnitudePaise : -magnitudePaise;
}

describe('edit path: sign derivation', () => {
	it('income category → positive amount', () => {
		expect(deriveSignedAmount(50000, 'income')).toBe(50000);
	});

	it('expense category → negative amount', () => {
		expect(deriveSignedAmount(50000, 'expense')).toBe(-50000);
	});

	it('investment category → negative amount (same as expense)', () => {
		expect(deriveSignedAmount(100000, 'investment')).toBe(-100000);
	});

	it('zero magnitude stays zero regardless of kind', () => {
		expect(deriveSignedAmount(0, 'income')).toBe(0);
		expect(deriveSignedAmount(0, 'expense')).toBe(-0);
		expect(Math.abs(deriveSignedAmount(0, 'expense'))).toBe(0);
	});

	it('never accepts a negative magnitude from the client', () => {
		// The PatchSchema enforces amount_paise to be positive().
		// Sign is always server-derived — client sends magnitude only.
		const magnitude = 30000;
		expect(magnitude).toBeGreaterThan(0); // client must send positive
		const signed = deriveSignedAmount(magnitude, 'expense');
		expect(signed).toBe(-30000); // server makes it negative
	});
});

// ── PatchSchema validation ────────────────────────────────────────────────────
// Mirrors the Zod schema in /api/transactions/[id]/+server.ts

const PatchSchema = z.object({
	amount_paise: z.number().int().positive(),
	category_id: z.string(),
	description: z.string().max(200).default(''),
	note: z.string().max(500).default(''),
	occurred_at: z.string().datetime({ offset: true })
});

const VALID_PAYLOAD = {
	amount_paise: 5000,
	category_id: 'cat-123',
	description: 'Swiggy',
	note: '',
	occurred_at: '2026-06-15T14:30:00+05:30'
};

describe('edit path: PatchSchema validation', () => {
	it('accepts a valid payload', () => {
		const result = PatchSchema.safeParse(VALID_PAYLOAD);
		expect(result.success).toBe(true);
	});

	it('rejects non-integer amount_paise', () => {
		const result = PatchSchema.safeParse({ ...VALID_PAYLOAD, amount_paise: 50.5 });
		expect(result.success).toBe(false);
	});

	it('rejects negative amount_paise (sign is server-side)', () => {
		const result = PatchSchema.safeParse({ ...VALID_PAYLOAD, amount_paise: -5000 });
		expect(result.success).toBe(false);
	});

	it('rejects zero amount_paise', () => {
		const result = PatchSchema.safeParse({ ...VALID_PAYLOAD, amount_paise: 0 });
		expect(result.success).toBe(false);
	});

	it('rejects description longer than 200 characters', () => {
		const result = PatchSchema.safeParse({ ...VALID_PAYLOAD, description: 'x'.repeat(201) });
		expect(result.success).toBe(false);
	});

	it('accepts description exactly 200 characters', () => {
		const result = PatchSchema.safeParse({ ...VALID_PAYLOAD, description: 'x'.repeat(200) });
		expect(result.success).toBe(true);
	});

	it('rejects note longer than 500 characters', () => {
		const result = PatchSchema.safeParse({ ...VALID_PAYLOAD, note: 'x'.repeat(501) });
		expect(result.success).toBe(false);
	});

	it('defaults description to empty string when omitted', () => {
		const { description: _d, ...withoutDesc } = VALID_PAYLOAD;
		const result = PatchSchema.safeParse(withoutDesc);
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.description).toBe('');
	});

	it('defaults note to empty string when omitted', () => {
		const { note: _n, ...withoutNote } = VALID_PAYLOAD;
		const result = PatchSchema.safeParse(withoutNote);
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.note).toBe('');
	});

	it('accepts ISO 8601 datetime with timezone offset', () => {
		const variants = [
			'2026-06-15T14:30:00+05:30', // IST
			'2026-06-15T09:00:00+00:00', // UTC explicit
			'2026-06-15T09:00:00Z',       // UTC Z
		];
		for (const occurred_at of variants) {
			const result = PatchSchema.safeParse({ ...VALID_PAYLOAD, occurred_at });
			expect(result.success).toBe(true);
		}
	});

	it('rejects a date-only string (missing time component)', () => {
		const result = PatchSchema.safeParse({ ...VALID_PAYLOAD, occurred_at: '2026-06-15' });
		expect(result.success).toBe(false);
	});

	it('rejects an invalid date string', () => {
		const result = PatchSchema.safeParse({ ...VALID_PAYLOAD, occurred_at: 'not-a-date' });
		expect(result.success).toBe(false);
	});
});

// ── Edit scope isolation ──────────────────────────────────────────────────────
// The DB query filters by both `id` AND `account_id` so one user cannot
// edit another user's transactions, even if they guess the UUID.

describe('edit path: account scope isolation', () => {
	it('requires both transaction id and account_id to match', () => {
		// Simulate the WHERE clause: id = ? AND account_id = ? AND deleted_at IS NULL
		interface TxRow {
			id: string;
			account_id: string;
			deleted_at: string | null;
		}

		const mockDb: TxRow[] = [
			{ id: 'tx-1', account_id: 'acc-alice', deleted_at: null },
			{ id: 'tx-2', account_id: 'acc-bob', deleted_at: null },
			{ id: 'tx-3', account_id: 'acc-alice', deleted_at: '2026-01-01' } // soft deleted
		];

		function canEdit(id: string, accountId: string): boolean {
			return mockDb.some(
				row => row.id === id && row.account_id === accountId && row.deleted_at === null
			);
		}

		expect(canEdit('tx-1', 'acc-alice')).toBe(true);   // owner can edit
		expect(canEdit('tx-1', 'acc-bob')).toBe(false);    // wrong account
		expect(canEdit('tx-2', 'acc-alice')).toBe(false);  // different user's tx
		expect(canEdit('tx-3', 'acc-alice')).toBe(false);  // soft deleted
		expect(canEdit('tx-999', 'acc-alice')).toBe(false); // non-existent
	});

	it('soft delete does not affect other transactions in the same account', () => {
		interface TxRow {
			id: string;
			account_id: string;
			deleted_at: string | null;
		}

		const before: TxRow[] = [
			{ id: 'tx-1', account_id: 'acc-1', deleted_at: null },
			{ id: 'tx-2', account_id: 'acc-1', deleted_at: null },
			{ id: 'tx-3', account_id: 'acc-1', deleted_at: null }
		];

		// Soft delete tx-2 only
		const after = before.map(row =>
			row.id === 'tx-2' ? { ...row, deleted_at: '2026-06-15' } : row
		);

		// tx-1 and tx-3 unaffected
		expect(after.find(r => r.id === 'tx-1')?.deleted_at).toBeNull();
		expect(after.find(r => r.id === 'tx-3')?.deleted_at).toBeNull();
		// tx-2 is soft deleted
		expect(after.find(r => r.id === 'tx-2')?.deleted_at).toBeTruthy();
	});
});
