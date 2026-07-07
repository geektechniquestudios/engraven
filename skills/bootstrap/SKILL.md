---
description: Install an Hyphasma memory system into the current project through a guided, interview-driven bootstrap. Use when the user asks to set up Hyphasma, add agent memory, or bootstrap a knowledge vault.
disable-model-invocation: true
---

# Hyphasma bootstrap

You are installing Hyphasma into the human's project. The full Hyphasma
repository is already on disk at `${CLAUDE_PLUGIN_ROOT}` (the installed
plugin), so there is nothing to clone.

1. Read `${CLAUDE_PLUGIN_ROOT}/BOOTSTRAP.md` and follow it phase by phase,
   in order. Wherever it refers to the Hyphasma clone (`$HYPHASMA`), use
   `${CLAUDE_PLUGIN_ROOT}`. The human's project (`$TARGET`) is the current
   working directory unless they say otherwise.
2. Honor the runbook's non-negotiables: interview at every `ASK THE HUMAN`
   block, never overwrite existing files, explain each phase in plain
   language, and finish only when both linters pass.
3. The template skeleton to copy from is `${CLAUDE_PLUGIN_ROOT}/template/`.
   The linters are `${CLAUDE_PLUGIN_ROOT}/scripts/vault-check.mjs` (Node 18+,
   no dependencies) and `${CLAUDE_PLUGIN_ROOT}/scripts/validate-memory.sh`
   (bash). The install copies both into the project so CI and future
   sessions do not depend on this plugin being present.
