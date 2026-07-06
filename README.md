<div align="center">

# engram

**Give your coding agent a memory that survives the session, and lints like code.**

*An engram is the physical trace a memory leaves in a brain. This one lives in your repo.*

[![CI](https://github.com/geektechniquestudios/engram/actions/workflows/ci.yml/badge.svg)](https://github.com/geektechniquestudios/engram/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-3fb950)](LICENSE)
[![Dependencies: zero](https://img.shields.io/badge/dependencies-zero-a78bfa)](scripts/)
[![Works with](https://img.shields.io/badge/works%20with-Claude%20Code%20·%20Codex%20·%20Cursor-67e8f9)](docs/HARNESSES.md)

<img src="assets/hero.svg" width="880" alt="Animated diagram: a query hits the always-loaded router, a trigger row matches, and the read hops meta-analysis to hub to doc inside the vault. Deterministic retrieval in three hops or fewer.">

No embeddings. No vector database. No index server.<br>
A thin router your agent always sees, a deep vault it reads on demand,<br>
and two linters that treat memory rot like a failing test.

</div>

---

Every coding agent wakes up with amnesia. It re-derives your architecture, re-asks settled questions, repeats corrections you have given it ten times, and re-learns nothing from the session where everything went wrong. Context windows forget; RAG retrieves fragments without structure; "just write a notes file" collapses into a swamp nobody trusts.

Engram is a different shape: **memory as a routed knowledge system**. A 200-line index tells the agent *where* knowledge lives. Deep knowledge lives in wiki-linked knowledge bases in your repo, versioned by git, shared across every machine, branch, and agent. And because unverified memory is worse than no memory, linters gate it all in CI.

## Install by pasting

Open your agent **inside your project** (Claude Code, Codex, Cursor, or anything that can run shell commands and read files) and paste this:

```text
Set up the Engram memory system in this project.

1. Clone https://github.com/geektechniquestudios/engram into a scratch
   directory OUTSIDE this repo (it is only the template source).
2. Read BOOTSTRAP.md in the clone, top to bottom, and follow it exactly.
3. It will have you interview me first. Do that before writing anything.
4. Install into THIS repo, explain each piece as you create it, and do not
   finish until both linters pass and you have given me the cheat sheet.
```

That is the whole install. The agent clones this repo, walks a phased runbook ([`BOOTSTRAP.md`](BOOTSTRAP.md)), interviews you for five minutes about your project, then builds your memory system around your answers: skeleton, instruction wiring, router, and your first two knowledge bases, seeded from what you told it. It explains every piece as it goes and finishes only when the linters are green.

Prefer to see every move before it happens? There is a [manual quick start](#manual-quick-start) below.

## Four surfaces, two speeds

<div align="center">
<img src="assets/layers.svg" width="880" alt="Animated diagram of the four memory surfaces. Instructions and router auto-load at session start for about five thousand tokens. The vault loads only on a routed match. The session archive is rarely-loaded insurance.">
</div>

The core token-economics trick: **what loads every session must stay thin; what is deep must cost nothing until needed.**

| Surface | Where | Loaded | Holds |
|---|---|---|---|
| **1 · Instructions** | `CLAUDE.md` / `AGENTS.md` + path-scoped rules | every session | non-negotiable rules, conventions, commands |
| **2 · Router** | harness memory (`MEMORY.md`, ≤200 lines) | every session | trigger tables: "encounter X → read Y" |
| **3 · Vault** | `docs/vault/` in your repo | on routed match | KBs, meta-analyses, hubs, deep docs |
| **4 · Session archive** | `docs/vault/Session-Archive/` | rarely | episodic history: decisions, failures, the *why* |

The router never *contains* knowledge; it contains **pointers with trigger conditions**. Retrieval is routing, not search: the agent reads a row, follows it, and lands on the answer in at most three hops. Deterministic, debuggable, and versioned like everything else in your repo.

## Inside the vault

<div align="center">
<img src="assets/heatmap.svg" width="880" alt="Animated heatmap of three knowledge bases. Phase one: a routed read heats exactly the docs needed. Phase two: cross-KB synthesis links docs from distant KBs into a new synthesis doc. Phase three: an integrity scanline finds rotted cells and flips them green.">
</div>

Knowledge lives in **knowledge bases** (KBs), each a directory with a three-tier shape:

```
Payments-Domain/
├── Payments Domain - Meta-Analysis.md   ← tier 1: entry point & decision router
├── 01-Billing-Core/
│   ├── Billing Core - Section Hub.md    ← tier 2: thematic cluster, reading order
│   ├── Subscription Lifecycle.md        ← tier 3: deep docs that LEAD with the answer
│   └── Dunning and Retries.md
└── 02-Provider-Integration/
    └── ...
```

- **Meta-analysis** answers "which section do I need?" with a question-keyed *How to use this KB* table.
- **Section hubs** cluster related docs and say what connects them.
- **Docs** open with the answer, then the evidence.

Three tiers is what makes ≤3-hop retrieval possible at any scale: the structure *is* the search algorithm. And because docs are wiki-linked across KBs, the system compounds: a doc joining what the payments KB and the operations KB each half-know becomes a **synthesis doc**, knowledge neither source holds alone. [`docs/KB-GUIDE.md`](docs/KB-GUIDE.md) covers what deserves a KB, the seed KBs every project should start with, and how to grow one without it rotting.

## Memory that lints

Trusting memory is the whole game, and trust needs verification. Engram ships two zero-dependency linters, wired into CI by the bootstrap:

```console
$ node scripts/vault-check.mjs
engram vault-check · 214 docs · docs/vault

3 error(s):
  ✗ broken link: [[Dunning and Retires]] in Payments-Domain/01-Billing-Core/Subscription Lifecycle.md
  ✗ duplicate doc title "Rate Limiting" (ambiguous wiki-links)
  ✗ broken link: [[Deploy Runbook]] in 00-Index.md

2 warning(s):
  ⚠ orphan doc (nothing links to it): Operations/Old Incident Notes.md
  ⚠ KB "Search-Infrastructure" has no "* - Meta-Analysis.md" entry point
```

`vault-check.mjs` catches broken wiki-links, duplicate titles, orphan docs, KBs missing their entry point, stub docs, and unfilled placeholders. `validate-memory.sh` checks the *router* side: line budget, dead pointers (rows referencing deleted files), orphan topic files, and the frontmatter contract. A memory edit that would strand your agent fails your PR, exactly like a broken test. The failure modes these guard against (and the monthly audit habit) are in [`docs/MAINTENANCE.md`](docs/MAINTENANCE.md).

## What lands in your repo

```
your-project/
├── CLAUDE.md / AGENTS.md          ← memory protocol appended (existing content untouched)
├── engram.config.json             ← linter config (vault path, budgets, frontmatter contract)
├── scripts/
│   ├── vault-check.mjs            ← vault linter · Node ≥18, stdlib only
│   └── validate-memory.sh         ← router linter · bash + coreutils
├── docs/vault/
│   ├── 00-Index.md                ← vault entry point: task → doc routing
│   ├── Research Library.md        ← registry of every KB
│   ├── Engram-Memory-System/      ← the system documenting itself (working example KB)
│   ├── <Your-First-KB>/           ← seeded from your interview during bootstrap
│   └── Session-Archive/           ← one entry per significant session
└── .claude/                       ← Claude Code only
    ├── rules/                     ← path-scoped rules (auto-load when files match)
    └── skills/                    ← /archive-session · /new-kb · /memory-maintenance
```

Plus, on the harness side, a `MEMORY.md` router installed into your agent's auto-loaded memory. The vault ships with one real KB: **Engram documenting Engram**, so you always have a live example of every structure, and it graphs beautifully if you open the vault in [Obsidian](https://obsidian.md) (optional; everything is plain markdown).

Day-to-day, the loop is: work normally → agent hits something worth keeping → it writes a doc and a router row → `/archive-session` captures the *why* before the context dies → CI keeps every link honest. Skills ship for all three maintenance motions.

## Manual quick start

```bash
git clone https://github.com/geektechniquestudios/engram
cd your-project

# 1. copy the skeleton
cp -R ../engram/template/vault docs/vault
cp ../engram/template/engram.config.json .
mkdir -p scripts && cp ../engram/scripts/vault-check.mjs ../engram/scripts/validate-memory.sh scripts/

# 2. wire your instruction file
cat ../engram/template/CLAUDE-SECTION.md >> CLAUDE.md     # or AGENTS-SECTION.md >> AGENTS.md

# 3. install the router
#    Claude Code: seed MEMORY.md in your project's auto-memory dir from
#    template/MEMORY.template.md, then fill the {{PLACEHOLDERS}}

# 4. verify
node scripts/vault-check.mjs
bash scripts/validate-memory.sh
```

Then read [`docs/SPEC.md`](docs/SPEC.md) (the full architecture: budgets, contracts, write-paths) and [`docs/KB-GUIDE.md`](docs/KB-GUIDE.md) (building KBs worth routing to). The guided bootstrap does all of this for you, plus the interview and your first two KBs.

## Works with

| Harness | Level | Notes |
|---|---|---|
| **Claude Code** | first-class | auto-memory router, path-scoped rules, skills, `#` quick-add |
| **Codex / Jules / Amp** (AGENTS.md readers) | full | protocol via `AGENTS-SECTION.md`; router embedded in repo |
| **Cursor** | full | protocol via `.cursor/rules` |
| **Anything else** | minimum viable | one instruction block + the vault; see [`docs/HARNESSES.md`](docs/HARNESSES.md) |

The vault and session archive are plain markdown in git, so they are shared across every machine, branch, teammate, and agent for free. Only the thin router is harness-local, and it is rebuildable from the vault.

## FAQ

**Why not embeddings / RAG?**
Retrieval here is *routing*: a human-readable index consulted by the agent's own reasoning. It is deterministic (same trigger, same doc), debuggable (a bad retrieval is a bad row you can edit), versioned (memory changes show up in PR diffs), and it needs zero infrastructure. Attention over a good index beats similarity search over a doc soup at any scale a repo can reach.

**Do I need Obsidian?**
No. Everything is plain markdown with `[[wiki-links]]`. Obsidian gives you a free graph view of your agent's brain, which is genuinely useful for spotting orphaned clusters, but nothing depends on it.

**What does it cost per session?**
Roughly 5k tokens ambient (instructions + router). The vault costs nothing until a row routes into it, and then you pay for exactly the docs the task needed. That is the point of the two-speed design: knowledge grows unbounded while the per-session tax stays flat.

**Does my data go anywhere?**
It is files in your repo. Nothing phones home, nothing is uploaded, there is no service. The linters run on Node and bash stdlib.

**How is this different from just writing a NOTES.md?**
Structure and verification. A flat file has no retrieval story past ~200 lines and no defense against rot. Engram gives knowledge a shape agents can navigate (router → meta-analysis → hub → doc) and linters that fail CI when memory lies.

**Where did this come from?**
Engram is the extracted skeleton of the memory system running a production venture-studio monorepo, where it grew to ~3,800 vault docs across 29 knowledge bases while keeping the always-loaded footprint at ~5k tokens. The patterns here are the ones that survived; [`docs/SPEC.md`](docs/SPEC.md) is the distillation.

---

<div align="center">

MIT © 2026 [Geektechnique Studios](https://github.com/geektechniquestudios) · [Spec](docs/SPEC.md) · [KB Guide](docs/KB-GUIDE.md) · [Maintenance](docs/MAINTENANCE.md) · [Harnesses](docs/HARNESSES.md) · [Contributing](CONTRIBUTING.md)

*Built by agents, for agents, supervised by humans who got tired of repeating themselves.*

</div>
