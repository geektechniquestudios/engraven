---
tags: [engram, memory, research, synthesis]
date: {{DATE}}
---

# The Knowledge Pipeline

> Section hub: [[Core Design - Section Hub]]

**The vault grows through a pipeline, not by accretion: research produces a
KB → the KB is cross-synthesized with existing KBs → the synthesis is
abstracted into decision guidance.** A vault that stops at step one is a
library; the pipeline is what turns it into doctrine an agent can act on.

## Stage 1 — Research produces a KB

The `research` skill takes a topic and produces a full three-tier KB:
gathering (web, code, the human's head), then tier-3 docs that lead with
claims and cite sources, then hubs, then a meta-analysis whose executive
summary is 3-5 *claims* — not a table of contents. Every research KB is
registered in [[Research Library]] with a one-line claim, so the registry
reads as a list of things the project has learned.

Repo-grounded findings outrank external sources (the trust hierarchy in
[[Routing Over Search]]): when the code and a blog post disagree, the code
is the fact and the post is context.

## Stage 2 — Cross-synthesis connects it

New knowledge earns its place by connecting. After the KB exists, the skill
reads the nearest existing meta-analyses and links both ways: confirmations,
contradictions, constraints. Where two KBs jointly answer a question neither
answers alone, a **synthesis doc** is written — it leads with the joint
answer and links into both KBs. This is why a healthy vault graphs as a web,
not a forest of separate trees: the cross-links are where compound knowledge
lives.

Contradictions are recorded, not smoothed over: which source wins, and why,
per the trust hierarchy.

## Stage 3 — Abstraction turns it into doctrine

Synthesis rolls upward into *motive* — the decision the research was for:

- The meta-analysis gains explicit guidance: "given our constraints, do X;
  revisit if Y changes."
- If the finding changes default behavior, it becomes a session-essential
  rule or router row (human-approved), so it acts on every future session
  rather than waiting to be looked up.
- The falsifier is written down: what observation would expire this
  doctrine. Doctrine without an expiry condition is dogma.

## Why the stages are separate

Each stage has a different failure mode, and separating them makes each one
lintable and reviewable: research can be wrong (bad sources), synthesis can
be missing (orphan KBs — the linter's orphan and solitary-node checks catch
the structural symptom), abstraction can overreach (rules with no falsifier).
Collapsing the pipeline into "just write notes" produces all three failures
at once, silently. Where each artifact lands is governed by the decision
table in [[What Goes Where]]; what history the pipeline leaves behind is
captured by [[Session Archiving]].
