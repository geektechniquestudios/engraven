//! engraven — linters for the Engraven memory system.
//!
//! Subcommands:
//! - `engraven vault`  — vault integrity linter (port of `scripts/vault-check.mjs`)
//! - `engraven memory` — router + topic-file linter (port of `scripts/validate-memory.sh`)
//! - `engraven check`  — both in sequence, vault first
//!
//! The two linters are exact-output ports: report lines, orderings, and exit
//! codes match the original scripts. Flag parsing therefore also mirrors the
//! scripts (for example, unknown arguments exit 2 with the scripts' wording).

mod config;
mod counts;
mod memory;
mod util;
mod vault;

use std::io::Write;

use memory::{MemoryArgs, MemoryMode};
use vault::VaultArgs;

const VERSION: &str = env!("CARGO_PKG_VERSION");

const ROOT_HELP: &str = "\
engraven — vault + memory linters for the Engraven memory system

Usage:
  engraven vault [--vault <dir>] [--strict] [--fix] [--allow-placeholders] [--quiet]
  engraven memory [--budget-only|--ci] [--memory-dir <dir>] [--self-test]
  engraven check
  engraven --version

Commands:
  vault    Vault integrity linter (11 checks; --fix refreshes count directives)
  memory   Router + topic-file linter (auto-discovers the harness memory dir)
  check    Run vault then memory; fails if either fails

Options:
  -h, --help       Show this help
  -V, --version    Show the version

Configuration is read from engraven.config.json in the working directory.
Run 'engraven <command> --help' for command details.";

const VAULT_HELP: &str = "\
engraven vault — vault integrity linter

Usage: engraven vault [--vault <dir>] [--strict] [--fix] [--allow-placeholders] [--quiet]

