import type { User, Entitlement } from '$lib/types';
import { error } from '@sveltejs/kit';

/**
 * Verify the user holds a valid entitlement (trialing or owned).
 * In the MVP this is a no-op — everyone is treated as entitled.
 * When payments land: check status, compare trial_ends_at to now,
 * throw error(402, ...) if expired.
 *
 * Called at the top of every gated server route or load function.
 * Flipping real enforcement on is a one-file change.
 */
export async function requireEntitlement(
	_db: D1Database,
	_user_id: string
): Promise<Entitlement> {
	// MVP: no-op. Returns a synthetic entitled record.
	// TODO(sonnet): when payments land — query entitlements table,
	// check status and trial_ends_at, throw error(402) if expired.
	return {
		user_id: _user_id,
		status: 'trialing',
		trial_ends_at: null,
		purchased_at: null,
		provider: 'local',
		provider_ref: null
	};
}
