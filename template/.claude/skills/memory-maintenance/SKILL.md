---
name: memory-maintenance
description: "Periodic memory-system audit and repair — runs the linters, sweeps for staleness, prunes rot, and rebalances the router. Run monthly or when memory feels off."
argument-hint: "[optional focus: 'router' | 'vault' | 'staleness' | a KB name]"
---

# Memory Maintenance

**Focus:** $ARGUMENTS (default: full sweep)

Work through the phases; fix as you go; report what changed at the end.
Full rationale: Hyphasma's MAINTENANCE doc
(https://github.com/geektechniquestudios/hyphasma/blob/main/docs/MAINTENANCE.md).

## Phase 1 — Lint

```bash
node scripts/vault-check.mjs
bash scripts/validate-memory.sh
```

Fix every error: broken links (repair or bridge-note), orphans (route or
delete), duplicate titles (rename ONE + fix inbound links), dead router rows,
missing frontmatter, budget overflow (compress/promote — never just delete
the newest rules).

## Phase 2 — Staleness sweep

For topic files with `last_validated` older than ~60 days: re-verify each
claim against code and reality. True → refresh the date. False → fix or
delete (a wrong memory is worse than none — it's retrieved with confidence).
Unverifiable → mark it as unverified in place or demote to an open question
in the relevant vault doc.

## Phase 3 — Router rebalance

Read the router top to bottom:

- Rows that plausibly never fire → compress, merge, or demote to
  `00-Index.md` only.
- Lessons that keep being relearned (check recent session archives for
  repeated failures) → promote toward the top; sharpen trigger wording to
  match the vocabulary of the moment of failure.
- Prose creeping in → move to topic files/vault; the router stays a table.
- Confirm budget headroom (aim ≤90% of `memoryBudget`).

## Phase 4 — Vault graph health

- Orphan clusters or hub-less docs → wire into hubs or merge.
- Topic files >150 lines → promote deep content to the vault, keep pointer.
- Meta-analysis lookup tables: add rows for questions that recent sessions
  actually asked (session archives are the query log).
- KBs that have drifted apart or grown together → propose split/merge to the
  human; don't restructure unilaterally (renames break links).

## Phase 5 — Report

Summarize: what was fixed, deleted, promoted; linter status (must end
green); and the 1-3 structural suggestions that need a human decision.
