# The Engraven Specification

> The complete architecture of the Engraven memory system. This is the document
> a coding agent reads to understand *why* the system is shaped the way it is.
> For installation, see [BOOTSTRAP.md](../BOOTSTRAP.md). For creating knowledge
> bases, see [KB-GUIDE.md](KB-GUIDE.md). For upkeep, see [MAINTENANCE.md](MAINTENANCE.md).

---

## 1. The problem

Coding agents wake up amnesiac. Every session starts from zero: the hard-won
lesson from last Tuesday's debugging marathon, the architectural decision your
team argued about for a week, the gotcha that cost three hours — all gone,
unless it happens to be sitting in a file the agent thinks to read.

Two naive fixes fail in opposite directions:

- **Load everything.** Paste your whole wiki into the system prompt. Costs
  explode, attention dilutes, and the model starts ignoring the middle of the
  pile. Context windows are a budget, not a bucket.
- **Store everything, retrieve nothing.** Keep beautiful docs the agent never
  reads, because nothing at session start tells it they exist or when they
  matter.

Engraven's position: **memory is a retrieval problem, not a storage problem.**
The scarce resource is the agent's attention at the moment of decision. The
system's whole job is to put a *tiny, always-loaded routing layer* in front of
a *deep, on-demand knowledge store* — and to keep both from rotting.

---

## 2. Design principles

