## GAPS.md weekly review — 2026-09-13

> **⚠ Escalation notice:** The 2026-09-06 review identified the same stale gaps, the same two patterns, and the same three promotion candidates. No gaps have been closed, promoted, or discarded since then. This review repeats those findings at higher urgency.

---

### Stale open gaps (>7 days)

All 7 open gaps are stale. The oldest are now **83 days old**.

| # | Date | Age (days) | Summary |
|---|------|-----------|---------|
| 1 | 2026-06-22 | 83 | Attribution hidden on own entries after UI change |
| 2 | 2026-06-22 | 83 | Dashboard layout broke on laptop/iPad (2-column grid with manual row placement) |
| 3 | 2026-06-22 | 83 | Native OS dropdown chrome used instead of hand-built selects |
| 4 | 2026-06-22 | 83 | Landing page rendered as wall of text instead of visual/attention-grabbing layout |
| 5 | 2026-06-22 | 83 | Notion search returned incomplete results, missed Critical items |
| 6 | 2026-06-23 | 82 | Edit entry broke due to non-existent `updated_at` column; Claude over-claimed correctness |
| 7 | 2026-06-24 | 81 | Diagnosed wrong deploy URL (keel.pages.dev) for 1 full session; real URL (keel-aba.pages.dev) was fine |

None of these has moved in disposition. The gap tracker is accumulating debt, not resolving it.

---

### Patterns found

**Pattern 1 — UI & Visual Quality** (Gaps 2, 3, 4)
Responsive layout, custom select chrome, and landing-page visual hierarchy all failed in the same direction: technically functional output that violated the premium-feel bar. Three gaps, same root cause, still open after 83 days.

**Pattern 2 — Verification & Diagnosis** (Gaps 5, 6, 7)
Three separate sessions where Claude treated an assumption as ground truth without a cheap verification step: a search that silently hid items, a mutation against a column that didn't exist, and a full-session diagnosis of the wrong URL. These burned real time and delayed real fixes.

Both patterns were named in the previous review. They persist because no rule was written. The patterns will keep recurring until a Standing Rule closes the loop.

---

### Promotion candidates

All 7 gaps are 14+ days old. The three below touch core mechanics and have now missed two consecutive promotion windows.

**Gap 6 → forgiveness mechanic (correct, painless editing of entries)**
Suggested Standing Rule:
> **Schema-before-write:** Before claiming any data mutation (insert, update, delete) is correct, verify the schema includes every column being written. Run `PRAGMA table_info(<table>)` or equivalent and read the output. Do not ask for a repro; locate the column mismatch yourself first.

**Gap 7 → deployment / Harbour (production verification)**
Suggested Standing Rule:
> **Confirm-the-URL:** Before diagnosing any production issue, run `wrangler pages project list` to confirm the actual deployed project name and URL. Never assume any `*.pages.dev` subdomain belongs to this project; treat the real URL as unknown until verified.

**Gap 1 → Harbour mechanic (social attribution, who added what)**
Suggested Standing Rule:
> **Preserve-existing-features:** When modifying a component that owns a visible feature (attribution, avatar, timestamp), confirm every existing feature still renders after the change. Treat unmentioned features as required to survive. Do not interpret a UI task as permission to remove them.

---

### Suggested next actions

These are the same three actions recommended last week. They are now overdue.

1. **Promote Gaps 6, 7, and 1 to CLAUDE.md today.** Write the three Standing Rules above into CLAUDE.md verbatim. Each rule is already drafted — this is a copy-paste, not a design decision. The verification rules (Gaps 6 and 7) are highest leverage: they burned full sessions and will burn more until they are written down.

2. **Decide on Gaps 2, 3, and 4 in one session.** Schedule a single UI Quality pass: fix the responsive grid, swap native selects for custom components, rebuild the landing hero. Or formally discard these gaps if the work has been done outside this tracker. Either outcome closes three rows.

3. **Close or discard Gap 5 (Notion search).** Define the correct query parameters for surfacing Critical/P0 items with status and severity visible, add it as a standing procedure, and mark the gap Promoted or Discarded. If Notion search is no longer part of the workflow, discard it now.
