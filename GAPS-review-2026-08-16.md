## GAPS.md weekly review — 2026-08-16

### Stale open gaps (>7 days)

All 7 open gaps are stale. Days open calculated from today (2026-08-16):

| # | Date | Days open | Summary |
|---|------|-----------|---------|
| 1 | 2026-06-22 | **55** | Attribution hidden on own entries after UI change |
| 2 | 2026-06-22 | **55** | Dashboard layout broken on desktop/tablet |
| 3 | 2026-06-22 | **55** | Native OS dropdown chrome used instead of custom selects |
| 4 | 2026-06-22 | **55** | Landing page rendered as wall of text |
| 5 | 2026-06-22 | **55** | Notion search returned truncated results, missed Critical items |
| 6 | 2026-06-23 | **54** | Claimed edit fix correct without finding real `updated_at` bug |
| 7 | 2026-06-24 | **53** | Diagnosed wrong production URL; real URL never checked |

No gaps have moved since the file was last touched. Every row is stuck at Open — this review is the first audit.

---

### Patterns found

**Pattern 1 — UI polish / visual quality** (Gaps 2, 3, 4)

Three gaps share the same root: the premium visual bar was missed because output was only checked on one device/state. Broken responsive grid (Gap 2), native OS form controls (Gap 3), and a text-wall landing page (Gap 4) are all consequences of producing something that looks acceptable at a glance but breaks under real conditions. This cluster will keep recurring unless cross-device and design-system review is part of the done-definition.

**Pattern 2 — Verification failures / over-claiming correctness** (Gaps 5, 6, 7)

Three gaps where Claude asserted something was correct or working without actually verifying the ground truth:
- Notion search taken at face value without accounting for the 25-row cap and missing status filters (Gap 5)
- Edit fix claimed correct by reasoning rather than by tracing the column that didn't exist (Gap 6)
- Production URL assumed instead of checking `wrangler pages project list` (Gap 7)

The common failure mode: confident assertion from incomplete evidence, burning a session or delaying a real fix. This is the most costly pattern in the file.

---

### Promotion candidates

All seven gaps are 53–55 days old, well past the 14-day threshold. The three below touch core workflow mechanics and have the sharpest lesson.

**Gap 6 → Standing Rule: "Verify fixes by tracing the code, not by reasoning"**

> Before declaring a bug fix correct, read the actual code path end-to-end — check column names, query parameters, and data flow in the real source. Never claim correctness from reasoning alone.

**Gap 7 → Standing Rule: "Confirm the real production URL before diagnosing any deployment issue"**

> The real production URL is `keel-aba.pages.dev`. Before diagnosing any worker or deployment problem, run `wrangler pages project list` to confirm the live domain. Never assume a URL is ours without verification.

**Gap 2 → Standing Rule: "Verify all UI changes at mobile, tablet, and desktop before declaring done"**

> Any layout or component change must be confirmed at ≥3 viewport sizes: 375 px (mobile), 768 px (tablet), 1280 px (desktop). A passing mobile view does not imply desktop or tablet correctness.

---

### Suggested next actions

1. **Promote Gaps 6 and 7 to CLAUDE.md this week.** Both encode hard-won verification discipline that will recur on every deploy and every bug fix. Draft rule text is ready above — copy, refine tone, add to Standing Rules.

2. **Bundle Gaps 2, 3, 4 into a single UI-polish sprint.** They share the same root (no cross-device / design-system review gate) and fixing them together is faster than addressing each in isolation. Add a lightweight visual QA checklist (device sizes + custom control audit) to the session workflow.

3. **Triage and close Gap 5.** Decide whether the Notion search limit is a tooling fix (add Status/Severity filters, raise the row cap) or a process fix (screenshot open items before relying on search). Write the conclusion into CLAUDE.md or discard the gap — but don't leave it open a second month.
