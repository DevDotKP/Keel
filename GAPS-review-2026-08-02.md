## GAPS.md weekly review — 2026-08-02

### Stale open gaps (>7 days)

All 7 open gaps are stale. Every item predates today by 39–41 days with no disposition change.

| # | Date | Age (days) | Summary |
|---|------|-----------|---------|
| 1 | 2026-06-22 | 41 | Attribution hidden on own entries after "who added it" change |
| 2 | 2026-06-22 | 41 | Dashboard 2-column grid breaks on desktop/tablet |
| 3 | 2026-06-22 | 41 | Native OS dropdown chrome instead of custom selects |
| 4 | 2026-06-22 | 41 | Landing page is a wall of text, not visual |
| 5 | 2026-06-22 | 41 | Notion "critical items" check relies on 25-row search, misses P0/P1s |
| 6 | 2026-06-23 | 40 | Edit diagnosis over-claimed correctness; missed `updated_at` schema gap |
| 7 | 2026-06-24 | 39 | Diagnosed wrong URL (keel.pages.dev) instead of real prod (keel-aba.pages.dev) |

---

### Patterns found

**UI / Visual Polish (Gaps 2, 3, 4) — PATTERN**
Three gaps all point to the same failure mode: the UI regresses away from "premium, hand-built" feel. Gap 2 (responsive layout), Gap 3 (native dropdown chrome), and Gap 4 (text-only landing) are all instances of shipping something that looks unfinished. This is a standing quality bar issue, not a one-off bug.

**Diagnosis accuracy / over-claiming (Gaps 6, 7) — emerging pattern**
Two gaps share the shape of "Claude declared a state (code is correct / prod is broken) without first verifying ground truth." Not yet 3 gaps, but worth watching — one more instance should trigger a rule.

**Attribution / add flow (Gap 1) — single item**
No pattern yet; isolated to one feature request.

**Tooling / context fetching (Gap 5) — single item**
No pattern yet; isolated to Notion search limitations.

---

### Promotion candidates

All 7 gaps are 39+ days old. The following three touch core mechanics (add flow, data integrity, deployment reliability) and have clear, actionable rule forms.

**Gap 7 → Standing Rule: "Verify the real production URL before diagnosing"**
> Before diagnosing any production issue, run `wrangler pages project list` (or equivalent) to confirm the actual deployment domain. Never assume the URL — keel-aba.pages.dev is our prod; keel.pages.dev is a stranger's site.

**Gap 6 → Standing Rule: "Schema-check before claiming edit code is correct"**
> When an edit or update operation is reported as broken, check the DB schema for the target table before asserting the code is correct and asking for a repro. Column mismatches (e.g. a non-existent `updated_at`) are the first thing to rule out, not the last.

**Gap 1 → Standing Rule: "Attribution must be visible on the current user's own entries"**
> When adding or updating the "who added it" display (avatar + name), the current user's own entries must show attribution too. Never hide it as a special case. Test by adding an entry as yourself and confirming it appears.

**Gap 2 → Standing Rule: "Test layout at three breakpoints before declaring done"**
> Any dashboard or list UI must be tested at mobile (375px), tablet (768px), and desktop (1280px) before the task is closed. A layout that works only on one breakpoint is not done.

*Gaps 3, 4, and 5 also qualify by age but are better handled as tasks (Gap 3: replace selects; Gap 4: redesign landing; Gap 5: improve Notion query) rather than standing rules.*

---

### Suggested next actions

1. **Promote Gaps 6 and 7 to CLAUDE.md this week.** They encode the two most costly failure modes (over-claiming correctness, diagnosing the wrong URL) and have been open 40 days. Add them as Standing Rules under a "Diagnosis hygiene" heading. Mark both as `Promoted to CLAUDE.md` in GAPS.md.

2. **Open a single task for the UI Polish pattern (Gaps 2, 3, 4).** These three gaps share a root cause — no systematic cross-breakpoint or aesthetic review before shipping. Create one task: "Responsive + premium UI audit" and reference gaps 2, 3, 4. Close them together when the audit passes.

3. **Decide: discard or promote Gap 1 (attribution) and Gap 5 (Notion).** Gap 1 is specific enough to become a Standing Rule (see above). Gap 5 may be better closed by improving the Notion MCP query once and calling it done. Either way, both have been open 41 days and need a disposition.
