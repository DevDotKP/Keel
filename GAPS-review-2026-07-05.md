## GAPS.md weekly review — 2026-07-05

### Stale open gaps (>7 days)

All 7 open gaps are stale. None have been resolved or triaged since they were logged.

| # | Date | Age (days) | Summary |
|---|------|------------|---------|
| 1 | 2026-06-22 | 13 | Attribution hidden on own entries after "add photo + name" request |
| 2 | 2026-06-22 | 13 | Dashboard grid broke on desktop/tablet |
| 3 | 2026-06-22 | 13 | Native OS dropdown chrome instead of hand-built selects |
| 4 | 2026-06-22 | 13 | Wall-of-text landing page instead of visual/attention-grabbing |
| 5 | 2026-06-22 | 13 | Notion critical-item check missed P0/P1s due to 25-row search cap |
| 6 | 2026-06-23 | 12 | Claimed edit code was correct; missed `updateTransaction` writing non-existent `updated_at` |
| 7 | 2026-06-24 | 11 | Diagnosed prod against `keel.pages.dev` (stranger's site) instead of `keel-aba.pages.dev` |

### Patterns found

**Pattern 1 — Premium UI / visual quality (Gaps 2, 3, 4)**
Three gaps in a row all stem from the same root: Claude defaulted to low-effort or semantically-correct-but-ugly output (native OS dropdowns, text-heavy landing, broken grid) rather than holding the premium-feel bar. This isn't a one-off; it's a recurring assumption that functional ≈ acceptable.

**Pattern 2 — Diagnosis against wrong ground truth (Gaps 6, 7)**
Two gaps where Claude over-claimed correctness or debugged against the wrong target without first verifying the actual state (the correct column name, the correct domain). Only 2 items, not yet a named pattern — but worth watching; a third instance would make it one.

### Promotion candidates

No gaps have been open 14+ days yet (closest are Gaps 1–5 at 13 days). Re-evaluate next review cycle (2026-07-12) if they remain open — at that point Gaps 1–5 will cross the threshold.

**Pre-promote watch list for next cycle:**
- Gap 1 — touches attribution display (core "who owns this" mechanic)
- Gap 2 — touches responsive layout (premium feel is a core product value)
- Gap 4 — touches first impression / landing (forgiveness starts at onboarding)

If any of these remain open on 2026-07-12, suggested Standing Rule text is ready below:

> **Gap 1 candidate rule:** "When adding or changing attribution display, always verify that the change applies to all entry types — including entries owned by the current user — and never silently remove a feature that was explicitly requested in the same task."

> **Gap 2 candidate rule:** "Every UI layout change must be verified at mobile, tablet, and desktop breakpoints before declaring it done. A layout that passes mobile is not done."

> **Gap 4 candidate rule:** "Landing pages and first-run screens must lead with a visual hook — illustration, summary stat, or single-action CTA — never a wall of text. Default to visual unless explicitly asked for text."

### Suggested next actions

1. **Triage Gaps 2, 3, 4 as a block.** These three share the same root cause (premium-feel bar not held). Resolve them together in one focused UI pass rather than one-by-one; closing the theme is faster than closing the tickets individually.

2. **Add a domain-verification step to the debugging checklist (Gap 7).** Before diagnosing any production issue, run `wrangler pages project list` (or equivalent) to confirm the actual live URL. Consider adding this as a CLAUDE.md reminder rather than waiting for the 14-day threshold — it costs nothing and prevents another wasted session.

3. **Re-run the Notion critical-item check with a filter that surfaces all statuses (Gap 5).** The 25-row cap is a known miss; either paginate or add a status ≠ Done filter so P0/P1 items can't hide. Verify the fix by comparing the result against a manual screenshot.
