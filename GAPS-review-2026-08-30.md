## GAPS.md weekly review — 2026-08-30

### Stale open gaps (>7 days)

All 7 open gaps are stale. Each is 67–69 days old with no disposition change.

| # | Date | Age (days) | Summary |
|---|------|-----------|---------|
| 1 | 2026-06-22 | 69 | Attribution hidden on own entries after UI change |
| 2 | 2026-06-22 | 69 | Dashboard 2-column grid broke on desktop/tablet |
| 3 | 2026-06-22 | 69 | Native OS dropdown chrome instead of custom selects |
| 4 | 2026-06-22 | 69 | Landing page is a wall of text, not visual |
| 5 | 2026-06-22 | 69 | Notion search missed Critical items due to 25-row cap |
| 6 | 2026-06-23 | 68 | Edit entry broken; Claude over-claimed it was correct |
| 7 | 2026-06-24 | 67 | Diagnosed wrong URL (keel.pages.dev vs keel-aba.pages.dev) |

---

### Patterns found

**Theme A — UI Polish / Premium Feel** (gaps #1, #2, #3, #4) — 4 gaps
Claude is repeatedly producing UI that falls below the stated premium bar: broken responsive layouts, native browser chrome where custom components were requested, wall-of-text pages instead of visual ones, and dropped UI features. This is a coherent signal that the premium-look constraint is not being applied consistently.

**Theme B — Diagnosis Accuracy / Over-claiming** (gaps #5, #6, #7) — 3 gaps
Claude declared things correct or complete when they weren't: a broken edit column was called correct (#6), the wrong deployment URL was treated as the real one (#7), and a tool search was accepted as exhaustive when it wasn't (#5). These are distinct failure modes but share a root cause: insufficient verification before asserting correctness.

---

### Promotion candidates

Both candidates have been open 68–69 days and touch core mechanics.

**Gap #6 → Forgiveness mechanic**
Editing an entry is the primary forgiveness action in Keel. Claude over-claimed the edit path was correct without verifying the schema. Suggested Standing Rule:

> **Never declare an edit or mutation correct without verifying the schema column it writes to.** For any `UPDATE`/`INSERT`, confirm the column exists in the current migration before closing the task.

**Gap #2 → Runway / Dashboard**
The dashboard is where runway is visible. A layout that breaks on desktop/tablet hides financial state from users not on mobile. Suggested Standing Rule:

> **All dashboard and runway-display layouts must be tested at three viewports: 375 px (mobile), 768 px (tablet), and 1280 px (desktop) before the task is closed.** A layout fix that only looks right on mobile is not done.

Supplementary candidates (UI polish pattern, gaps #1, #3, #4):

**Gap #1 → Attribution (forgiveness / "who added it" mechanic)**
Suggested Standing Rule:
> **Attribution on entries is always visible, including the current user's own entries.** Never hide the "who added it" field as a side-effect of a UI change.

---

### Suggested next actions

1. **Promote gaps #6 and #2 to CLAUDE.md this week.** Both are old enough, concrete enough, and touch mechanics that will recur. Draft the two Standing Rules above verbatim and add them under a "Core mechanic rules" heading.

2. **Triage the UI-polish cluster (#1, #3, #4) in one sitting.** All three are cheap to verify visually. Open the app, check attribution, check select styling, check the landing page. Either promote each to a Standing Rule or discard if already fixed. Don't let this cluster age another week unreviewed.

3. **Add a verification step to the workflow for gaps #5 and #7 (diagnosis accuracy).** Before declaring any external-tool result or deployment state correct, require one explicit check: for Notion, filter on Status=Open with no row cap; for deploys, run `wrangler pages project list` to confirm the actual domain. Write this as a checklist item in CLAUDE.md under "Before marking a task done."
