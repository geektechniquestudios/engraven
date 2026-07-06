---
description: Check the health of an Engraven memory system (vault integrity, router freshness, link rot). Use when the user asks whether their agent memory is healthy, why routing feels stale, or wants the vault linted.
---

# Engraven doctor

Diagnose the memory system in the current project without installing
anything.

1. Locate the vault: read `engraven.config.json` at the project root if it
   exists; otherwise try `docs/vault/`. If neither exists, say Engraven is
   not installed here and offer `/engraven:bootstrap`.
2. Run the vault linter with the project's own copy if it has one
   (`scripts/vault-check.mjs`), otherwise fall back to
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/vault-check.mjs --vault <vault-path>`.
3. Run the router linter the same way: prefer the project's
   `scripts/validate-memory.sh`, else
   `bash ${CLAUDE_PLUGIN_ROOT}/scripts/validate-memory.sh`.
4. Report plainly: errors first, then warnings, then what is healthy. For
   each problem, name the fix (most remedies are one edit; see
   `${CLAUDE_PLUGIN_ROOT}/docs/MAINTENANCE.md`). Offer to apply the
   mechanical fixes, including `--fix` for stale count directives, but ask
   before editing.
