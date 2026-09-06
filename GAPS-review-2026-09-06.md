## GAPS.md weekly review — 2026-09-06

### Stale open gaps (>7 days)

All 7 open gaps are stale. The oldest are 76 days old (as of 2026-09-06).

| # | Date | Age (days) | Summary |
|---|------|-----------|---------|
| 1 | 2026-06-22 | 76 | Attribution hidden on own entries after UI change |
| 2 | 2026-06-22 | 76 | Dashboard layout broke on laptop/iPad (2-column grid with manual row placement) |
| 3 | 2026-06-22 | 76 | Native OS dropdown chrome used instead of hand-built selects |
| 4 | 2026-06-22 | 76 | Landing page rendered as wall of text instead of visual/attention-grabbing layout |
| 5 | 2026-06-22 | 76 | Notion search returned incomplete results, missed Critical items |
| 6 | 2026-06-23 | 75 | Edit entry broke due to non-existent `updated_at` column; Claude over-claimed correctness |
| 7 | 2026-06-24 | 74 | Diagnosed wrong deploy URL (keel.pages.dev) for 1 full session; real URL (keel-aba.pages.dev) was fine |

---

### Patterns found

**Pattern 1 — UI & Visual Quality** (Gaps 2, 3, 4)
Three separate gaps all stem from the same failure mode: Claude produced technically functional output that violated the product's "premium feel" bar. Responsive layout broke off-mobile, native OS chrome crept into selects, and a visual landing page became a text wall. The unifying issue is that Claude is not holding a consistent visual standard across components and breakpoints.

**Pattern 2 — Verification & Diagnosis** (Gaps 5, 6, 7)
Three gaps where Claude failed to verify the actual state of something before making a claim or taking action. Gap 5: used a search method that silently hid items. Gap 6: claimed a fix was correct without confirming the DB schema. Gap 7: diagnosed the wrong URL as production for an entire session. The common failure is treating an assumption as ground truth without a cheap verification step.

---

### Promotion candidates

All 7 gaps have been open 14+ days. The following touch core mechanics closely enough to warrant a Standing Rule.

**Gap 6 → touches forgiveness mechanic (easy, correct editing of entries)**
Suggested Standing Rule:
> **Schema-before-write:** Before claiming a data mutation (insert, update, delete) is correct, verify the schema includes every column being written. Run `PRAGMA table_info(<table>)` or equivalent and read the output. Do not ask for a repro; find the column mismatch yourself first.

**Gap 7 → touches deployment / production verification**
Suggested Standing Rule:
> **Confirm-the-URL:** Before diagnosing any production issue, run `wrangler pages project list` to confirm the actual deployed project name and URL. Never assume `*.pages.dev` URLs belong to this project; treat the real URL as unknown until verified.

**Gap 1 → touches Harbour mechanic (who added what, social attribution)**
Suggested Standing Rule:
> **Preserve-existing-features:** When modifying a component that owns a visible feature (attribution, avatar, timestamp), confirm every existing feature is still rendered after the change. Do not interpret a UI task as permission to remove unmentioned features.

---

### Suggested next actions

1. **Promote Gaps 6, 7, and 1 to CLAUDE.md** as Standing Rules this week. The verification failures (Gaps 6 and 7) are the highest-leverage: they burned full sessions and delayed real fixes. The schema-before-write rule alone would have closed Gap 6 in minutes.

2. **Open a single UI Quality spike to close Gaps 2, 3, and 4 together.** They share a root cause (no consistent visual standard enforced) and can likely be addressed in one focused session: fix responsive grid, replace native selects with custom components, and rebuild the landing hero section. Group them so they land as one reviewable diff.

3. **Audit the Notion search workflow (Gap 5).** Define the correct query parameters that surface Critical/P0 items with their status and severity visible. Document this as a standing procedure in CLAUDE.md or a project note so it is not rediscovered each session.
