---
tags: [index, knowledge-base, navigation]
date: {{DATE}}
---

# {{PROJECT_NAME}} Knowledge Base

> Master index for this project's vault. Start here to find the right
> document. Rows are task-keyed: find what you're trying to do, read the
> entry doc, follow its links.

## Quick lookup — what are you trying to do?

| Task                                            | Start with                                                    |
| ----------------------------------------------- | ------------------------------------------------------------- |
| **Understand this codebase**                    |                                                               |
| <!-- bootstrap: Architecture KB rows go here --> |                                                              |
| **Ways of working**                             |                                                               |
| <!-- bootstrap: Decisions KB rows go here -->   |                                                               |
| **The memory system itself**                    |                                                               |
| Understand how this vault + memory works        | [[Engram Memory System - Meta-Analysis]]                      |
| Decide where a new piece of knowledge belongs   | [[What Goes Where]]                                           |
| Fix a red memory linter / broken links          | [[Memory Hygiene and Verification]]                           |
| See what happened in recent sessions            | [[Session Archive Index]]                                     |
| Archive the current session                     | run the `archive-session` skill                               |
| Create a new knowledge base                     | run the `new-kb` skill, guided by [[Routing Over Search]]     |

No matching row → check [[Research Library]] for research KBs, then explore.

## Vault conventions

- Every KB: meta-analysis (entry) → section hubs → docs. Enter through the
  meta-analysis; its lookup table routes you.
- Trust hierarchy: repo-grounded docs > meta-analyses/hubs > research KBs.
  High-stakes decisions get verified against live code, not just the vault.
- After editing anything here: `node scripts/vault-check.mjs`.

---

_Maintained by the agents that work in this repo. Structure: [Engram](https://github.com/geektechniquestudios/engram)._
