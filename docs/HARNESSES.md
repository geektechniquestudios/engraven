# Harness Notes

> The vault layer is harness-agnostic — plain markdown in git that any agent
> can read. The **router** layer is per-harness: each agent runtime has its
> own way of auto-loading a small index at session start. This doc maps
> Engram onto the harnesses we know about.

---

## Claude Code (first-class)

Claude Code has a documented, first-class memory substrate that Engram rides
directly:

| Mechanism             | What Engram does with it                                        |
|-----------------------|------------------------------------------------------------------|
| **Auto-memory dir** (`~/.claude/projects/<encoded-path>/memory/`) | the router (`MEMORY.md`) + topic files live here |
| **200-line auto-load** of `MEMORY.md`                             | treated as a hard budget; linted            |
| **`#` quick-add**     | fast capture; the maintenance habit files it properly later      |
| **`/memory`**         | inspect/edit what the harness is treating as memory              |
| **`CLAUDE.md`**       | gets the Engram protocol block (lookup-first, what-goes-where)   |
| **`.claude/rules/*.md`** with `paths:` frontmatter                 | path-scoped guardrails                      |
| **`.claude/skills/`** | `archive-session`, `new-kb`, `memory-maintenance` install here   |

Notes:

- The encoded project directory name differs per machine and OS. Tooling
  discovers it (glob `~/.claude/projects/*<project>*/memory`, shortest match
  wins — worktree encodings strictly extend the main one) rather than
  hardcoding it. `validate-memory.sh` implements this; override with
  `--memory-dir` or `ENGRAM_MEMORY_DIR`.
- The harness may auto-save its own memories into the same directory with the
  minimal frontmatter (`name`, `description`, `metadata.type`). The linter
  hard-requires only those three fields, so harness-written files are never
  flagged; `keywords`, `last_validated`, `vault_refs` are recommended
  enrichment for hand-curated files.

## Codex / anything that reads AGENTS.md

Most non-Claude coding agents load `AGENTS.md` from the repo root. Engram's
bootstrap appends the [AGENTS-SECTION](../template/AGENTS-SECTION.md) block,
which embeds:

1. the lookup protocol (scan router → read on match → explore only if no row
   covers it),
2. a compact router table pointing into the vault, and
3. the write-protocol (what goes where).

Because `AGENTS.md` is repo-shared, this router is shared too — it can't hold
machine-local notes, so per-machine topic files are a Claude-Code-only luxury;
other harnesses put everything in the vault.

## Cursor and rules-file harnesses

Add a always-on rule (e.g. `.cursor/rules/engram.mdc`) containing the same
lookup-protocol block and a pointer to `docs/vault/00-Index.md`. Path-scoped
rules map naturally onto Cursor's glob-scoped rules.

## Any agent that can read files

The minimum viable integration is two sentences in whatever instruction
surface the harness has:

> Before acting, read `docs/vault/00-Index.md` and follow its task table to
> the relevant docs. After significant work, record decisions per
> `docs/vault/Session-Archive/Session Archive Index.md`.

Slower than a real router (one extra read per session) but fully functional —
the vault does the heavy lifting.

## Multi-harness teams

- The vault is the shared brain; keep anything cross-agent there, never only
  in one harness's local memory.
- Each harness gets its own thin router; routers point, they don't hold.
- Session archives from different agents/machines merge in git — that's the
  cross-agent episodic memory working as designed.
