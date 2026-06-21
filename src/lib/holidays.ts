// Bank holiday data, bundled and offline (no live API), keyed by state.
//
// National fixed-date holidays apply everywhere and are safe to hard-code.
// State-specific and lunar-calendar holidays (Holi, Diwali, Eid, regional days)
// move every year and differ by state. Those are intentionally NOT guessed here:
// they must be filled from the RBI published holiday list, refreshed yearly.
// Inventing them would silently produce wrong salary and obligation dates.

import { isoDate } from '$lib/utils/workdays';
import type { HolidaySet } from '$lib/utils/workdays';

export const INDIAN_STATES = [
	'Andhra Pradesh',
	'Arunachal Pradesh',
	'Assam',
	'Bihar',
	'Chhattisgarh',
	'Goa',
	'Gujarat',
	'Haryana',
	'Himachal Pradesh',
	'Jharkhand',
	'Karnataka',
	'Kerala',
	'Madhya Pradesh',
	'Maharashtra',
	'Manipur',
	'Meghalaya',
	'Mizoram',
	'Nagaland',
	'Odisha',
	'Punjab',
	'Rajasthan',
	'Sikkim',
	'Tamil Nadu',
	'Telangana',
	'Tripura',
	'Uttar Pradesh',
	'Uttarakhand',
	'West Bengal',
	'Andaman and Nicobar Islands',
	'Chandigarh',
	'Dadra and Nagar Haveli and Daman and Diu',
	'Delhi',
	'Jammu and Kashmir',
	'Ladakh',
	'Lakshadweep',
	'Puducherry'
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

// Same date every year, observed across India.
const NATIONAL_FIXED: ReadonlyArray<{ month: number; day: number }> = [
	{ month: 1, day: 26 }, // Republic Day
	{ month: 8, day: 15 }, // Independence Day
	{ month: 10, day: 2 } // Gandhi Jayanti
];

// Per-state, per-year movable and regional holidays as ISO 'YYYY-MM-DD'.
// Seed from the RBI list when sourced; empty means national fixed dates only.
const STATE_HOLIDAYS: Partial<Record<IndianState, ReadonlySet<string>>> = {
	// Example shape, fill from RBI:
	// 'Maharashtra': new Set(['2026-11-08', '2026-03-25'])
};

/**
 * The bank-holiday set to feed the working-day engine for a given state and
 * year. Always includes the national fixed-date holidays; adds state-specific
 * holidays when they have been sourced. A null state yields national only.
 */
export function holidaysForState(state: IndianState | null, year: number): HolidaySet {
	const set = new Set<string>();
	for (const h of NATIONAL_FIXED) set.add(isoDate(year, h.month, h.day));
	const extra = state ? STATE_HOLIDAYS[state] : undefined;
	if (extra) for (const d of extra) set.add(d);
	return set;
}
