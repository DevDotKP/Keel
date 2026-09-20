## GAPS.md weekly review — 2026-09-20

> **🚨 Critical finding:** All 7 gaps were closed on 2026-09-13 — but **CLAUDE.md does not exist** in the repository. Four gaps (1, 5, 6, 7) were marked "Promoted to CLAUDE.md" in commit `f4745cd`, which states the rules were "written locally." They were never committed. The Standing Rules are missing from the codebase. This must be corrected before the next session touches any of the four affected mechanics.

---

### Stale open gaps (>7 days)

**None.** All 7 gaps were closed in commit `f4745cd` (2026-09-13, 7 days ago):

| # | Date | Disposition | Notes |
|---|------|-------------|-------|
| 1 | 2026-06-22 | Promoted to CLAUDE.md | Rule never committed — see critical finding |
| 2 | 2026-06-22 | Discarded | Code fix already in place (single-column layout at 768px+) |
| 3 | 2026-06-22 | Discarded | Code fix already in place (custom select via `appearance:none` + chevron in app.css) |
| 4 | 2026-06-22 | Discarded | Code fix already in place (visual auth/landing page with hero live) |
| 5 | 2026-06-22 | Promoted to CLAUDE.md | Rule never committed — see critical finding |
| 6 | 2026-06-23 | Promoted to CLAUDE.md | Rule never committed — see critical finding |
| 7 | 2026-06-24 | Promoted to CLAUDE.md | Rule never committed — see critical finding |

The gap tracker itself is clean. The CLAUDE.md gap is what needs action.

---

### Patterns found

No open gaps to pattern-analyze. The two patterns named in prior reviews (UI & Visual Quality; Verification & Diagnosis) were resolved by the 2026-09-13 closures. No new gaps have been logged since.

---

### Promotion candidates

None remaining from the current gap list — but the four rules that were promoted must still be written. They are reproduced here verbatim from prior drafts so they can be committed without redesign:

**Gap 1 → Harbour mechanic (social attribution)**
> **Preserve-existing-features:** When modifying a component that owns a visible feature (attribution, avatar, timestamp), confirm every existing feature still renders after the change. Treat unmentioned features as required to survive. Do not interpret a UI task as permission to remove them.

**Gap 5 → Notion / external search (completeness)**
> **Full-result-queries:** Never rely on a default or paginated Notion search that truncates results. When checking for Critical or P0 items, query with explicit `filter` parameters covering `status` and `severity`, and read every page of results. A search that could silently omit items must not be treated as authoritative.

**Gap 6 → forgiveness mechanic (correct, painless editing)**
> **Schema-before-write:** Before claiming any data mutation (insert, update, delete) is correct, verify the schema includes every column being written. Run `PRAGMA table_info(<table>)` or equivalent and read the output. Do not ask for a repro; locate the column mismatch yourself first.

**Gap 7 → Harbour / deployment (production verification)**
> **Confirm-the-URL:** Before diagnosing any production issue, run `wrangler pages project list` to confirm the actual deployed project name and URL. Never assume any `*.pages.dev` subdomain belongs to this project; treat the real URL as unknown until verified.

---

### Suggested next actions

1. **Create CLAUDE.md and commit the four Standing Rules above.** The rules are drafted and ready — this is a copy-paste, not a design decision. Do it before the next coding session so the Verification rules (Gaps 6 and 7) are active. Burning another session on the wrong URL or a missing column because the rule was never written is entirely preventable.

2. **Add a lightweight "promotion check" step to the GAPS workflow.** When a gap is marked "Promoted to CLAUDE.md," the promotion is only complete once CLAUDE.md contains the rule and the commit lands. Consider treating the gap as still Open until the rule commit SHA is recorded.

3. **Keep logging new gaps as they arise.** The tracker is now at zero debt — a healthy baseline. The goal is not to stay at zero indefinitely but to catch mismatches fast and promote durable rules before they recur.
