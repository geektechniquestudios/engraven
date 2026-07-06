---
tags: [engram, memory, verification, operations]
date: {{DATE}}
---

# Memory Hygiene and Verification

> Hub: [[Operations - Section Hub]]

**The answer:** after any memory change, run both linters; treat red like a
failing test.

```bash
node scripts/vault-check.mjs        # vault: links, orphans, hubs, dup titles, frontmatter
bash scripts/validate-memory.sh     # router: budget, dead rows, orphan topics, contract
```

## What rot looks like

| Failure            | Symptom                                                    |
| ------------------ | ----------------------------------------------------------- |
| budget overflow    | router past 200 lines — the tail silently stops loading    |
| index drift        | router rows pointing at renamed/deleted files              |
| broken links       | `[[WikiLinks]]` to docs that no longer exist               |
| ambiguous titles   | two docs share a basename; links resolve unpredictably     |
| orphaned knowledge | docs/topic files nothing routes to — invisible forever     |
| stale facts        | a doc still asserting what *used* to be true               |

The first five are mechanical — the linters catch them. The last one is
caught by habit: whenever you touch a doc while working, verify what you
read, refresh `last_validated`, and fix any lie in passing.

## Write-time habits (most hygiene is free)

- New gotcha → topic file + router row **in the same sitting**.
- Learned a memory is wrong → fix or delete it **now**. A wrong memory is
  worse than none: it's retrieved with confidence.
- Renaming a doc → don't. If you must, leave a bridge note and fix inbound
  links (the linter lists them).
- Never let a secret or personal detail into any memory file — memory is
  plain text that enters model context and (vault) git history.

## The monthly sweep

Run the `memory-maintenance` skill: lint → staleness sweep (`last_validated`
> 60 days → re-verify or delete) → router rebalance (promote violated rules
up; demote rows that never fire) → vault graph health (orphans, hub-less
docs, oversized topic files).

Related: [[Two-Speed Memory]] (the budget) · [[What Goes Where]] (the contracts being enforced)