1. **Routing over search.** A deterministic lookup table ("when you encounter
   X, read doc Y") beats semantic search for operational memory. It is
   reviewable, versionable, debuggable, and free. Vector stores are a later
   optimization, not a foundation.
2. **Two speeds.** A thin router is loaded every session (cheap, always
   present). Deep knowledge is loaded only when the router points at it
   (expensive, rarely needed). Never blur the two.
3. **Plain files, in git.** Markdown, wiki-links, frontmatter. Reviewable in
   PRs, diffable, greppable, mergeable, and readable by any agent or human.
   Open the vault in [Obsidian](https://obsidian.md) and you get a graph view
   of your agent's brain for free.
4. **Verify or rot.** Memory that is not linted decays: links break, indexes
   drift from files, stale facts outlive their truth. Engraven ships a linter
   and treats memory integrity like CI treats tests.
5. **Write-time discipline beats read-time cleverness.** A memory is only as
   retrievable as the moment it was filed. Every write follows a contract:
   typed, described, routed, cross-linked.
6. **One home per fact.** A rule lives in exactly one surface; everything else
   points at it. Duplicated rules drift, and drifted rules are worse than no
   rules.

---

## 3. The four surfaces

Engraven organizes agent memory into four surfaces. Each has a distinct load
behavior, owner, and purpose. Collapsing them into one surface produces either
bloat (everything always loaded) or loss (knowledge trapped in one machine).

| # | Surface          | Lives at                                        | Loaded            | Purpose                                                    |
|---|------------------|--------------------------------------------------|-------------------|------------------------------------------------------------|
| 1 | **Instructions** | `CLAUDE.md` / `AGENTS.md`, `.claude/rules/*.md`  | always / by path  | durable rules that must shape every relevant session       |
| 2 | **Router**       | the agent's memory index (e.g. `MEMORY.md`)      | always (budgeted) | a thin trigger-table index that routes into deep memory    |
| 3 | **Vault**        | `docs/vault/` in the repo                        | on demand         | deep knowledge: KBs, architecture, decisions, runbooks     |
| 4 | **Archive**      | `docs/vault/Session-Archive/`                    | on demand         | temporal memory: what happened, when, and why              |

### Surface 1 — Instructions

The deterministic layer. Project instruction files (`CLAUDE.md` for Claude
Code, `AGENTS.md` for most other agents) are loaded automatically and shape
every session. Path-scoped rule files (`.claude/rules/*.md` with `paths:`
frontmatter) load only when matching files are touched — they are the highest
precision retrieval mechanism available, ideal for "every time anyone touches
the payments module, remember these three things."

Instructions are for rules, not knowledge. If it reads like an essay, it
belongs in the vault with a pointer here.

### Surface 2 — Router

The router is the always-loaded index into everything else. In Claude Code
this is `MEMORY.md` in the project's auto-memory directory
(`~/.claude/projects/<encoded-path>/memory/`), of which **only the first 200
lines are auto-loaded** — Engraven treats that as a hard budget and lints it.
For other harnesses, an equivalent compact router is embedded in `AGENTS.md`
(see [HARNESSES.md](HARNESSES.md)).

The router is a routing table, **never** a knowledge dump. Its power comes
from the trigger-table row:

```markdown
| Encounter...                         | Read                                |
| ------------------------------------ | ----------------------------------- |
| Auth/login bugs; token refresh       | [[Authentication Flow]]             |
| Writing a DB migration               | [[Migration Guide]], [[Schema]]     |
| Flaky test; mock leakage             | `testing.md` (topic file)           |
```

An agent scans these rows at session start; when work matches a row, it reads
the target *before* acting. Retrieval happens by attention, not embeddings.

**Ordering matters (primacy).** Models attend most to the top of loaded
context. The router's layout exploits this:

1. **Lookup protocol** (2-3 lines) — the procedural gate: "row match → read
   that file; explore only if nothing covers it."
2. **Session essentials** — the five-to-ten hard rules that prevent disasters
   (deploy policy, destructive-command gates, project-specific landmines).
3. **Vault router** — encounter-keyed rows pointing into the vault.
4. **Topic file router** — rows pointing at sibling topic files.
5. **Feedback triggers** — behavioral corrections mapped to `feedback_*` files.
6. **Self-maintenance footer** — when and how the agent updates memory.

### Surface 3 — Vault

The deep store: a plain-markdown knowledge base in the repo, navigable by
**three-tier structure** (§5) and cross-linked with `[[WikiLinks]]`. Too large
to load wholesale — valuable precisely because agents load only the right
2-3 docs at the right time. Shared via git across every machine, agent, and
teammate.

### Surface 4 — Archive

Episodic memory. Each significant working session ends with a structured
archive entry — decisions made, alternatives rejected, failures hit, threads
left open — written to `Session-Archive/YYYY-MM-DD-slug.md`. Git merges these
across branches, so parallel agents' histories converge. Six months later,
"why on earth does this work this way?" has an answer with a date on it.

---

## 4. Memory records: the topic-file contract

Between the one-line router row and the deep vault doc sits the **topic
file**: a dense, operational memory record. Topic files live next to the
router (in the harness's memory directory) and follow a typed contract:

```markdown
---
name: testing-gotchas
description: Mock leakage between suites; the reset-vs-clear trap; flaky selector patterns.
metadata:
  type: project        # user | feedback | project | reference
keywords: [tests, mocks, flake]        # recommended
last_validated: 2026-07-06             # recommended — drives staleness lint
vault_refs:                            # recommended — bridges to the vault
  - "Testing Strategy"
---

- `resetAllMocks()` restores original implementations; `clearAllMocks()` only
  clears call history. Suites that stub modules MUST reset, or stubs leak.
- Selector-based E2E waits: prefer role+name queries; text selectors rot.
```

**The four types:**

| Type        | Holds                                                              |
|-------------|--------------------------------------------------------------------|
| `user`      | who the human is — role, preferences, how they like to work        |
| `feedback`  | corrections the human gave, each with **why** and **how to apply** |
| `project`   | ongoing work, goals, constraints not derivable from the code       |
| `reference` | pointers to external resources — dashboards, tickets, URLs         |

**Style rules:** dense bullets over essays; named failure modes; exact
commands. If a topic file grows past ~150 lines, its deep content gets
promoted to a vault doc and the topic file keeps a pointer. Topic files are
*operational cache* — canonical truth lives in repo-shared surfaces.

Every topic file must have a router row, and every router row must point at a
real file. The linter enforces this bidirectionally.

---

## 5. The vault: three-tier navigation

Flat piles of docs don't scale past ~30 files — agents (and humans) stop
finding things. Engraven vaults use a three-tier structure for every knowledge
base (KB):

```
Tier 1  Meta-analysis   one per KB — the entry point and decision router
Tier 2  Section hub     one per thematic cluster of 3-10 docs
Tier 3  Document        the actual deep content
```

**Tier 1 — the meta-analysis** (`<KB Name> - Meta-Analysis.md`) contains:

- an **executive summary**: the 3-5 conclusions that drive everything else
- a **trust boundary**: what this KB is authoritative for, and — critically —
  what it is *not*, with links to where those questions belong
- a **"How to use this KB" table**: question-keyed rows
  (`If you are asking... → Start here → Then follow with`)
- a **topic map**: each section with a one-line description, a `→ [[Section
  Hub]]` link, and a doc table

**Tier 2 — the section hub** groups 3-10 docs into 2-3 named clusters with
substantive descriptions (what question each doc answers, not just its
title), lists **connections to other sections**, and ends with a **reading
order**. Hubs exist so an agent can understand a sub-area without reading
every doc in it.

**Tier 3 — documents** carry frontmatter (`tags`, `date`), lead with the
answer (first screen useful, no throat-clearing), and cross-link related docs
and their hub. Stable titles are load-bearing: agents retrieve by title, and
renames break links — prefer bridge notes over renames.

Above all KBs sit two special files:

- **`00-Index.md`** — the vault's master index: a task-keyed lookup table
  ("what are you trying to do?" → entry doc → follow-ups) spanning every KB.
- **`Research Library.md`** — the registry of research KBs: one row per KB
  with its meta-analysis link, doc count, and focus.

And one special KB: **`Session-Archive/`** (Surface 4), with its own index.

### The trust hierarchy

Not all vault knowledge is equally authoritative. Engraven vaults declare a
hierarchy, and agents are instructed to respect it:

> **repo-grounded docs** (describe *this* codebase — verify against code when
> stakes are high) **>** **meta-analyses/hubs** (synthesis and routing) **>**
> **research KBs** (external patterns — never override current project facts).

When a decision affects money, users, or production, the agent verifies
against source-of-truth docs *and* live code, not just the vault.

---

## 6. What goes where

The single most-used table in the system. When an agent (or human) learns
something worth keeping:

| If the content is...                                        | It goes in                    |
|-------------------------------------------------------------|-------------------------------|
| a rule that must shape most sessions                        | `CLAUDE.md` / `AGENTS.md`     |
| a guardrail specific to certain files                       | `.claude/rules/*.md`          |
| a repeated operational gotcha, compressed                   | a topic file                  |
| a routing pointer into deeper memory                        | the router (one line)         |
| deep explanation, architecture, research, decision rationale| a vault doc                   |
| what happened this session and why                          | a session archive entry       |
| truth other agent families / humans also need               | vault or `AGENTS.md` — never only harness-local memory |

Corollary — the **single-home rule**: when the same fact would help in two
surfaces, one holds the fact, the other holds a pointer.

---

## 7. Verification: memory that lints

Unverified memory rots in predictable ways: the index says a file exists and
it doesn't; a doc is orphaned and nothing routes to it; two files share a
title and wiki-links resolve ambiguously; the router grows past its auto-load
budget and silently truncates — the worst failure, because the agent doesn't
know what it isn't seeing.

Engraven ships two zero-dependency linters:

**`scripts/vault-check.mjs`** — vault integrity:

| Check                    | Catches                                                    |
|--------------------------|------------------------------------------------------------|
| link resolution          | `[[WikiLinks]]` pointing at docs that don't exist          |
| duplicate titles         | two files with the same basename (ambiguous link targets)  |
| orphan docs              | docs nothing links to (unroutable knowledge)               |
| solitary docs            | docs linking to nothing (dead ends in the graph)           |
| hub coverage             | KB docs not reachable from their hub or meta-analysis      |
| missing meta-analysis    | a KB directory with no Tier-1 entry point                  |
| entry-point reachability | KBs no route reaches from `00-Index` / `Research Library`  |
| archive index coverage   | session entries missing from the archive index             |
| count directives         | stale `<!-- count:… -->` doc-counts (`--fix` rewrites them)|
| frontmatter              | docs missing `tags` / `date`                               |
| stub docs                | near-empty files that pollute retrieval                    |

**`scripts/validate-memory.sh`** — router + topic-file integrity:

| Check                | Catches                                                     |
|----------------------|-------------------------------------------------------------|
| auto-load budget     | router exceeding the harness's load limit (default 200)     |
| dead router rows     | rows pointing at topic files that don't exist               |
| orphan topic files   | topic files with no router row (unfindable memory)          |
| frontmatter contract | missing `name` / `description` / `metadata.type`            |
| oversized topics     | topic files past the promotion threshold                    |
| vault_refs           | topic-file vault references that don't resolve              |

Run both after any memory change; wire them into CI (a sample workflow ships
in the template). A red memory check is treated like a red test.

---

## 8. Self-maintenance: the agent tends its own memory

Engraven is designed to be maintained *by the agent*, per written protocol —
that's what the instruction-surface blocks installed by the bootstrap say:

- **Lookup first.** At task start, scan the router; on a row match, read the
  target before acting.
- **Write after significant work.** New gotcha → topic file + router row.
  New decision → vault doc or archive entry. Correction from the human →
  `feedback` memory with why + how-to-apply.
- **Archive sessions** at natural checkpoints (before a PR, before context
  compaction, at session end) via the `archive-session` skill.
- **Lint after writing.** Run both checkers; fix red before moving on.
- **Prune.** Wrong memories get deleted, not accumulated. Stale
  `last_validated` dates get re-verified or removed.

The human's role shrinks to spot-checking diffs — memory changes ride along
in ordinary code review, because it's all just files in git.

---

## 9. Token economics (why the budgets are what they are)

- The router costs its full size **every session**. At ≤200 lines (~2-3k
  tokens) it earns its keep; at 800 lines it becomes the problem it was meant
  to solve. The budget is a forcing function: when the router is full, the
  fix is *better compression or promotion to the vault*, never "load more."
- A vault doc costs tokens **only when routed to**. A 3,000-doc vault costs
  ~0 until the moment one doc is needed — that asymmetry is the entire trick.
- Path-scoped rules cost tokens only when matching files are touched — the
  cheapest precision available. Prefer them for file-local guardrails.
- Session archives are almost never loaded — they're insurance, priced
  accordingly.

---

## 10. Origin

Engraven is the extracted, genericized structure of a production memory system
that runs a real venture-studio codebase — thousands of vault documents,
dozens of KBs, multiple agents across multiple machines, maintained almost
entirely by the agents themselves. The patterns here weren't designed on a
whiteboard; they accreted under load and got linted into shape. Names, counts,
and examples in this repo are fictional; the structure is the real thing.
