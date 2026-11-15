## GAPS.md weekly review — 2026-11-15

### Stale open gaps (>7 days)

None. All 7 logged gaps have been closed: 4 promoted to CLAUDE.md, 3 discarded.

| # | Date | Topic | Disposition |
|---|------|-------|-------------|
| 1 | 2026-06-22 | Attribution hidden on own entries | Promoted to CLAUDE.md |
| 2 | 2026-06-22 | Dashboard grid broke on desktop/tablet | Discarded |
| 3 | 2026-06-22 | Native OS dropdown chrome in dark mode | Discarded |
| 4 | 2026-06-22 | Landing page was a wall of text | Discarded |
| 5 | 2026-06-22 | Notion search missed Critical items | Promoted to CLAUDE.md |
| 6 | 2026-06-23 | Edit claimed correct, hid real DB bug | Promoted to CLAUDE.md |
| 7 | 2026-06-24 | Diagnosed wrong prod URL for a whole session | Promoted to CLAUDE.md |

---

### Patterns found

No open gaps to pattern — but reviewing the full history (all 7 gaps, Jun 22–24):

**Theme: Over-claiming correctness (gaps 1, 6)**
Claude declared something done or working before verifying it. Gap 1: attribution looked removed because Claude hid it on own entries. Gap 6: edit form failure was attributed to a repro issue, not a missing DB column. Both required the user to push back twice.

**Theme: Wrong surface / wrong target (gaps 2, 3, 4, 7)**
Four of seven gaps involved producing output aimed at the wrong thing — wrong screen size (gap 2), native widget instead of custom component (gap 3), text wall instead of visual landing (gap 4), wrong prod URL (gap 7). This is the largest pattern historically.

These are all resolved; flagging for awareness if new gaps emerge in similar territory.

---

### Promotion candidates

None — no gaps are currently open. All promotion-eligible gaps (1, 5, 6, 7) have already been promoted.

---

### Suggested next actions

1. **Encourage fresh gap logging.** The gap log has been quiet since 2026-06-24 (~5 months). Either the product is very stable, or mismatch incidents aren't being captured. Consider spending 5 minutes after the next session asking: "Did Claude produce anything unexpected?" and logging even small mismatches — they compound into rules.

2. **Audit CLAUDE.md standing rules for drift.** With 4 promoted rules now in place, do a quick read of CLAUDE.md to confirm each rule is still being honored in practice. The "over-claiming correctness" and "wrong target" patterns above are only useful if the rules derived from them are enforced session-to-session.

3. **Consider a 'Discarded' review.** Gaps 2, 3, 4 were discarded rather than promoted. At the time that was the right call, but as the product matures (responsive design, premium UI, landing page) revisiting whether any of those discarded gaps should become standing rules may be worthwhile.
