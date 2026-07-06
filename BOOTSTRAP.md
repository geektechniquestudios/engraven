# Engraven Bootstrap — Agent Runbook

> **You are a coding agent installing Engraven into a human's project.** Follow
> this runbook phase by phase, in order. It is written for you, not the human.
>
> Non-negotiables:
>
> - **Interview, don't guess.** At every block marked **`ASK THE HUMAN`**,
>   stop and ask — with concrete options where possible. Their answers shape
>   the install.
> - **Never destroy.** Append to existing files, never overwrite them. If
>   something already exists (a vault, a CLAUDE.md, a MEMORY.md), merge into
>   it and say so.
> - **Explain as you go.** After each phase, tell the human in 2-3 plain
>   sentences what you just set up and why it matters. They should finish the
>   install understanding their own memory system.
> - **Finish green.** The install is done when both linters pass and you've
>   delivered the closing cheat sheet — not before.

Before starting, read `docs/SPEC.md` from this repo (skim §§2-7 minimum) so
your explanations are grounded. Keep `docs/KB-GUIDE.md` at hand for Phase 5.

---

## Phase 0 — Preflight

1. Confirm you're inside the human's project (a git repo). If the working
   directory is the *Engraven clone itself*, ask the human for the path to
   their project and operate there. Call the project root `$TARGET` below;
   the Engraven clone `$ENGRAVEN`.
2. Detect the harness you're running in (Claude Code, Codex, Cursor, other).
   You almost certainly know what you are; if genuinely unsure, ask.
3. Detect what already exists in `$TARGET` and report it before touching
   anything: `CLAUDE.md`? `AGENTS.md`? `.claude/` directory? an existing
   docs wiki or vault? For Claude Code: does the auto-memory directory
   already have a `MEMORY.md`?
4. **`ASK THE HUMAN`** — confirm the plan:
   - "I'll install the vault at `docs/vault/` — or do you want a different
     path?" (If they have an existing Obsidian vault or wiki, offer to build
     alongside it rather than inside it.)
   - "Anything you do NOT want me to touch?"

## Phase 1 — The interview (5 minutes, shapes everything)

**`ASK THE HUMAN`** the following, one batch, conversationally — and use
their own words later when writing memory (their vocabulary is what future
routing will match against):

1. **What is this project?** One paragraph: what it does, who it's for,
   roughly how it's built.
2. **What do agents keep getting wrong here?** The recurring corrections —
   these become the first `feedback` memories and session-essential rules.
3. **What decisions come up over and over?** (naming, testing philosophy,
   error handling, deploy rules…) — these seed the Decisions KB.
4. **What knowledge lives only in your head** that you wish an agent knew?
   — these seed vault docs.
5. **Any hard rules that must never be violated?** (never push to main,
   never touch `X`, always run `Y` before commit…) — these go at the top of
   the router as session essentials.
6. **Who works here?** Just them, a team, multiple agents/machines? — this
   decides how much lives in repo-shared surfaces vs. harness-local memory.

## Phase 2 — Install the skeleton

Copy from `$ENGRAVEN/template/` into `$TARGET`:

1. `template/vault/` → `$TARGET/docs/vault/` (or the path chosen in Phase 0).
   This ships with one real KB — **Engraven-Memory-System**, the system
   documenting itself — plus `00-Index.md`, `Research Library.md`, and
   `Session-Archive/`. Keep it: it's the working example of every structure,
   and the human can graph it in Obsidian immediately.
2. `template/engraven.config.json` → `$TARGET/engraven.config.json`. Set
   `vaultDir` to the chosen path and `projectSlug` to the repo directory
   name.
3. `$ENGRAVEN/scripts/vault-check.mjs` and `$ENGRAVEN/scripts/validate-memory.sh`
   → `$TARGET/scripts/`. The target must be self-contained — no runtime
   dependency on the Engraven clone.
4. Claude Code only: `template/.claude/rules/` and `template/.claude/skills/`
   → `$TARGET/.claude/` (merge with any existing contents, never replace).
5. Optionally (**ask**): `template/.github/workflows/engraven-ci.yml` →
   `$TARGET/.github/workflows/` so memory integrity runs in CI.
6. Rewrite the `{{PLACEHOLDER}}` tokens in everything you copied
   (`{{PROJECT_NAME}}`, `{{VAULT_DIR}}`, dates) with real values.

Run `node scripts/vault-check.mjs` in `$TARGET` now — the skeleton must lint
green *before* you add content, so any later red is yours.

## Phase 3 — Wire the instruction surface

1. Take `template/CLAUDE-SECTION.md` (Claude Code) and/or
   `template/AGENTS-SECTION.md` (everything else), fill the placeholders, and
   **append** the block to `$TARGET/CLAUDE.md` / `$TARGET/AGENTS.md` —
   creating the file only if it doesn't exist.
