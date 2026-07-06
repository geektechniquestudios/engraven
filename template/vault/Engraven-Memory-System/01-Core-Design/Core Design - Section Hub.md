---
tags: [engraven, memory, section-hub]
date: {{DATE}}
---

# Core Design - Section Hub

> Section hub for [[Engraven Memory System - Meta-Analysis]] — 4 documents
> covering the architecture: how memory is split across loading speeds, how
> retrieval works without search infrastructure, how to file knowledge, and
> how the vault grows through research and synthesis.

---

## The Split

[[Two-Speed Memory]] explains the system's central asymmetry: a router that
costs tokens every session (so it must stay tiny) in front of a vault that
costs nothing until routed into (so it can grow deep). It covers the
auto-load budget, primacy ordering inside the router, and why "just load
more" is always the wrong fix.

## Finding Things

[[Routing Over Search]] covers the retrieval mechanism itself: trigger-table
rows that map situations to documents, and the three-tier KB structure
(meta-analysis → hub → doc) that makes a large vault navigable in ≤3 hops —
deterministically, with no embeddings or index server.

## Filing Things

[[What Goes Where]] is the write-side contract: the decision table for every
new piece of knowledge, the topic-file frontmatter schema, and the
single-home rule that prevents drift.

## Growing Things

[[The Knowledge Pipeline]] covers how the vault compounds: the `research`
skill produces a KB, cross-synthesis links it into what the vault already
knows, and abstraction rolls the synthesis up into decision guidance with an
expiry condition.

---

## Connections to Other Sections

- **Operations** ([[Operations - Section Hub]]): the structures defined here
  are what [[Memory Hygiene and Verification]] lints — routing only works if
  links resolve and indexes match files.

---

## Reading Guide

**Start here**: [[Two-Speed Memory]] → [[Routing Over Search]] → [[What Goes Where]] → [[The Knowledge Pipeline]]

| Cluster        | Docs                                       |
| -------------- | ------------------------------------------ |
| The Split      | [[Two-Speed Memory]]                       |
| Finding Things | [[Routing Over Search]]                    |
| Filing Things  | [[What Goes Where]]                        |
| Growing Things | [[The Knowledge Pipeline]]                 |
