## GAPS.md weekly review — 2026-11-22

### Stale open gaps (>7 days)
None — all 7 logged gaps have been resolved (Promoted to CLAUDE.md or Discarded). No open items remain.

### Patterns found
No patterns yet — there are no open gaps to group. For reference, the resolved gaps touched these themes:
- **UI/visual quality** (#2, #3, #4 — all Discarded): dashboard grid breakage, native select chrome, weak landing page
- **Correctness / diagnosis** (#6 — Promoted): over-claiming correctness before verifying
- **Deploy / environment** (#7 — Promoted): checking the wrong production URL
- **Tooling accuracy** (#5 — Promoted): search results missing critical Notion items
- **Feature preservation** (#1 — Promoted): hiding attribution on own entries

No theme reached 3+ open gaps, so no active pattern is flagged.

### Promotion candidates
None — no gap has been open for 14+ days. All promotion-worthy items have already been promoted.

### Suggested next actions
1. **Keep logging.** GAPS.md is clean but short; the value comes from consistent capture. Flag the next mismatch as soon as it happens rather than waiting.
2. **Audit CLAUDE.md standing rules.** Four gaps were promoted (#1, #5, #6, #7). Verify each one is reflected as a standing rule that Claude actually follows, and that the rules are still current with the codebase.
3. **Add a "Discarded — why" column (optional).** Gaps #2, #3, #4 were discarded without a reason. A brief note (e.g. "not worth a standing rule", "one-off") would help distinguish intentional discards from items that slipped through.
