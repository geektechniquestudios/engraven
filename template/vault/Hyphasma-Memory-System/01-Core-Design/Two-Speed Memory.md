---
tags: [hyphasma, memory, architecture]
date: {{DATE}}
---

# Two-Speed Memory

> Hub: [[Core Design - Section Hub]]

**The answer:** this project's memory runs at two speeds. A **router** (the
agent's `MEMORY.md` index, ≤200 lines) is auto-loaded into *every* session.
The **vault** (this directory tree) is loaded only when a router row or index
table points at a specific doc. Keep the two strictly separate: the router
holds pointers and hard rules; the vault holds knowledge.

## Why the split exists

The router costs its full size every single session — 200 lines ≈ 2-3k
tokens, paid always. A vault doc costs tokens only in the sessions that
actually need it. That asymmetry means:

- the vault can grow to thousands of docs at ~zero ambient cost,
- while every line added to the router taxes every future session.

So the router has a **hard budget** (default 200 lines — for Claude Code
that's the documented auto-load cutoff; lines past it are silently truncated,
which is the worst failure mode because nothing announces it). The linter
(`bash scripts/validate-memory.sh`) fails on overflow.

## When the router is full

The fix is never "load more":

1. **Compress** — tighten row wording; merge overlapping rows.
2. **Promote** — move deep content to a vault doc; leave a one-line pointer.
3. **Prune** — rows that never fire get demoted to [[00-Index]] only.

## Ordering inside the router (primacy)

Models attend most strongly to the top of loaded context. The router
exploits this: lookup protocol first, then session-essential hard rules,
then routing tables, maintenance notes last. When a rule keeps being
violated despite existing, moving it *up* is often the whole fix.

## The four surfaces (context)

The router and vault are surfaces 2 and 3 of four: (1) instruction files
(`CLAUDE.md`/`AGENTS.md`, path-scoped rules) — always loaded, for rules;
(4) the session archive — episodic history, almost never loaded. Where a
given fact belongs is the subject of [[What Goes Where]].

Related: [[Routing Over Search]] · [[Memory Hygiene and Verification]]
