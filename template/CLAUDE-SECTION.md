<!-- ══════════════════════════════════════════════════════════════════
     ENGRAM MEMORY PROTOCOL — appended to CLAUDE.md by the Engram bootstrap
     https://github.com/geektechniquestudios/engram
     ══════════════════════════════════════════════════════════════════ -->

## Memory System (Engram)

This project runs an Engram memory system. **Long-term knowledge base:**
`{{VAULT_DIR}}/` — start from `00-Index.md` for task routing. Navigate KBs
using the **three-tier pattern**: meta-analysis (entry/decision router) →
section hub (thematic cluster) → individual doc (deep content). Read the
relevant vault doc *before* making architectural decisions or repeating a
past investigation.

**Trust hierarchy:** repo-grounded docs > meta-analysis hubs > research KBs.
When a decision affects production, money, or users, verify against
source-of-truth docs AND live code — the vault routes you there; it is not
itself the final authority.

### Lookup first

Your auto-memory `MEMORY.md` is a routing index. At task start, scan it; on
a row match, `Read` the target file before acting. Explore only when no row
covers the situation.

### Write after significant work

- **New gotcha or repeated lesson** → topic file (typed frontmatter:
  `name`, `description`, `metadata.type`) + a one-line router row. Same
  sitting, not "later".
- **Correction from the human** → `feedback_*` topic file with **Why:** and
  **How to apply:** lines.
- **Decision, architecture, deep reference** → vault doc, cross-linked to
  its hub; router carries only a pointer.
- **Topic that deserves a full KB** → run `/research <topic>`: gather →
  three-tier KB → cross-synthesize with existing KBs → decision guidance.
- **Session with real decisions/changes/failures** → run `/archive-session`
  before stopping (also before PRs and before context compaction).
- **One home per fact.** Never restate a rule in a second surface — point
  at it.

### Verification (non-negotiable)

After any memory or vault change:

```bash
node scripts/vault-check.mjs        # vault: links, orphans, hubs, counts, dup titles
bash scripts/validate-memory.sh     # router: budget, dead rows, contract
```

A red memory check is a failing test: fix it before moving on. Keep
`MEMORY.md` ≤{{MEMORY_BUDGET}} lines — lines past the budget are silently
truncated at session start. Never put secrets or personal data in any memory
surface.

<!-- ══════════════════ end Engram memory protocol ══════════════════ -->
