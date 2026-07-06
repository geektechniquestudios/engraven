---
tags: [engraven, memory, session-archive, operations]
date: {{DATE}}
---

# Session Archiving

> Hub: [[Operations - Section Hub]]

**The answer:** before ending any session with real decisions, changes, or
failures, run the `archive-session` skill. It writes a structured episode to
`Session-Archive/YYYY-MM-DD-slug.md` and registers it in
[[Session Archive Index]].

## Why episodic memory earns its keep

Code review preserves *what* changed. Archives preserve **why** — the
alternatives rejected, the failure that motivated the fix, the thread left
open. Six months later, "why does this work this way?" has an answer with a
date, a branch, and an author on it. Across parallel branches and multiple
agents, git merges the archives into one shared history — cross-agent
episodic memory with no extra infrastructure.

## What a good entry contains

- **Context** — starting state and goal, 2-3 sentences
- **Key decisions** — with alternatives considered and why the winner won
- **Failures & recoveries** — the highest-value section; it's what saves the
  next agent from repeating the mistake
- **Insights & patterns** — reusable knowledge (also promote to topic
  files/vault docs if operational — the archive records, it doesn't route)
- **Open threads** — what was deferred, so it isn't silently dropped

80-200 lines. No transcripts, no tool dumps, no >10-line code blocks — link
instead.

## Rules

- Archives are **append-only history**: one file per session; never edit a
  committed entry (create a new one with an `-HHMM` suffix if the slug
  collides).
- Trivial sessions don't get archived — an archive of nothing is noise.
- Checkpoints: before PRs, before context compaction, at session end.

Related: [[What Goes Where]] (archive vs. topic file vs. vault doc) · [[Memory Hygiene and Verification]]
