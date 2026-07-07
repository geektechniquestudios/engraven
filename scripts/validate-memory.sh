#!/usr/bin/env bash
# validate-memory.sh — Hyphasma router + topic-file linter (bash + coreutils only).
#
# Checks:
#   1. MEMORY.md (the router) exists
#   2. Router is within the auto-load budget (default 200 lines)
#   3. Every topic file referenced in the router exists on disk
#   4. Every topic file has a router entry (no orphaned memory)
#   5. Topic-file frontmatter contract: name, description, metadata.type
#   6. Topic files within the soft size cap (default 150 lines; warning)
#   7. Topic-file vault_refs resolve to real vault docs
#
# Usage:
#   bash scripts/validate-memory.sh                     # full run
#   bash scripts/validate-memory.sh --budget-only|--ci  # checks 1-2 only (fast; CI)
#   bash scripts/validate-memory.sh --memory-dir <dir>  # explicit memory location
#   bash scripts/validate-memory.sh --self-test         # verify the linter itself
#
# Memory dir resolution order:
#   --memory-dir flag → $HYPHASMA_MEMORY_DIR → auto-discovery under
#   ~/.claude/projects/*<projectSlug>*/memory (shortest path wins — worktree
#   encodings strictly extend the main project's encoding).
#
# On machines with no memory dir (e.g. CI runners) the full run SKIPS cleanly:
# harness-local memory is per-machine and never committed.
#
# Exit code: 0 clean/skipped · 1 errors · 2 usage error

set -euo pipefail

MODE="full"
MEMORY_DIR_ARG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --budget-only|--ci) MODE="budget" ;;
    --self-test) MODE="selftest" ;;
    --memory-dir) MEMORY_DIR_ARG="${2:-}"; shift ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

# ── Config (hyphasma.config.json in cwd; flat keys, defaults if absent) ──
cfg() { # cfg <key> <default>
  local key="$1" default="$2"
  if [[ -f hyphasma.config.json ]] && command -v node >/dev/null 2>&1; then
    node -e "
      const c = JSON.parse(require('fs').readFileSync('hyphasma.config.json','utf8'));
      const v = c['$key'];
      if (v !== undefined && v !== null) process.stdout.write(String(v));
    " 2>/dev/null | grep . || echo "$default"
  else
    echo "$default"
  fi
}

BUDGET="$(cfg memoryBudget 200)"
SOFT_CAP="$(cfg topicFileSoftCap 150)"
VAULT_DIR="$(cfg vaultDir docs/vault)"
PROJECT_SLUG="$(cfg projectSlug "$(basename "$(pwd)")")"

