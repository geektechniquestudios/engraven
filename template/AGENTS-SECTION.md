<!-- ══════════════════════════════════════════════════════════════════
     ENGRAM MEMORY PROTOCOL — appended to AGENTS.md by the Engram bootstrap
     https://github.com/geektechniquestudios/engram
     ══════════════════════════════════════════════════════════════════ -->

## Memory System (Engram)

This project keeps its long-term knowledge in `{{VAULT_DIR}}/` — plain
markdown, wiki-linked, navigable. **Lookup protocol:** scan the router below;
on a match, read the target doc before acting; if no row covers the
situation, start from `{{VAULT_DIR}}/00-Index.md`'s task table. KBs follow a
three-tier structure: meta-analysis (entry point) → section hub → doc.

### Router

| Encounter...                                 | Read                                                      |
| -------------------------------------------- | --------------------------------------------------------- |
| How this memory system works; where facts go | `Engram-Memory-System/Engram Memory System - Meta-Analysis.md` |
| {{ENCOUNTER_1}}                              | `{{ARCHITECTURE_KB_PATH}}`                                |
| {{ENCOUNTER_2}}                              | `{{DECISIONS_KB_PATH}}`                                   |
| What happened in a past session              | `Session-Archive/Session Archive Index.md`                |

### Session essentials

- {{HARD_RULE_1}}
- {{HARD_RULE_2}}

### Write protocol

New durable lesson → the matching vault doc (or a new one, linked from its
hub + `00-Index.md`). Significant session → an entry in
`{{VAULT_DIR}}/Session-Archive/` (see its index for the format). Trust
hierarchy: repo-grounded docs > hubs > research KBs — verify against live
code when stakes are high. After vault changes run
`node scripts/vault-check.mjs`; treat red as a failing test. Never put
secrets or personal data in memory files.

<!-- ══════════════════ end Engram memory protocol ══════════════════ -->
