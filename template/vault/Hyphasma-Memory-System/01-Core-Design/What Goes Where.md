---
tags: [hyphasma, memory, conventions]
date: {{DATE}}
---

# What Goes Where

> Hub: [[Core Design - Section Hub]]

**The answer:** file every new piece of knowledge by this table, and give it
exactly one home — everything else points.

| The knowledge is...                                          | It goes in                              |
| ------------------------------------------------------------ | ---------------------------------------- |
| a rule that must shape most sessions                         | `CLAUDE.md` / `AGENTS.md`                |
| a guardrail tied to specific files                           | a path-scoped rule (`.claude/rules/`)    |
| a repeated operational gotcha, compressed                    | a topic file + router row                |
| a routing pointer into deeper memory                         | the router — one line, no prose          |
| deep explanation, architecture, decision rationale, research | a vault doc, linked from its hub         |
| what happened this session and why                           | a session archive entry                  |
| truth other agents/humans also need                          | vault or `AGENTS.md` — never only local memory |

## Topic files: the contract

Operational memories (harness-local, next to the router) carry typed
frontmatter:

```markdown
---
name: short-kebab-slug
description: one line — used to decide relevance during recall
metadata:
  type: user | feedback | project | reference
keywords: [optional, recall, aids]
last_validated: YYYY-MM-DD   # optional — drives the staleness sweep
vault_refs: ["Doc Title"]    # optional — bridges to the vault
---
```

- `user` — who the human is, how they like to work
- `feedback` — a correction, **always** with `**Why:**` and
  `**How to apply:**` lines (a correction without a why gets misapplied)
- `project` — ongoing work and constraints not derivable from the code
- `reference` — pointers to external resources

Style: dense bullets, named failure modes, exact commands. Past ~150 lines,
promote deep content to a vault doc and keep the pointer.

## The single-home rule

When a fact would help in two surfaces, one gets the fact, the other gets a
pointer. Restating "for convenience" creates two versions that will drift —
and a drifted rule is worse than a missing one, because it's trusted.

## Litmus tests

- *Would this change how an agent acts in most sessions?* → instructions.
- *Is this only true on this machine / for this person?* → topic file.
- *Will someone ask "why" in six months?* → vault doc or archive entry.
- *Is it a secret or personal data?* → **nowhere in memory.** Point at the
  secret manager instead.

Related: [[Two-Speed Memory]] · [[Session Archiving]]