ERRORS=0
WARNINGS=0
err()  { echo "  ✗ $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo "  ⚠ $1"; WARNINGS=$((WARNINGS + 1)); }
ok()   { echo "  ✓ $1"; }

# ── Memory directory discovery ────────────────────────────────────────
find_memory_dir() {
  if [[ -n "$MEMORY_DIR_ARG" ]]; then echo "$MEMORY_DIR_ARG"; return; fi
  if [[ -n "${HYPHASMA_MEMORY_DIR:-}" ]]; then echo "$HYPHASMA_MEMORY_DIR"; return; fi
  local base="$HOME/.claude/projects"
  [[ -d "$base" ]] || { echo ""; return; }
  local best="" d
  while IFS= read -r d; do
    if [[ -z "$best" ]] \
      || (( ${#d} < ${#best} )) \
      || { (( ${#d} == ${#best} )) && [[ "$d" < "$best" ]]; }; then
      best="$d"
    fi
  done < <(find "$base" -maxdepth 2 -type d -name "memory" -path "*${PROJECT_SLUG}*" 2>/dev/null)
  echo "$best"
}

# ── The checks (run against $1 = memory dir) ──────────────────────────
run_checks() {
  local dir="$1"
  local memory_md="$dir/MEMORY.md"

  echo "Checking router exists..."
  if [[ ! -f "$memory_md" ]]; then
    err "MEMORY.md not found in $dir"
    return
  fi
  ok "MEMORY.md present"

  echo "Checking auto-load budget (≤ $BUDGET lines)..."
  local lines
  lines=$(wc -l < "$memory_md" | tr -d ' ')
  if (( lines > BUDGET )); then
    err "MEMORY.md is $lines lines (lines past $BUDGET are silently truncated at session start)"
  else
    ok "MEMORY.md is $lines/$BUDGET lines"
  fi

  [[ "$MODE" == "budget" ]] && return

  echo "Checking router rows point at real files..."
  local dead=0 f
  # topic files are referenced in backticks: `some_file.md`
  while IFS= read -r f; do
    if [[ ! -f "$dir/$f" ]]; then
      err "router references missing topic file: $f"
      dead=1
    fi
  done < <(grep -o '`[A-Za-z0-9_.-]*\.md`' "$memory_md" | tr -d '\`' | sort -u)
  (( dead == 0 )) && ok "all referenced topic files exist"

  echo "Checking every topic file has a router entry..."
  local orphans=0 name
  for f in "$dir"/*.md; do
    [[ -e "$f" ]] || continue
    name="$(basename "$f")"
    [[ "$name" == "MEMORY.md" ]] && continue
    if ! grep -qF "$name" "$memory_md"; then
      err "orphan topic file (no router entry): $name"
      orphans=1
    fi
  done
  (( orphans == 0 )) && ok "no orphan topic files"

  echo "Checking topic-file frontmatter contract..."
  local fm_bad=0 fm
  for f in "$dir"/*.md; do
    [[ -e "$f" ]] || continue
    name="$(basename "$f")"
    [[ "$name" == "MEMORY.md" ]] && continue
    # frontmatter = lines between the first two '---' markers
    fm="$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$f")"
    for key in "name:" "description:" "type:"; do
      if ! grep -q "$key" <<<"$fm"; then
        err "$name missing frontmatter field: ${key%:} (required: name, description, metadata.type)"
        fm_bad=1
      fi
    done
  done
  (( fm_bad == 0 )) && ok "frontmatter contract satisfied"

  echo "Checking topic-file sizes (soft cap $SOFT_CAP lines)..."
  local oversize=0
  for f in "$dir"/*.md; do
    [[ -e "$f" ]] || continue
    name="$(basename "$f")"
    [[ "$name" == "MEMORY.md" ]] && continue
    lines=$(wc -l < "$f" | tr -d ' ')
    if (( lines > SOFT_CAP )); then
      warn "$name is $lines lines (promote deep content to the vault, keep a pointer)"
      oversize=1
    fi
  done
  (( oversize == 0 )) && ok "all topic files within the soft cap"

  echo "Checking vault_refs resolve..."
  if [[ -d "$VAULT_DIR" ]]; then
    local refs_bad=0 ref
    for f in "$dir"/*.md; do
      [[ -e "$f" ]] || continue
      name="$(basename "$f")"
      [[ "$name" == "MEMORY.md" ]] && continue
      fm="$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$f")"
      # vault_refs entries: list items, quoted or bare
      while IFS= read -r ref; do
        [[ -z "$ref" ]] && continue
        if ! find "$VAULT_DIR" -name "$ref.md" -print -quit 2>/dev/null | grep -q .; then
          err "$name vault_ref does not resolve: \"$ref\" (no $ref.md under $VAULT_DIR)"
          refs_bad=1
        fi
      done < <(grep -A100 '^vault_refs:' <<<"$fm" | tail -n +2 \
                 | sed -n 's/^[[:space:]]*-[[:space:]]*//p' | sed 's/^"//; s/"$//')
    done
    (( refs_bad == 0 )) && ok "all vault_refs resolve"
  else
    warn "vault dir '$VAULT_DIR' not found from $(pwd) (skipping vault_refs check)"
  fi
}

# ── Self-test: run the checks against known-good and known-bad fixtures ─
self_test() {
  local tmp pass_dir fail_dir
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT

  pass_dir="$tmp/pass/memory"; mkdir -p "$pass_dir"
  cat > "$pass_dir/MEMORY.md" <<'EOF'
# Lookup Protocol
Row match → read the file.
## Topic File Router
| File | Covers |
| --- | --- |
| `testing.md` | test gotchas |
EOF
  cat > "$pass_dir/testing.md" <<'EOF'
---
name: testing
description: test gotchas
metadata:
  type: project
---
- reset mocks between suites
EOF

  fail_dir="$tmp/fail/memory"; mkdir -p "$fail_dir"
  cat > "$fail_dir/MEMORY.md" <<'EOF'
# Router
| File | Covers |
| --- | --- |
| `missing.md` | points nowhere |
EOF
  cat > "$fail_dir/orphan.md" <<'EOF'
no frontmatter, no router row
EOF

  echo "=== self-test: known-good fixture (expect PASS) ==="
  if ( ERRORS=0; WARNINGS=0; run_checks "$pass_dir"; exit $(( ERRORS > 0 )) ); then
    echo "  ✓ good fixture passes"
  else
    echo "  ✗ SELF-TEST FAILED: good fixture reported errors"; exit 1
  fi

  echo "=== self-test: known-bad fixture (expect FAIL) ==="
  if ( ERRORS=0; WARNINGS=0; run_checks "$fail_dir" >/dev/null 2>&1; exit $(( ERRORS > 0 )) ); then
    echo "  ✗ SELF-TEST FAILED: bad fixture passed"; exit 1
  else
    echo "  ✓ bad fixture correctly fails (dead row, orphan, missing frontmatter)"
  fi

  echo "self-test OK"
  exit 0
}

# ── Main ──────────────────────────────────────────────────────────────
[[ "$MODE" == "selftest" ]] && self_test

MEMORY_DIR="$(find_memory_dir)"
if [[ -z "$MEMORY_DIR" || ! -d "$MEMORY_DIR" ]]; then
  echo "No memory directory found for project '$PROJECT_SLUG'; skipping."
  echo "(normal on CI runners; locally, pass --memory-dir or set HYPHASMA_MEMORY_DIR)"
  exit 0
fi

echo "hyphasma validate-memory · $MEMORY_DIR"
run_checks "$MEMORY_DIR"

echo "=== Summary ==="
echo "Errors:   $ERRORS"
echo "Warnings: $WARNINGS"
if (( ERRORS > 0 )); then
  echo "FAIL: fix memory errors before moving on"
  exit 1
fi
echo "PASS: memory system is healthy"
