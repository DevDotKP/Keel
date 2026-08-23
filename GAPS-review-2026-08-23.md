## GAPS.md weekly review — 2026-08-23

### Stale open gaps (>7 days)

All 7 gaps are stale — opened 60–62 days ago with no disposition change:

| # | Date | Age (days) | Summary |
|---|------|-----------|---------|
| 1 | 2026-06-22 | 62 | Attribution hidden on own entries after UI change |
| 2 | 2026-06-22 | 62 | Dashboard grid broke on desktop/tablet |
| 3 | 2026-06-22 | 62 | Native OS select chrome appeared in dark mode |
| 4 | 2026-06-22 | 62 | Landing page rendered as wall of text |
| 5 | 2026-06-22 | 62 | Notion critical-item search missed several P0/P1 items |
| 6 | 2026-06-23 | 61 | Edit entry misdiagnosed — non-existent `updated_at` column |
| 7 | 2026-06-24 | 60 | Wrong deploy URL used; burned a session diagnosing a non-bug |

### Patterns found

**UI / premium feel** — Gaps #1, #2, #3, #4 (4 gaps)

All four opened on 2026-06-22 and share the same root failure: Claude produced output that visually regressed a quality bar that was already established. The failures span attribution display, responsive layout, form controls, and the landing page — different surfaces, same cause: no premium-feel checklist applied before shipping.

**Developer workflow errors** — Gaps #5, #6, #7 (3 gaps)

Three separate sessions where Claude skipped a basic verification step before declaring a result:
- #5: Used an incomplete Notion search and claimed the result was complete
- #6: Over-claimed correctness on a mutation path without checking the schema
- #7: Used the wrong URL as the deployment target for an entire debugging session

Each gap cost the user time (missed P0s, delayed fix, burned session). The pattern is premature confidence — asserting something is correct or working before actually verifying it against ground truth.

### Promotion candidates

**Gap #6** (61 days open, touches edit/forgiveness mechanic)

Editing entries is central to Keel's forgiveness mechanic — if corrections are broken and the diagnosis is wrong, the user has no path to fix their data. Suggested Standing Rule:

> **Schema-first diagnosis:** Before diagnosing any data-write failure as correct or unreproducible, verify every column name in the write statement against the live schema. Never claim a mutation path is correct without confirming the column exists.

**Gap #1** (62 days open, touches add flow / attribution)

Who added an entry is a core social feature of the add flow. Hiding it on the user's own entries silently dropped a requested feature. Suggested Standing Rule:

> **Attribution invariant:** When modifying how entries are displayed, attribution fields (who added it, photo, name) must remain visible on all entries including the current user's own, unless the user explicitly requests hiding them.

### Suggested next actions

1. **Triage all 7 gaps this week.** At 60+ days with no disposition, GAPS.md has stalled. Each gap should be Promoted, Discarded, or explicitly accepted as deferred debt — leaving all 7 Open means new real mismatches will drown in noise.

2. **Promote Gaps #6 and #1 to CLAUDE.md as Standing Rules** using the text above. Both touch mechanics that have failed in ways a simple rule would prevent, and both have sat open long enough to prove they are not flukes.

3. **Bundle Gaps #2, #3, #4 into a single "premium feel audit" card.** Filing three separate UI-polish items individually will stall them further. One sprint item — "Responsive grid, custom selects, landing page" — gives them a shared home and a realistic path to Done.