Checks:
  1.  Wiki-links resolve        [[Target]] / [[Target|alias]] / [[Target#h]]
  2.  Duplicate titles          two files sharing a basename (ambiguous links)
  3.  Frontmatter contract      required keys present (config: requireFrontmatter)
  4.  Orphan docs               docs with no inbound links (entry points exempt)
  5.  KB structure              each KB dir has a meta-analysis; docs covered by hub/meta
  6.  Stub docs                 near-empty files that pollute retrieval
  7.  Unresolved placeholders   leftover {{TOKENS}} from the bootstrap
  8.  Count directives          <!-- count:name -->N<!-- /count --> stale values (--fix rewrites)
  9.  Entry-point reachability  every KB's meta-analysis linked from 00-Index / Research Library
  10. Archive index coverage    every session archive entry listed in the archive index
  11. Solitary docs             docs with zero outgoing wiki-links (dead ends in the graph)

Count vocabulary (check 8): vault-docs, kbs, hubs, meta-analyses,
archive-entries, kb:<KB-Dir-Name>. Counts are also scanned in any repo
files listed in config \"countFiles\" (e.g. [\"CLAUDE.md\", \"README.md\"]).

Options:
  --vault <dir>          Vault directory (default: \"vaultDir\" from engraven.config.json,
                         else docs/vault)
  --strict               Exit 1 on warnings, not only on errors
  --fix                  Rewrite stale count directives in place
  --allow-placeholders   Skip the unresolved-{{PLACEHOLDER}} check
  --quiet                Suppress the report; exit code only
  -h, --help             Show this help

Config: engraven.config.json in the working directory (all keys optional):
  { \"vaultDir\": \"docs/vault\", \"requireFrontmatter\": [\"tags\",\"date\"],
    \"sessionArchiveDir\": \"Session-Archive\", \"countFiles\": [] }

Exit code: 0 clean · 1 errors (or warnings with --strict) · 2 usage error";

const MEMORY_HELP: &str = "\
engraven memory — router + topic-file linter

Usage: engraven memory [--budget-only|--ci] [--memory-dir <dir>] [--self-test]

Checks:
  1. MEMORY.md (the router) exists
  2. Router is within the auto-load budget (default 200 lines)
  3. Every topic file referenced in the router exists on disk
  4. Every topic file has a router entry (no orphaned memory)
  5. Topic-file frontmatter contract: name, description, metadata.type
  6. Topic files within the soft size cap (default 150 lines; warning)
  7. Topic-file vault_refs resolve to real vault docs

Options:
  --budget-only, --ci    Run checks 1-2 only (fast; CI)
  --memory-dir <dir>     Explicit memory location
  --self-test            Verify the linter itself against embedded fixtures
  -h, --help             Show this help

Memory dir resolution order:
  --memory-dir flag → $ENGRAVEN_MEMORY_DIR → auto-discovery under
  ~/.claude/projects/*<projectSlug>*/memory (shortest path wins — worktree
  encodings strictly extend the main project's encoding).

On machines with no memory dir (e.g. CI runners) the full run SKIPS cleanly:
harness-local memory is per-machine and never committed.

Exit code: 0 clean/skipped · 1 errors · 2 usage error";

const CHECK_HELP: &str = "\
engraven check — run the vault linter, then the memory linter

Usage: engraven check

Runs 'engraven vault' followed by 'engraven memory', both with default
options, and exits with the worst of the two exit codes.";

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    std::process::exit(dispatch(&args));
}

fn dispatch(args: &[String]) -> i32 {
    let mut stdout = std::io::stdout().lock();
    let Some(command) = args.first() else {
        eprintln!("{ROOT_HELP}");
        return 2;
    };
    match command.as_str() {
        "-V" | "--version" => {
            let _ = writeln!(stdout, "engraven {VERSION}");
            0
        }
        "-h" | "--help" => {
            let _ = writeln!(stdout, "{ROOT_HELP}");
            0
        }
        "vault" => match parse_vault_args(&args[1..], &mut stdout) {
            Ok(vault_args) => vault::run(&vault_args, &mut stdout),
            Err(code) => code,
        },
        "memory" => match parse_memory_args(&args[1..], &mut stdout) {
            Ok(memory_args) => memory::run(&memory_args, &mut stdout),
            Err(code) => code,
        },
        "check" => match parse_check_args(&args[1..], &mut stdout) {
            Ok(()) => {
                let vault_code = vault::run(&VaultArgs::default(), &mut stdout);
                let memory_args = MemoryArgs {
                    mode: MemoryMode::Full,
                    memory_dir: None,
                };
                let memory_code = memory::run(&memory_args, &mut stdout);
                vault_code.max(memory_code)
            }
            Err(code) => code,
        },
        other => {
            eprintln!("Unknown command: {other}");
            eprintln!("Run 'engraven --help' for usage.");
            2
        }
    }
}

/// Mirrors the `.mjs` argument switch: `--vault` consumes the next argument
/// (or silently falls back to the config when it is the last token), unknown
/// arguments exit 2, `--help` prints usage and exits 0.
fn parse_vault_args(rest: &[String], stdout: &mut dyn Write) -> Result<VaultArgs, i32> {
    let mut parsed = VaultArgs::default();
    let mut i = 0;
    while i < rest.len() {
        match rest[i].as_str() {
            "--vault" => {
                i += 1;
                parsed.vault = rest.get(i).cloned();
            }
            "--strict" => parsed.strict = true,
            "--fix" => parsed.fix = true,
            "--allow-placeholders" => parsed.allow_placeholders = true,
            "--quiet" => parsed.quiet = true,
            "-h" | "--help" => {
                let _ = writeln!(stdout, "{VAULT_HELP}");
                return Err(0);
            }
            other => {
                eprintln!("Unknown argument: {other}");
                return Err(2);
            }
        }
        i += 1;
    }
    Ok(parsed)
}

/// Mirrors the `.sh` argument loop, including its one accident: the script
/// dies from `set -e` (exit 1, no message) when `--memory-dir` is the last
/// argument, because the final `shift` fails.
fn parse_memory_args(rest: &[String], stdout: &mut dyn Write) -> Result<MemoryArgs, i32> {
    let mut mode = MemoryMode::Full;
    let mut memory_dir: Option<String> = None;
    let mut i = 0;
    while i < rest.len() {
        match rest[i].as_str() {
            "--budget-only" | "--ci" => mode = MemoryMode::Budget,
            "--self-test" => mode = MemoryMode::SelfTest,
            "--memory-dir" => {
                i += 1;
                match rest.get(i) {
                    Some(value) => memory_dir = Some(value.clone()),
                    None => return Err(1),
                }
            }
            "-h" | "--help" => {
                let _ = writeln!(stdout, "{MEMORY_HELP}");
                return Err(0);
            }
            other => {
                eprintln!("Unknown argument: {other}");
                return Err(2);
            }
        }
        i += 1;
    }
    Ok(MemoryArgs { mode, memory_dir })
}

fn parse_check_args(rest: &[String], stdout: &mut dyn Write) -> Result<(), i32> {
    match rest.first().map(String::as_str) {
        None => Ok(()),
        Some("-h") | Some("--help") => {
            let _ = writeln!(stdout, "{CHECK_HELP}");
            Err(0)
        }
        Some(other) => {
            eprintln!("Unknown argument: {other}");
            Err(2)
        }
    }
}
