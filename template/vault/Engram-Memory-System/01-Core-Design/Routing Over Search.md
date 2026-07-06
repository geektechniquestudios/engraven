---
tags: [engram, memory, retrieval]
date: {{DATE}}
---

# Routing Over Search

> Hub: [[Core Design - Section Hub]]

**The answer:** retrieval here is deterministic routing, not semantic
search. Trigger-table rows map *situations* to *documents*; agents scan the
rows at session start and read targets on match. No embeddings, no vector
store, no index server — just tables an agent reads with attention.

## The trigger-table row

```markdown
| Encounter...                          | Read                    |
| ------------------------------------- | ----------------------- |
| Payment webhook failing; retry storm  | [[Dunning and Retries]] |
```

Rows are written in the vocabulary of the **moment of need** — the words an
agent would think while stuck, not the doc's title. That wording is the
entire retrieval mechanism: a row that says "billing edge cases" fires
never; one that says "payment failed twice, customer emailed" fires exactly
when it should.

## Three-tier navigation

Above ~30 docs, flat listings stop working. Every KB here is navigable in
three hops:

1. **Meta-analysis** — the KB's entry point: executive summary, trust
   boundary, and a question-keyed lookup table.
2. **Section hub** — a cluster of 3-10 docs with substantive descriptions
   and a reading order.
3. **Doc** — the content, leading with the answer.

The quality bar: any question the KB should answer is reachable from
[[00-Index]] in ≤3 hops. If it isn't, fix the tables, not the agent.

## Why not vector search?

Nothing here forbids adding it later — but routing comes first because it is:

- **reviewable** — a bad row is visible in a PR diff; a bad embedding isn't,
- **debuggable** — a retrieval miss traces to a specific missing/badly-worded
  row, which you then fix permanently,
- **versioned** — routing changes travel with the code they describe,
- **free** — no infrastructure, no drift between index and files.

Routing's real cost is write-time discipline: every doc needs a row or link
that will fire. That cost is the system working as designed — see
[[What Goes Where]].

Related: [[Two-Speed Memory]] · [[Memory Hygiene and Verification]]
