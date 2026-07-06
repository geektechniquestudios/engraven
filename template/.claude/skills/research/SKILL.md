---
name: research
description: "Deep-research a topic into a full knowledge base: gather from web, code, and the human; build the three-tier KB; cross-synthesize it with existing KBs; abstract the synthesis into decision guidance."
argument-hint: "<topic> (e.g. 'rate limiting strategies', 'Postgres partitioning')"
---

# Research → Knowledge Base

**Topic:** $ARGUMENTS

This is the pipeline that grows the vault: **research produces a KB, the KB
gets cross-synthesized with what the vault already knows, and the synthesis
is abstracted into decision guidance.** A research KB that just summarizes
sources is half-finished; the value is created in the last two steps.

## Step 0 — Gate and scope

1. Confirm the topic clears the KB bar (6+ docs, different questions over
   time, months of relevance). Thinner than that → one vault doc, not a KB.
2. Ask the human, one batch:
   - What decision or work is this research FOR? (this becomes the motive
     that Step 4 abstracts toward)
   - What do they already believe about the topic? (test it, don't assume it)
   - Constraints: budget, stack, timeline, hard requirements.

## Step 1 — Gather

Research in passes, broadest first. For each source, capture claims WITH the
evidence, not paraphrase alone:

1. **Web**: primary docs, papers, engineering blogs, postmortems. Prefer
   primary sources; note publication dates — stale claims rot KBs.
2. **Code**: if the repo already touches the topic, read the actual
   implementation. Repo-grounded findings outrank external ones (trust
   hierarchy).
3. **The human**: interview for constraints and war stories that exist only
   in their head.

Keep a running source list; every tier-3 doc will cite what grounds it.

## Step 2 — Build the KB (three tiers, bottom-up)

Follow the `new-kb` skill's structure — outline first, human approves, then
tier-3 docs → section hubs → meta-analysis. Research-specific requirements:

- Each doc **leads with the answer/claim**, then evidence, then sources.
- Mark confidence explicitly where sources disagree ("contested:", "single
  source:").
- The meta-analysis's executive summary is 3-5 **claims** the research
  supports, not a table of contents.

## Step 3 — Cross-synthesize

New knowledge earns its place by connecting. Read the meta-analyses of the
2-3 nearest existing KBs, then:

1. Add `[[wiki-links]]` both ways wherever the new KB confirms, contradicts,
   or constrains an existing doc.
2. Where two KBs jointly answer a question neither answers alone, write a
   **synthesis doc** (in the section it most belongs to) that leads with the
   joint answer and links into both KBs.
3. Contradictions are findings, not embarrassments: record which source wins
   and why, per the trust hierarchy (repo-grounded > hubs > research KBs).

## Step 4 — Abstract into decision guidance

Roll the synthesis upward — this is what makes the vault *doctrine* rather
than a pile of notes:

1. Return to the motive from Step 0 and write the decision it unblocks into
   the meta-analysis: "given our constraints, do X; revisit if Y changes."
2. If the research changes how the project should act by default, propose a
   session-essential rule or router row for the human to approve.
3. Record what would falsify the recommendation, so a future session knows
   when the doctrine expires.

## Step 5 — Register and lint

1. Row in `Research Library.md` (topic, doc count, date, one-line claim).
2. Task-keyed row(s) in `00-Index.md`; router row if agents should reach
   this KB from session start.
3. `node scripts/vault-check.mjs --fix` (refreshes counts) then
   `bash scripts/validate-memory.sh` — both green before you report.
4. Report: the 3-5 claims, the decision guidance, where it's registered,
   and which existing KBs it now links into.
