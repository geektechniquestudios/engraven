---
paths:
  - "scripts/validate-memory.sh"
  - "scripts/vault-check.mjs"
  - "hyphasma.config.json"
---

# Memory System Rules

Note: the auto-memory files live outside the repo at
`~/.claude/projects/<encoded-path>/memory/`. These rules trigger when editing
the memory system's repo-side files.

If you are editing `MEMORY.md` (the router):

- Keep it within the auto-load budget (`memoryBudget` in
  `hyphasma.config.json`, default 200 lines) — lines past the budget are
  silently truncated at session start.
- Routing tables stay near the top (primacy: models attend most to the top
  of loaded context). Session essentials above routers, routers above prose.
- Add pointers, not essays. Prefer a new topic file over bloating the router.
- Every topic file needs a router row; every row needs a real file.

If you are editing a topic file:

- Preserve the frontmatter contract — required: `name`, `description`,
  `metadata.type` (`user` | `feedback` | `project` | `reference`);
  recommended: `keywords`, `last_validated`, `vault_refs`.
- Dense bullets over essays; named failure modes; exact commands.
- Past ~150 lines, promote deep content to a vault doc and keep a pointer.
- Feedback files carry **Why:** and **How to apply:** — a correction without
  a why gets misapplied.

After memory changes:

```bash
bash scripts/validate-memory.sh
```
