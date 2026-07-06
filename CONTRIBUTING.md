# Contributing

Thanks for wanting to make Engraven better. It is the extracted structure of
a production agent-memory system, so the bar for every change is simple:
would this survive months of real agent traffic?

## Branch model

- **`develop` is the integration branch and the default.** Every pull
  request targets `develop`.
- **`main` is the release branch.** Releases merge from `develop`, and tags
  (`v*`) cut from `main` publish binaries for macOS, Linux, and Windows.
- Branch from `develop` with a descriptive name (`feat/...`, `fix/...`,
  `docs/...`), keep the diff focused on one thing, and open a PR back to
  `develop`.

## Proposing features

Open a [feature request](https://github.com/geektechniquestudios/engraven/issues/new?template=feature_request.yml)
before writing code for anything structural: template shape, spec, router
contract, linter checks. Structure changes ripple into every install, so
they need a story from real use, not just a preference. Small fixes and
clarity improvements can go straight to a PR.

Questions and ideas that are not yet concrete belong in
[Discussions](https://github.com/geektechniquestudios/engraven/discussions).

## Dev setup

```bash
git clone https://github.com/geektechniquestudios/engraven
cd engraven
```

You need: **Rust stable** (for the CLI), **Node 18+** (for the script
linter; it uses zero packages, so there is no `npm install`), and **bash**.

## Running the checks

```bash
npm run check            # template vault lints green (node script)
npm run check:memory     # router linter self-test (bash script)
cargo test               # Rust unit + integration tests
cargo fmt --check && cargo clippy --all-targets --all-features -- -D warnings
cargo build --release
```

## The parity contract

The same checks ship twice on purpose: the Rust CLI (`src/`) and the
zero-dependency scripts (`scripts/`). Their stdout must stay byte-identical;
CI diffs them on every push and fails the PR if they drift:

```bash
node scripts/vault-check.mjs --vault template/vault --strict --allow-placeholders > /tmp/a
./target/release/engraven vault --vault template/vault --strict --allow-placeholders > /tmp/b
diff /tmp/a /tmp/b
```

If you change a check or a message, change it on both sides and update the
tests (`tests/`, plus a self-test case in `validate-memory.sh` where it
applies).

## What makes a good PR

- One concern per PR, with the why in the description
- Checks above pass locally
- Template or spec changes explain the failure mode they fix
- New checks come with a fixture that triggers them
- No em dashes in user-facing copy (README, CLI output, plugin text)

## Reporting bugs

Use the [bug report template](https://github.com/geektechniquestudios/engraven/issues/new?template=bug_report.yml).
The fastest bugs to fix come with the linter output and a minimal vault
layout that reproduces the problem.

For security issues, see [SECURITY.md](SECURITY.md); please do not open a
public issue.

By contributing you agree your contributions are licensed under the MIT
License.
