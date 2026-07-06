## What and why

<!-- One concern per PR. What changed, and what real situation motivated it? -->

## Checklist

- [ ] Targets `develop` (not `main`)
- [ ] `npm run check` and `npm run check:memory` pass
- [ ] `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, and `cargo test` pass
- [ ] If a check or message changed: both the Rust CLI and the scripts changed together (the CI parity job diffs them)
- [ ] Template or spec changes describe the failure mode they fix
- [ ] User-facing copy has no em dashes
