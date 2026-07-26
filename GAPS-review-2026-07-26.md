## GAPS.md weekly review — 2026-07-26

### Stale open gaps (>7 days)

All 7 open gaps are stale. Oldest are 34 days old (2026-06-22). None have been Promoted or Discarded.

| # | Date | Age (days) | Summary |
|---|------|-----------|---------|
| 1 | 2026-06-22 | 34 | Attribution hidden on own entries after UI change |
| 2 | 2026-06-22 | 34 | Dashboard broke on desktop/tablet (2-col grid) |
| 3 | 2026-06-22 | 34 | Native OS dropdown chrome used instead of custom selects |
| 4 | 2026-06-22 | 34 | Landing page rendered as wall of text, not visual |
| 5 | 2026-06-23 | 33 | Notion critical-items check missed P0/P1 items |
| 6 | 2026-06-24 | 32 | Edit entry mis-diagnosed; over-claimed code was correct |
| 7 | 2026-06-24 | 32 | Wrong prod URL used; whole session spent on a non-bug |

**All 7 gaps are stale and need a disposition decision this week.**

---

### Patterns found

**Pattern: UI quality / premium feel** — Gaps 2, 3, 4 (3 gaps)

Three separate sessions produced UI output that broke the product's "premium feel" bar:
- Gap 2: Responsive grid collapsed on desktop/tablet.
- Gap 3: Native OS select chrome (bevel, double arrows) used instead of custom components.
- Gap 4: Landing page shipped as a text wall instead of a visual, attention-grabbing design.

These are not one-off mistakes; they point to a missing check: "does this look right off mobile, and does it look hand-built?" No other theme reached 3 gaps.

**Minor cluster (2 gaps, not yet a pattern): Diagnosis over-confidence** — Gaps 6, 7

Both gaps involved Claude asserting something was correct or broken without verifying against the actual running system (schema columns, real prod URL). Two occurrences is a trend to watch; a third would make it a named pattern.

---

### Promotion candidates

Both candidates are 30+ days old and touch core mechanics.

**Gap 6 → promotes to Standing Rule: "Verify edits against the live schema before claiming correctness"**

Gap 6 (edit entry, `updateTransaction` writing a non-existent `updated_at` column) touches the **forgiveness** mechanic — the ability to correct a recorded expense is fundamental to the app's identity. Mis-diagnosing a broken edit path delayed a real fix and eroded trust.

> Suggested rule: *Before asserting that an update/edit path is correct, confirm every column written by the mutation exists in the current schema. Do not ask for a repro until you have run or traced the write path yourself.*

---

**Gap 1 → promotes to Standing Rule: "Attribution is always shown, including on your own entries"**

Gap 1 (attribution hidden on own entries after a UI change) touches the **Harbour** social mechanic — knowing who added an entry is core to shared/household tracking. Silently removing it on self-authored entries is a regression, not a simplification.

> Suggested rule: *Attribution ("added by") must render on every entry, including entries created by the current user. Hiding it for self-authored rows is a regression and must never be treated as a safe default.*

---

### Suggested next actions

1. **Dispose of all 7 stale gaps this week.** Each needs one of: Promoted to CLAUDE.md, or Discarded (with a one-line reason). The backlog sitting open for 30+ days is itself a signal the review cadence has lapsed.

2. **Promote Gaps 1 and 6 to CLAUDE.md as Standing Rules** (text above is ready to paste). These two gaps recurred or nearly recurred — without a rule, they will happen again.

3. **Open a focused UI-quality sprint or checklist** to address the premium-feel pattern (Gaps 2, 3, 4). The common fix is a pre-ship checklist item: "Test at 1280px wide; confirm all interactive elements use custom components, not native OS chrome." Consider adding this to CLAUDE.md as a UI hygiene rule if the pattern holds.
