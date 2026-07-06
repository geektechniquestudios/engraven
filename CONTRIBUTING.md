# Contributing

Engraven is the extracted structure of a production agent-memory system; the
bar for changes is "would this survive months of real agent traffic?"

- **Bugs in the checks**: the same checks ship twice, as the Rust CLI
  (`src/`) and as zero-dependency scripts (`scripts/`: Node ≥18 stdlib,
  bash + coreutils). Fix both sides or CI's parity job will fail the PR.
  Add a case to `validate-memory.sh --self-test`, a Rust test, or the CI
  vault check when you fix one.
- **Template & spec changes**: open an issue first describing the failure
  mode you hit in real use. Structure changes ripple into every install, so
  they need a story, not just a preference.
- **Docs**: clarity fixes always welcome.

Before pushing:

```bash
npm run check          # template vault lints green
npm run check:memory   # linter self-test passes
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

By contributing you agree your contributions are licensed under the MIT
License.
