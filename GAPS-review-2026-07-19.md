# GAPS.md weekly review — 2026-07-19

## Stale open gaps (>7 days)

All 7 open gaps are stale. None has been resolved or discarded.

| # | Date | Days open | Summary |
|---|------|-----------|---------|
| 1 | 2026-06-22 | **27** | Attribution (photo + name) hidden on the current user's own entries after UI change |
| 2 | 2026-06-22 | **27** | Dashboard 2-column grid broke on desktop and tablet |
| 3 | 2026-06-22 | **27** | Native OS dropdown chrome rendered instead of custom selects |
| 4 | 2026-06-22 | **27** | Landing page produced as a wall of text, not visual/attention-grabbing |
| 5 | 2026-06-22 | **27** | Notion critical-item query silently truncated at 25 rows; missed P0/P1 items |
| 6 | 2026-06-23 | **26** | Edit flow declared correct without execution; real schema bug (`updated_at` column) missed |
| 7 | 2026-06-24 | **25** | Session spent diagnosing the wrong prod URL (`keel.pages.dev`); real URL never checked |

---

## Patterns found

### Pattern 1 — UI/Polish (gaps 2, 3, 4) · 3 gaps

The premium-feel bar is being repeatedly undercut before it ever ships: the dashboard breaks responsiveness off-mobile, native OS widget chrome appears instead of custom components, and the landing page defaults to text over visuals. All three share a root cause — no cross-device or visual QA before declaring work done.

### Pattern 2 — Verification shortcuts / over-claiming (gaps 5, 6, 7) · 3 gaps

In three separate incidents Claude either relied on a query that silently returned incomplete results (gap 5), declared code correct without running it (gap 6), or spent a full session diagnosing a system that turned out to be the wrong target altogether (gap 7). The common shape: a claim of correctness or a diagnostic conclusion was reached without first verifying the precondition.

---

## Promotion candidates

Both candidates are 14+ days old and touch a core mechanic.

### Gap 1 → Harbour / attribution mechanic (27 days open)

**Suggested Standing Rule:**

> **Attribution is always visible on every entry.**
> Never suppress the "who added it" display (name + photo) on entries belonging to the currently logged-in user. Attribution must render on all entries regardless of ownership. When adding or modifying any entry UI, verify attribution is visible in both self-authored and other-authored states before shipping.

---

### Gap 6 → Forgiveness mechanic — edit flow (26 days open)

**Suggested Standing Rule:**

> **Verify edits end-to-end against the real schema before declaring them correct.**
> Before claiming that an edit or update code path works, execute the actual flow and inspect every column written against the current database schema. Do not ask for a repro step or attribute the issue to environment until this check has been done and documented.

---

> **Note:** CLAUDE.md does not yet exist in this repository. Promoting these rules requires creating that file first. Suggest creating `CLAUDE.md` with a `## Standing Rules` section and adding both rules there.

---

## Suggested next actions

1. **Close the UI/Polish pattern in one sprint (gaps 2, 3, 4).** Fix the responsive grid, replace all native `<select>` elements with custom components, and rebuild the landing page as visual-first. Treat these as a single deliverable with a shared QA checklist: desktop, tablet, and mobile before marking done.

2. **Create CLAUDE.md and promote gaps 1 and 6 as Standing Rules.** Both have been open 26+ days and represent recurring failure modes on core mechanics. Getting them into a standing rule file stops the repetition.

3. **Resolve the verification pattern (gaps 5, 6, 7) by adding a pre-claim checklist.** For gap 5 specifically, fix the Notion query to return all statuses without a row cap. For gaps 6 and 7, consider adding a `## Before you claim it's working` section to CLAUDE.md: run the code, confirm the target URL, verify the query is complete.
