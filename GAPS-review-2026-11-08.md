## GAPS.md weekly review — 2026-11-08

### Stale open gaps (>7 days)

None. All 7 logged gaps have been closed:
- Gaps #1, #5, #6, #7 → Promoted to CLAUDE.md
- Gaps #2, #3, #4 → Discarded

### Patterns found

No open gaps to group. Looking at the full history for reference:

| Theme | Gaps | Notes |
|-------|------|-------|
| Verification / over-claiming correctness | #6, #7 | Claude asserted things were correct or working without checking; both promoted |
| UI / visual quality | #2, #3, #4 | Desktop layout, native selects, weak landing — all discarded (likely addressed in design iteration) |
| Feature preservation | #1 | Dropped a user-visible feature while implementing another |
| Tooling / context retrieval | #5 | Relied on a capped search rather than fetching the full open set |

No theme currently has 3+ open gaps, so no active pattern to name.

### Promotion candidates

None. All gaps that touched core mechanics have already been promoted:
- #1 → attribution visibility rule
- #5 → Notion critical-items retrieval rule
- #6 → correctness verification before claiming a fix works
- #7 → deploy URL verification (use `wrangler pages project list`)

### Suggested next actions

1. **Audit CLAUDE.md standing rules** — confirm the 4 promoted rules (#1, #5, #6, #7) are present and accurately worded; they were logged months ago and the codebase may have drifted.

2. **Keep the log fresh** — GAPS.md has had no new entries since 2026-06-24 (4½ months). Either nothing has misfired (great) or mismatches are going unlogged. If the latter, re-establish the habit of appending a row whenever Claude's output diverges from expectation, even for small things.

3. **Consider retiring the Discarded gaps** (#2, #3, #4) to a separate archive section so the active table stays focused on promoted rules and the rationale behind them.
