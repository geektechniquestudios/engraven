# Building Knowledge Bases

> How to decide what KBs your project needs, and how to build one that agents
> can actually navigate. The `new-kb` skill (installed by the bootstrap)
> automates this workflow; this doc is the reasoning behind it.

---

## 1. First: does this need to be a KB at all?

A KB is the heaviest structure in the vault. Most knowledge is lighter:

| The knowledge is...                                  | Use instead of a KB              |
|------------------------------------------------------|----------------------------------|
| one repeated gotcha or command                       | a **topic file** + router row    |
| one rule tied to specific files                      | a **path-scoped rule**           |
| one subject that fits in a single readable doc       | a **single vault doc**, linked from `00-Index.md` |
| what happened in a work session                      | a **session archive entry**      |

Create a **KB** (meta-analysis + hubs + docs) only when *all three* hold:

1. The subject decomposes into **6+ distinct documents** worth writing.
2. Agents will ask **different questions** of it at different times (so a
   question-keyed entry point pays off).
3. It will stay relevant for **months**, not weeks.

Under that bar, a KB is bureaucracy. Over it, a flat folder is a junk drawer.

---

## 2. The KBs almost every project needs

The bootstrap seeds the first two of these during installation. The rest
emerge as your project accumulates knowledge — don't build them speculatively.

### Architecture KB (seed at install)

*What the system is and why.* The agent explores the codebase and writes it:
system overview, module boundaries, data flow, key invariants, the 5-10
decisions that explain everything else ("why X over Y"). This KB pays for
itself the first time an agent doesn't have to re-derive your architecture
from source.

### Decisions & Conventions KB (seed at install)

*How we do things here, and why.* Coding conventions with rationale, review
standards, the recurring decisions (naming, error handling, testing
philosophy) and their settled answers. Feeds the instruction surface: the
rules live here in full; `CLAUDE.md`/`AGENTS.md` carry the compressed form.

### Domain KB (when your project serves a domain)

*The world your software models.* Billing? Then tax rules, proration
semantics, dunning. Logistics? Then carriers, customs, rate structures.
Agents write better code when the domain's invariants are one routed read
away instead of implicit in the schema.

### Operations / Runbook KB (when you deploy things)

Deploy pipeline, environments, incident playbooks, debugging runbooks, known
failure modes with their signatures and fixes. The KB agents read *during* an
incident — so its docs must lead with the answer.

### Research KBs (as questions recur)

External knowledge synthesized for internal use: a framework's real behavior,
an ecosystem survey, prior art for a feature. Research KBs sit at the bottom
of the trust hierarchy — they inform, but never override, project facts.

---

## 3. Anatomy of a KB

```
docs/vault/Payments-Domain/
├── Payments Domain - Meta-Analysis.md          ← Tier 1: entry point
├── 01-Billing-Models/
│   ├── Billing Models - Section Hub.md         ← Tier 2: cluster guide
│   ├── Subscription Lifecycle.md               ← Tier 3: content
│   ├── Proration Semantics.md
│   └── Trial and Grace Periods.md
└── 02-Failure-Handling/
    ├── Failure Handling - Section Hub.md
    ├── Dunning and Retry Strategy.md
    └── Chargeback Playbook.md
```

Numbered section directories keep reading order visible in file listings.
3-10 docs per section; 2-6 sections per KB. Bigger than that → split the KB.

### The meta-analysis (Tier 1)

The entry point every route lands on first. Required sections:

1. **Header block** — frontmatter (`tags`, `date`), a link up to
   `[[00-Index]]`, and a one-line scope statement with doc counts.
2. **Executive summary** — the 3-5 conclusions that drive everything else.
   Write these as *claims*, not topics: "Proration is the root of most
   billing bugs" teaches; "About proration" doesn't.
3. **Trust boundary** — what this KB is authoritative for, what it is *not*,
   and where those other questions belong (with links). This section is what
   keeps a growing vault from becoming a contradiction engine.
4. **How to use this KB** — the question-keyed table:

   ```markdown
   | If you are asking...                  | Start here                | Then follow with        |
   | ------------------------------------- | ------------------------- | ----------------------- |
   | How do mid-cycle upgrades bill?       | [[Proration Semantics]]   | [[Subscription Lifecycle]] |
   | A payment failed — what happens next? | [[Dunning and Retry Strategy]] | [[Chargeback Playbook]] |
   ```

   Write rows in the words an agent would *actually think while stuck* — the
   table is a retrieval surface, not a table of contents.
5. **Topic map** — one block per section: a 1-2 line description, a
   `→ [[Section Hub]]` link, and a doc table with one-line focus per doc.

### The section hub (Tier 2)

- A one-line scope: what the section covers, doc count.
- 2-3 **named clusters** with substantive prose — say what question each doc
  answers and how the docs relate, not just their titles.
- **Connections to other sections** — where this section's ideas continue.
- A **reading order** and cluster table.

### Documents (Tier 3)

- Frontmatter: `tags`, `date` (the linter checks these).
- **Lead with the answer.** First screen useful; background later.
- Cross-link: related docs, the hub, and any code paths (`src/billing/…`) —
  code references make docs verifiable against reality.
- Stable titles. Links resolve by title; renames break the graph. If a title
  must change, leave a bridge note behind.

---

## 4. The build workflow (what the `new-kb` skill does)

1. **Scope interview.** Name the KB, its audience question ("what will agents
   ask this?"), and its trust boundary *before* writing docs.
2. **Outline sections and doc titles.** Get the decomposition reviewed by the
   human — restructuring later breaks links.
3. **Write Tier 3 docs first**, one section at a time. Content before
   packaging.
4. **Write section hubs** once a section's docs exist — hubs describe real
   docs, not planned ones.
5. **Write the meta-analysis last.** Executive summary and lookup table can
   only be honest after the content exists.
6. **Register it.** Add the KB to `Research Library.md` (research KBs) and add
   task-keyed rows to `00-Index.md`. Add a router row if agents should reach
   it from session start.
7. **Lint.** `node scripts/vault-check.mjs` — links resolve, hubs cover all
   docs, no orphans. Fix red before calling it done.

---

## 5. Cross-KB synthesis

When two KBs keep getting read together, the connection itself is knowledge.
Capture it as a **synthesis doc** — a doc that takes its evidence from
multiple KBs and answers a question neither answers alone ("what does our
billing model imply for the operations runbook?"). Place it in the KB where
the question usually *arises*; link it from both meta-analyses' trust-boundary
or topic-map sections. Synthesis docs are the highest-value docs per token in
a mature vault — they encode the judgment calls that otherwise live only in
someone's head.

---

## 6. Quality bar

- A KB an agent can't navigate blind is not done. Test: give an agent a
  question the KB should answer, starting from `00-Index.md` only. If it
  doesn't land on the right doc in ≤3 hops, fix the routing tables, not the
  agent.
- Every doc reachable from its hub; every hub reachable from its
  meta-analysis; every meta-analysis reachable from `00-Index.md`.
- No doc without a reader: if you can't say which future question a doc
  answers, don't write it.
