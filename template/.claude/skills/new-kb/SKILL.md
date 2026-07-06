---
name: new-kb
description: "Create a new knowledge base in the vault with full three-tier structure — meta-analysis, section hubs, and documents — then register and lint it."
argument-hint: "<subject> (e.g. 'payments domain', 'deploy operations')"
---

# New Knowledge Base

**Subject:** $ARGUMENTS

Build a three-tier KB for the subject. The full reasoning lives in Engram's
KB-GUIDE (https://github.com/geektechniquestudios/engram/blob/main/docs/KB-GUIDE.md);
this skill is the executable version.

## Step 0 — Gate

Confirm the subject clears the KB bar: decomposes into **6+ docs**, will be
asked **different questions** over time, stays relevant for **months**. If it
doesn't, say so and file the knowledge as a single vault doc + `00-Index.md`
row (or a topic file) instead. Do not build ceremony around thin content.

## Step 1 — Scope (with the human)

Ask, in one batch:

1. What questions should this KB answer? (their words — future lookup rows)
2. What is explicitly OUT of scope, and where does that live instead?
   (→ trust boundary)
3. What sources ground it — code paths, docs, external references, their
   head? (interview for the head-only parts)

## Step 2 — Outline, then review

Propose section names (2-6, numbered directories: `01-Foundations/`…) and
doc titles (3-10 per section, stable — renames break links). **Show the
human the outline and get a yes before writing** — restructuring after
creation breaks cross-links.

## Step 3 — Write bottom-up

1. **Tier-3 docs first**, one section at a time. Frontmatter (`tags`,
   `date`); lead with the answer; cross-link related docs and code paths.
2. **Section hubs** once a section's docs exist: 2-3 named clusters with
   substantive descriptions (what question each doc answers), connections to
   other sections, reading order.
3. **Meta-analysis last** (`<KB Name> - Meta-Analysis.md`): executive summary
   (3-5 *claims*, not topics), trust boundary (authoritative for / NOT
   authoritative for, with links), "How to use this KB" question-keyed
   table, topic map with `→ [[Section Hub]]` links and doc tables.

## Step 4 — Register

- `00-Index.md`: task-keyed row(s) pointing at the meta-analysis.
- `Research Library.md`: a row, if this is a research KB.
- Router (`MEMORY.md` / AGENTS.md router): one encounter row, if agents
  should reach this KB from session start.

## Step 5 — Lint and prove

1. `node scripts/vault-check.mjs` — links, hub coverage, no orphans; fix red.
2. Retrieval test: from `00-Index.md` alone, navigate to the answer of one
   of Step 1's questions in ≤3 hops. If you can't, fix the lookup rows —
   not by memorizing the path, but by writing the row you wish had existed.
3. Report to the human: sections, doc count, where it's registered, and the
   one-line answer to "when will this KB fire?"
