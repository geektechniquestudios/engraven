---
paths:
  - "docs/vault/**"
---

# Vault Editing Rules

If you are creating or editing a vault note:

- Give it a clear, **stable** title — agents retrieve by title; renames break
  cross-links. Prefer a bridge note over a rename.
- Make the first screen useful: lead with the answer or decision, background
  after.
- Add frontmatter with at minimum `tags` and `date`.
- Cross-link the relevant hub and adjacent notes with `[[WikiLink]]` syntax.
  A note nothing links to is unroutable — the linter will flag it.

If you are editing a meta-analysis:

- Keep the trust boundary accurate — it defines what the KB covers and what
  it delegates elsewhere.
- Keep the "How to use this KB" rows phrased as the questions an agent would
  actually think while stuck.
- Update the "Last updated" date.

If you are editing `00-Index.md`:

- Keep the task table organized by activity; verify a target doc exists
  before adding its row.
- Research KBs are registered in `Research Library.md`, not here — this file
  carries task rows only.

After any vault change:

```bash
node scripts/vault-check.mjs
```

Red output = fix before moving on (broken links, orphans, duplicate titles,
missing frontmatter). Never commit a red vault.
