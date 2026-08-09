## GAPS.md weekly review — 2026-08-09

### Stale open gaps (>7 days)

All 7 open gaps are stale. The oldest are 48 days old with no disposition change.

| # | Date | Age (days) | Summary |
|---|------|------------|---------|
| 1 | 2026-06-22 | 48 | Attribution hidden on own entries after "who added it" UI work |
| 2 | 2026-06-22 | 48 | Dashboard layout broke on desktop/tablet (2-col grid with manual row placement) |
| 3 | 2026-06-22 | 48 | Native OS dropdown chrome used instead of custom-built selects |
| 4 | 2026-06-22 | 48 | Landing page produced as wall of text instead of visual/attention-grabbing |
| 5 | 2026-06-22 | 48 | Notion 25-row search missed several Critical/P0 items |
| 6 | 2026-06-23 | 47 | Edit entry over-claimed correct; `updateTransaction` wrote non-existent `updated_at` column |
| 7 | 2026-06-24 | 46 | Diagnosed "dead prod" against `keel.pages.dev` (stranger's site); real URL is `keel-aba.pages.dev` |

---

### Patterns found

**Pattern A — UI/visual quality (Gaps 2, 3, 4)**
Three gaps all stem from the same failure: Claude shipped a visually degraded result without checking it against the premium-feel bar. Gap 2 (broken responsive layout), Gap 3 (native OS dropdown chrome), and Gap 4 (wall-of-text landing) are all the same underlying miss — output was functionally correct but aesthetically wrong and not verified at multiple breakpoints or in dark mode.

**Pattern B — Verification failures / over-claiming (Gaps 5, 6, 7)**
Three gaps where Claude declared something correct or complete without doing the check that would have revealed otherwise. Gap 5 (Notion search cap silently hiding Critical items), Gap 6 (column name wrong, claimed correct), and Gap 7 (diagnosed a stranger's site as our prod) all share the same shape: confident assertion, no ground-truth verification step.

Gap 1 (attribution) is a singleton — feature regression from the same edit that was supposed to add the feature.

---

### Promotion candidates

All gaps are 14+ days old. The candidates that touch core mechanics:

**Gap 6 → Standing Rule: "Verify schema before claiming edit code is correct"**
> Before asserting that an update/edit operation is correct, run a schema introspection or check the migration files for the exact column names on the target table. Never rely on memory of the schema.

This touches the forgiveness mechanic directly — editing and correcting entries is the primary way users stay honest with their records. A broken edit path silently undermines the core promise.

**Gap 7 → Standing Rule: "Resolve the real project URL before any prod diagnosis"**
> Before diagnosing a production issue, run `wrangler pages project list` (or equivalent) to confirm the canonical deployment URL. Never assume a domain. `keel-aba.pages.dev` is the real prod; `keel.pages.dev` is not this project.

This burned an entire session. The rule is cheap to follow and the failure is expensive to repeat.

**Gap 5 → Standing Rule: "Never treat a Notion search result as a complete set"**
> Notion search returns at most 25 rows and omits status/severity metadata by default. For any query that must be exhaustive (Critical items, P0/P1 backlog), paginate explicitly or filter by database view — do not infer completeness from a short result list.

**Gap 2+3+4 (Pattern A) → Standing Rule: "Ship UI only after verifying at mobile, tablet, and desktop in both modes"**
> Every UI change must be checked at all three breakpoints and in both light and dark mode before it is declared done. Custom components (selects, cards, grids) must not fall back to native OS chrome.

---

### Suggested next actions

1. **Promote Gaps 6 and 7 to CLAUDE.md this week.** Both are high-confidence, cheap-to-state rules with no design ambiguity. The wording above is ready to copy in. Mark them `Promoted to CLAUDE.md` in GAPS.md.

2. **Close out Pattern A (Gaps 2, 3, 4) with a single UI audit pass.** Run one session that specifically checks the dashboard, all select elements, and the landing page at tablet and desktop in dark mode. Close all three gaps or promote the responsive-UI rule to CLAUDE.md if breakage recurs.

3. **Discard or resolve Gap 1 (attribution).** If the "who added it" UI is now correct, mark it Discarded with a one-line note. If it still regresses, it has been open long enough to become a standing rule about never hiding a feature while adding a related one.
