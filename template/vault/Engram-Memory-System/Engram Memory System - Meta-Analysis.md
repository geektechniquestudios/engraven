---
tags: [engram, memory, knowledge-management, meta-analysis]
date: {{DATE}}
---

# Engram Memory System - Meta-Analysis

> Index hub: [[00-Index]]

> How this project's memory system works: the four surfaces, the routing
> model, and the hygiene that keeps it trustworthy.
> **8 documents | 5 topical docs + 2 section hubs + this meta-analysis | 2 sections**

This KB is self-referential by design: it documents the memory system it
lives inside, and doubles as the worked example of every structure it
describes — this file is a Tier-1 meta-analysis; the section hubs below it
are Tier 2; the docs are Tier 3. When you build this project's own KBs, copy
these shapes.

## Executive Summary

1. **Memory is a retrieval problem, not a storage problem.** Agents fail
   when the right knowledge doesn't surface at the right moment, not when
   knowledge doesn't exist. Everything here optimizes the moment of
   retrieval. See [[Routing Over Search]].
2. **Two speeds, never blurred.** A thin router is loaded every session; the
   deep vault is loaded only on a routed match. Collapsing the two produces
   either bloat or loss. See [[Two-Speed Memory]].
3. **Every fact has exactly one home.** Duplicated rules drift; drifted
   rules are worse than none. The decision table in [[What Goes Where]] is
   the most-used doc in this KB.
4. **Unverified memory rots.** Links break, indexes drift, facts go stale —
   silently. The linters make rot loud. See [[Memory Hygiene and Verification]].
5. **History is memory too.** Session archives capture the *why* behind
   changes; six months later they're the only witness. See [[Session Archiving]].

## Trust Boundary

This KB is authoritative for **how this project's memory system is
structured and operated**: surfaces, routing, file contracts, verification,
archiving.

It is **not** authoritative for this project's domain or architecture (see
the project KBs registered in [[00-Index]]), nor for the upstream Engram
design rationale (see the [Engram spec](https://github.com/geektechniquestudios/engram/blob/main/docs/SPEC.md),
of which this KB is the operational digest).

## How to Use This KB

| If you are asking...                              | Start here                          | Then follow with                       |
| -------------------------------------------------- | ----------------------------------- | --------------------------------------- |
| Where does this new piece of knowledge belong?     | [[What Goes Where]]                 | [[Two-Speed Memory]]                    |
| Why is the router so small / can I add more to it? | [[Two-Speed Memory]]                | [[Routing Over Search]]                 |
| How do agents find docs without search?            | [[Routing Over Search]]             | [[What Goes Where]]                     |
| The linter is red — what now?                      | [[Memory Hygiene and Verification]] | [[Session Archiving]]                   |
| What did we decide last month, and why?            | [[Session Archiving]]               | [[Session Archive Index]]               |

## Topic Map

### 01 — Core Design (3 documents)

The architecture: two-speed loading, deterministic routing, and the
what-goes-where contract.
→ [[Core Design - Section Hub]]

| Document               | Focus                                                        |
| ---------------------- | ------------------------------------------------------------ |
| [[Two-Speed Memory]]   | The thin-router / deep-vault split and its token economics   |
| [[Routing Over Search]]| Trigger tables and three-tier navigation vs. semantic search |
| [[What Goes Where]]    | The decision table for filing any new piece of knowledge     |

### 02 — Operations (2 documents)

Keeping it alive: verification, anti-entropy, and episodic capture.
→ [[Operations - Section Hub]]

| Document                            | Focus                                                  |
| ----------------------------------- | ------------------------------------------------------ |
| [[Memory Hygiene and Verification]] | The linters, the failure modes they catch, write-time habits |
| [[Session Archiving]]               | Temporal memory: what to capture per session, and why  |

---

_Last updated: {{DATE}}_
