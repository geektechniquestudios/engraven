---
name: archive-session
description: "Archive the current session to the vault — captures decisions, changes, patterns, and failures as a structured episode for cross-session continuity."
argument-hint: "[optional: descriptive title override]"
---

# Archive Session: Temporal Memory Capture

**Title override:** $ARGUMENTS

## When to run

1. Before context compaction (context getting large)
2. Before opening a PR
3. At session end after significant work
4. On user request

**Skip if** the session was trivial: quick question, no changes, no
discoveries. An archive of nothing is noise.

## Mode: autonomous

Don't ask for confirmation. Analyze, write, validate, continue. 1-2 minutes.

## Step 1 — Extract from the conversation

1. **Title** — a concise slug (e.g. `payments-retry-refactor`); use
   `$ARGUMENTS` if provided
2. **Tags** — 2-4 from the vault's existing taxonomy
3. **Context** — starting state and goal, 2-3 sentences
4. **Key decisions** — each with alternatives considered and why this one won
5. **Changes made** — files created/modified (`git diff --stat` helps)
6. **Insights & patterns** — reusable knowledge; gotchas; surprises
7. **Failures & recoveries** — errors hit, root causes, fixes
8. **Open threads** — unresolved questions, deferred work
9. **Related docs** — vault docs and prior archives this connects to

**Good entries** start with context, capture the WHY, record failures (the
most valuable content — they save future agents from repeating them), link
outward, and stay 80-200 lines. **Bad entries** dump conversation transcripts,
tool output, >10-line code blocks, or facts already in vault docs (link
instead).

## Step 2 — Write the entry

Path: `<vaultDir>/Session-Archive/YYYY-MM-DD-{title-slug}.md`. If that file
already exists and is yours from this same working session (uncommitted),
append to it; if it's committed (a past session's), create a new file with an
`-HHMM` suffix instead — archives are append-only history, one file per
session.

```markdown
---
tags: [session-archive, {topic-tags}]
date: {YYYY-MM-DD}
branch: {current git branch}
agent: {your model name}
---

# Session: {Descriptive Title}

> Archive hub: [[Session Archive Index]]
> Branch: `{branch}` | Agent: {model} | Date: {date}

## Context
## Key Decisions
## Changes Made
## Insights & Patterns
## Failures & Recoveries
## Open Threads
## Related
```

Omit sections with nothing real to say rather than padding them.

## Step 3 — Register and validate

1. Add the entry to the recent-sessions table in
   `Session-Archive/Session Archive Index.md` (newest first; keep the table
   to the most recent ~20 — older entries remain on disk and greppable).
2. If the session produced a reusable lesson that belongs in *operational*
   memory too, file the topic-file + router row now (see the memory
   protocol in CLAUDE.md) — the archive records history; topic files make it
   actionable.
3. Run `node scripts/vault-check.mjs` — the new entry's links must resolve.