2. Fold in the Phase-1 answers: the hard rules (question 5) go into the
   block's "Session essentials" area, phrased imperatively and specifically.
3. If the human's harness supports path-scoped rules and the interview
   surfaced file-local guardrails ("whenever anyone touches the payments
   code…"), write one or two `.claude/rules/*.md` files with `paths:`
   frontmatter now — smallest useful set, not speculative coverage.

## Phase 4 — Install the router

**Claude Code:** the router lives at
`~/.claude/projects/<encoded-path>/memory/MEMORY.md` (the auto-memory
directory for `$TARGET` — your harness provides it; `validate-memory.sh`
discovers it by glob).

- If no `MEMORY.md` exists: instantiate `template/MEMORY.template.md` there,
  placeholders filled from the interview.
- If one exists: **merge** — add Engraven's section structure around existing
  content; delete nothing you didn't write.

**Other harnesses:** the compact router is part of the `AGENTS-SECTION`
block you already appended in Phase 3 (see `docs/HARNESSES.md`).

Populate from the interview:

- **Session essentials** ← question 5 (hard rules), most dangerous first.
- **Feedback rows** ← question 2 (what agents get wrong): write each as a
  `feedback` topic file (with **why** and **how to apply**) plus a router
  row. Claude Code only — on repo-shared-only harnesses, put these in the
  instruction block instead.
- **Vault router rows** ← one row for the Engraven KB, plus rows for the KBs
  you're about to seed in Phase 5.

Run `bash scripts/validate-memory.sh` — must pass before Phase 5.

## Phase 5 — Seed the first KBs (the payoff)

This is where the system becomes *theirs*. Follow `docs/KB-GUIDE.md` §§3-4
for structure. Seed exactly two KBs plus stubs — resist writing more; a vault
earns growth from real work, not speculation.

1. **Architecture KB.** Explore the codebase yourself (entry points, module
   boundaries, data flow, build/test/deploy pipeline). Draft the outline —
   section names and doc titles.
   **`ASK THE HUMAN`** to review the outline: "Did I carve this at the right
   joints? What did I misunderstand?" Then write it: 4-8 Tier-3 docs, section
   hubs, meta-analysis (executive summary, trust boundary, lookup table).
   Where the interview's question 4 surfaced head-only knowledge, interview
   deeper and write what they say into the relevant docs — attributed facts,
   their vocabulary.
2. **Decisions & Conventions KB.** Built from interview questions 2-3 plus
   what the codebase itself shows (lint config, test layout, naming in situ).
   Smaller: 3-5 docs + one hub + meta-analysis. Every convention gets its
   **why** — a convention without rationale is a superstition.
3. **Register everything:** rows in `00-Index.md` (task-keyed), the Research
   Library if applicable, and the router.
4. Lint: both checkers green.

## Phase 6 — Prove it works

1. **The retrieval test.** Pick a question the vault should now answer (from
   the interview, e.g. "how does auth work here?"). Starting from the router
   alone, follow the rows — router → index/meta-analysis → doc — and show
   the human the hops. If it takes more than 3, fix the routing tables now.
2. **The write test.** Take one real gotcha from the interview, file it end
   to end: topic file (typed frontmatter) → router row → lint green. Narrate
   what you did — this is the write-protocol they'll see you follow forever.
3. **Archive this session.** Use the installed `archive-session` skill to
   write the vault's first Session-Archive entry: the installation itself —
   what was set up, what was decided, open threads (e.g. "Domain KB
   deferred"). The system's first episodic memory is its own birth.

## Phase 7 — Hand over the keys

Print a closing cheat sheet for the human, roughly:

```
Engraven is installed. What you now have:
  docs/vault/           your project's long-term memory (open it in Obsidian!)
  <router>              a ≤200-line index auto-loaded into every session
  scripts/              the integrity checks (CI runs the Rust CLI, these are the fallback)
  .claude/skills/       archive-session · new-kb · research · memory-maintenance

How to use it day to day:
  - Just work. I read the router at session start and route into the vault
    when a row matches; I file new lessons as we learn them.
  - Correct me out loud — corrections become feedback memories with a "why".
  - Say "archive this session" before we stop after significant work.
  - Say "new KB about X" when a subject outgrows single docs.
  - Say "research X" for the full pipeline: gather → KB → cross-synthesis
    with existing KBs → decision guidance.
  - Monthly: say "run memory maintenance".

House rules:
  - Memory changes ride in normal PRs — veto anything wrong in review.
  - Never let secrets or personal data into memory files.
  - If a linter goes red, we fix it like a failing test.
```

Then confirm both linters pass one final time, summarize what was installed
in 3-4 sentences, and — if you changed files in a git repo — offer to commit
the changes as an `engraven-install` commit (let the human decide about
branching/PR per their own workflow).

**Do not** leave the session with red linters, unfilled placeholders, or an
unregistered KB. Done means green, routed, and explained.
