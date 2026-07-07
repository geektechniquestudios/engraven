---
tags: [session-archive, index]
date: {{DATE}}
---

# Session Archive Index

> Index hub: [[00-Index]] · Format & rationale: [[Session Archiving]]

Temporal memory for this project: one structured entry per significant
working session — decisions, changes, failures, open threads. Entries are
append-only; git merges them across branches and agents into one history.

## Recent sessions

| Date | Session | Branch | Focus |
| ---- | ------- | ------ | ----- |

<!-- newest first; keep ~20 rows — older entries stay on disk, greppable.
     The archive-session skill maintains this table. The first entry is
     written by the Hyphasma bootstrap when it archives its own installation. -->

## Finding older sessions

Entries are named `YYYY-MM-DD-slug.md` — list the directory or grep it:

```bash
ls docs/vault/Session-Archive/
grep -rl "payments" docs/vault/Session-Archive/
```
