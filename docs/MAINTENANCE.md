# Maintenance & Anti-Entropy

> Memory systems don't fail loudly — they rot. This doc defines the upkeep
> protocol: what decays, how the linters catch it, and the habits that keep
> the system trustworthy for months. The `memory-maintenance` skill automates
> the audit loop.

---

## 1. The failure modes

| Failure                | Looks like                                              | Caught by                         |
|------------------------|----------------------------------------------------------|-----------------------------------|
| **Budget overflow**    | router grows past the auto-load limit; tail silently truncated — the agent doesn't know what it isn't seeing | `validate-memory.sh` (hard fail)  |
| **Index drift**        | router rows point at renamed/deleted files              | `validate-memory.sh`              |
| **Orphaned memory**    | topic files or vault docs nothing routes to             | both linters                      |
| **Broken links**       | `[[WikiLinks]]` to renamed/deleted docs                 | `vault-check.mjs`                 |
| **Ambiguous titles**   | two docs share a basename; links resolve unpredictably  | `vault-check.mjs`                 |
| **Count drift**        | "12 docs" claims in indexes/READMEs no longer match reality | `vault-check.mjs` (`--fix` rewrites) |
| **Unreachable KBs**    | a KB exists but no entry point routes to it; archive entries missing from the index | `vault-check.mjs` |
| **Solitary docs**      | a doc links to nothing — a dead end in the graph        | `vault-check.mjs`                 |
| **Stale facts**        | a doc still says what *used* to be true                 | `last_validated` staleness + habit §3 |
| **Description drift**  | router row says one thing, the file says another        | review habit §3                   |
| **Dump creep**         | the router accretes prose until it's a second vault     | budget + review habit §3          |

---

## 2. The linters

Run after **any** memory change; wire into CI (template ships a workflow).

```bash
node scripts/vault-check.mjs            # vault: links, orphans, hubs, counts, reachability, solitary docs
node scripts/vault-check.mjs --strict   # warnings become failures (use in CI)
node scripts/vault-check.mjs --fix      # rewrite stale <!-- count:… --> directives in place
bash scripts/validate-memory.sh         # router: budget, dead rows, orphans, frontmatter contract
```

Doc counts in indexes and READMEs are wrapped in count directives —
`<!-- count:kb:Payments-Domain -->12<!-- /count -->` — so they are *checked*
numbers, not aspirations. `--fix` refreshes them after docs are added or
removed; files outside the vault join the sweep via `countFiles` in
`engraven.config.json`. Vocabulary: `vault-docs`, `kbs`, `hubs`,
`meta-analyses`, `archive-entries`, `kb:<KB-Dir-Name>`.

Treat a red memory check exactly like a red test: fix it before shipping.
Both linters are zero-dependency (Node ≥18, bash) and configured via
`engraven.config.json`.

---

## 3. Write-time habits (cheap) vs. cleanup (expensive)

Anti-entropy is 90% write-time discipline:

- **New gotcha** → topic file bullet + router row, *in the same sitting*.
- **New decision** → vault doc or archive entry, linked from where the
  question will next arise.
- **Correction from the human** → `feedback` memory with why + how-to-apply.
- **Touched a doc while working?** Refresh its `last_validated`; fix any lie
  you noticed in passing. Leave memory cleaner than you found it.
- **Learned something was wrong?** Delete or fix the memory *now*. A wrong
  memory is worse than no memory — it gets retrieved with confidence.
- **Promotion rule:** topic file past ~150 lines → move deep content to a
  vault doc, keep the operational bullets + a pointer.
- **Single-home rule:** never restate a rule in a second surface; point at it.

## 4. Periodic audit (the `memory-maintenance` skill)

Monthly, or when the linters have been red-ish for a while:

1. Run both linters; fix everything red.
2. Sweep `last_validated` dates older than ~60 days: re-verify against code
   and reality, refresh or delete.
3. Read the router top to bottom. For each row ask: *has this fired in the
   last month?* Rows that never fire get compressed or demoted; rules that
   keep being violated get promoted toward the top (primacy).
4. Look at the shape of the vault (the Obsidian graph view is pleasant here,
   but optional). Orphans, hub gaps, and unreachable KBs were already caught
   mechanically in step 1; you are looking for the judgment calls the linters
   can't make: KBs that should merge or split, sections that outgrew their hub.
5. Prune. Deletion is a feature. Archive entries are the one append-only
   surface — everything else earns its place or leaves.

## 5. Growth discipline

Adding knowledge has a super-linear maintenance cost: each new doc adds
cross-links to keep true, retrieval noise to route around, and one more thing
that can go stale. So:

- Don't build KBs speculatively (see KB-GUIDE §1's bar).
- Prefer enriching an existing doc over creating a near-duplicate.
- Measure the system by **decision quality** — "did the agent act better
  because memory fired?" — never by doc count. Volume is not the metric;
  volume is the *cost*.

## 6. Sharing and safety

- The vault is repo-shared: it rides ordinary code review. Memory diffs in a
  PR are a feature — a teammate can veto a wrong "lesson" before it spreads.
- Harness-local memory (topic files, router) is per-machine and **not**
  committed. Anything both agents-elsewhere and humans need belongs in the
  vault or instruction files instead.
- **Never put secrets or personal data in any memory surface.** Memory files
  are plain text that gets loaded into model context and (for the vault)
  committed to git. Secrets belong in your secret manager; the vault may
  *point* at where a secret lives, never contain one.
