//! `hyphasma memory` — router + topic-file linter.
//!
//! A faithful port of `scripts/validate-memory.sh`. Verdict lines, check
//! semantics, and exit codes are contractually identical to the script; when
//! in doubt about a quirk here, the script is the specification. That
//! includes one deliberate oddity: under `set -e` the script dies *before the
//! summary* when the final vault_refs check recorded a failure, because
//! `run_checks`'s last statement (`(( refs_bad == 0 )) && ok ...`) returns
//! nonzero. [`ChecksStatus::AbortedByLastCheck`] reproduces that path.
//!
//! Checks:
//!   1. MEMORY.md (the router) exists
//!   2. Router is within the auto-load budget (default 200 lines)
//!   3. Every topic file referenced in the router exists on disk
//!   4. Every topic file has a router entry (no orphaned memory)
//!   5. Topic-file frontmatter contract: name, description, metadata.type
//!   6. Topic files within the soft size cap (default 150 lines; warning)
//!   7. Topic-file vault_refs resolve to real vault docs

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

use regex::Regex;

use crate::config::{self, MemoryConfig};
use crate::util::{count_newlines, read_text_lossy};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MemoryMode {
    Full,
    /// `--budget-only` / `--ci`: checks 1–2 only.
    Budget,
    /// `--self-test`: run the checks against embedded fixtures.
    SelfTest,
}

#[derive(Debug)]
pub struct MemoryArgs {
    pub mode: MemoryMode,
    pub memory_dir: Option<String>,
}

#[derive(Default)]
struct Counters {
    errors: usize,
    warnings: usize,
}

#[derive(PartialEq, Eq)]
enum ChecksStatus {
    Completed,
    /// The script's `set -e` abort: full mode, vault dir present, and at
    /// least one unresolved vault_ref — the process exits 1 with no summary.
    AbortedByLastCheck,
}

struct Reporter<'a> {
    out: &'a mut dyn Write,
    counters: Counters,
}

impl<'a> Reporter<'a> {
    fn new(out: &'a mut dyn Write) -> Self {
        Reporter {
            out,
            counters: Counters::default(),
        }
    }
    fn line(&mut self, s: &str) {
        let _ = writeln!(self.out, "{s}");
    }
    fn err(&mut self, s: &str) {
        self.line(&format!("  ✗ {s}"));
        self.counters.errors += 1;
    }
    fn warn(&mut self, s: &str) {
        self.line(&format!("  ⚠ {s}"));
        self.counters.warnings += 1;
    }
    fn ok(&mut self, s: &str) {
        self.line(&format!("  ✓ {s}"));
    }
}

fn router_ref_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    // grep -o '`[A-Za-z0-9_.-]*\.md`'
    RE.get_or_init(|| Regex::new(r"`[A-Za-z0-9_.-]*\.md`").expect("fixed pattern"))
}

/// Run the memory linter; returns the process exit code.
pub fn run(args: &MemoryArgs, out: &mut dyn Write) -> i32 {
    let cwd = match std::env::current_dir() {
        Ok(d) => d,
        Err(e) => {
            eprintln!("cannot determine working directory: {e}");
            return 2;
        }
    };
    let cfg = config::memory_config(&cwd);

    if args.mode == MemoryMode::SelfTest {
        return self_test(&cfg, &cwd, out);
    }

    let memory_dir = find_memory_dir(args.memory_dir.as_deref(), &cfg.project_slug);
    let usable = memory_dir
        .as_deref()
        .is_some_and(|d| !d.is_empty() && Path::new(d).is_dir());
    if !usable {
        let _ = writeln!(
            out,
            "No memory directory found for project '{}'; skipping.",
            cfg.project_slug
        );
        let _ = writeln!(
            out,
            "(normal on CI runners; locally, pass --memory-dir or set HYPHASMA_MEMORY_DIR)"
        );
        return 0;
    }
    let memory_dir = memory_dir.unwrap_or_default();

    let _ = writeln!(out, "hyphasma validate-memory · {memory_dir}");
    let mut r = Reporter::new(out);
    let status = run_checks(
        &memory_dir,
        &cfg,
        &cwd,
        args.mode == MemoryMode::Budget,
        &mut r,
    );
    let errors = r.counters.errors;
    let warnings = r.counters.warnings;
    if status == ChecksStatus::AbortedByLastCheck {
        return 1;
    }

    let _ = writeln!(out, "=== Summary ===");
    let _ = writeln!(out, "Errors:   {errors}");
    let _ = writeln!(out, "Warnings: {warnings}");
    if errors > 0 {
        let _ = writeln!(out, "FAIL: fix memory errors before moving on");
        return 1;
    }
    let _ = writeln!(out, "PASS: memory system is healthy");
    0
}

/// Memory dir resolution order: `--memory-dir` flag → `$HYPHASMA_MEMORY_DIR`
/// → auto-discovery under `~/.claude/projects/*<projectSlug>*/memory`
/// (shortest path wins; ties break lexicographically).
fn find_memory_dir(flag: Option<&str>, project_slug: &str) -> Option<String> {
    if let Some(d) = flag {
        if !d.is_empty() {
            return Some(d.to_string());
        }
    }
    if let Ok(env_dir) = std::env::var("HYPHASMA_MEMORY_DIR") {
        if !env_dir.is_empty() {
            return Some(env_dir);
        }
    }
    let home = std::env::var("HOME").ok()?;
    let base = format!("{home}/.claude/projects");
    if !Path::new(&base).is_dir() {
        return None;
    }
    // find "$base" -maxdepth 2 -type d -name "memory" -path "*${slug}*"
    // -P (default): symlinks are not followed and are not `-type d`.
    let mut candidates = Vec::new();
    let entries = fs::read_dir(&base).ok()?;
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        let depth1 = format!("{base}/{name}");
        if name == "memory" && depth1.contains(project_slug) {
            candidates.push(depth1.clone());
        }
        let Ok(children) = fs::read_dir(&depth1) else {
            continue;
        };
        for child in children.flatten() {
            let Ok(child_type) = child.file_type() else {
                continue;
            };
            if !child_type.is_dir() {
                continue;
            }
            let child_name = child.file_name().to_string_lossy().into_owned();
            let depth2 = format!("{depth1}/{child_name}");
            if child_name == "memory" && depth2.contains(project_slug) {
                candidates.push(depth2);
            }
        }
    }
    pick_best_candidate(&candidates)
}

/// Shortest path wins — worktree encodings strictly extend the main
/// project's encoding; equal lengths break lexicographically.
fn pick_best_candidate(candidates: &[String]) -> Option<String> {
    candidates
        .iter()
        .min_by(|a, b| a.len().cmp(&b.len()).then_with(|| a.cmp(b)))
        .cloned()
}

/// The checks, run against `dir`. Mirrors the script's `run_checks` output
/// line-for-line, including every heading and `✓`/`⚠`/`✗` verdict.
fn run_checks(
    dir: &str,
    cfg: &MemoryConfig,
    cwd: &Path,
    budget_only: bool,
    r: &mut Reporter,
) -> ChecksStatus {
    let memory_md = format!("{dir}/MEMORY.md");

    r.line("Checking router exists...");
    if !Path::new(&memory_md).is_file() {
        r.err(&format!("MEMORY.md not found in {dir}"));
        return ChecksStatus::Completed;
    }
    r.ok("MEMORY.md present");

    r.line(&format!(
        "Checking auto-load budget (≤ {} lines)...",
        cfg.budget
    ));
    let lines = count_newlines(Path::new(&memory_md)).unwrap_or(0) as i64;
    if lines > cfg.budget {
        r.err(&format!(
            "MEMORY.md is {lines} lines (lines past {} are silently truncated at session start)",
            cfg.budget
        ));
    } else {
        r.ok(&format!("MEMORY.md is {lines}/{} lines", cfg.budget));
    }

    if budget_only {
        return ChecksStatus::Completed;
    }

    r.line("Checking router rows point at real files...");
    let router = read_text_lossy(Path::new(&memory_md)).unwrap_or_default();
    let mut dead = false;
    for f in router_refs(&router) {
        if !Path::new(&format!("{dir}/{f}")).is_file() {
            r.err(&format!("router references missing topic file: {f}"));
            dead = true;
        }
    }
    if !dead {
        r.ok("all referenced topic files exist");
    }

    let topic_files = list_topic_files(dir);

    r.line("Checking every topic file has a router entry...");
    let mut orphans = false;
    for name in &topic_files {
        if !router.contains(name.as_str()) {
            r.err(&format!("orphan topic file (no router entry): {name}"));
            orphans = true;
        }
    }
    if !orphans {
        r.ok("no orphan topic files");
    }

    r.line("Checking topic-file frontmatter contract...");
    let mut fm_bad = false;
    for name in &topic_files {
        let content = read_text_lossy(Path::new(&format!("{dir}/{name}"))).unwrap_or_default();
        let fm = frontmatter_block(&content);
        for key in ["name:", "description:", "type:"] {
            if !fm.contains(key) {
                r.err(&format!(
                    "{name} missing frontmatter field: {} (required: name, description, metadata.type)",
                    key.trim_end_matches(':')
                ));
                fm_bad = true;
            }
        }
    }
    if !fm_bad {
        r.ok("frontmatter contract satisfied");
    }

    r.line(&format!(
        "Checking topic-file sizes (soft cap {} lines)...",
        cfg.soft_cap
    ));
    let mut oversize = false;
    for name in &topic_files {
        let lines = count_newlines(Path::new(&format!("{dir}/{name}"))).unwrap_or(0) as i64;
        if lines > cfg.soft_cap {
            r.warn(&format!(
                "{name} is {lines} lines (promote deep content to the vault, keep a pointer)"
            ));
            oversize = true;
        }
    }
    if !oversize {
        r.ok("all topic files within the soft cap");
    }

    r.line("Checking vault_refs resolve...");
    if Path::new(&cfg.vault_dir).is_dir() {
        let mut refs_bad = false;
        for name in &topic_files {
            let content = read_text_lossy(Path::new(&format!("{dir}/{name}"))).unwrap_or_default();
            let fm = frontmatter_block(&content);
            for vault_ref in extract_vault_refs(&fm) {
                if !doc_exists_under(Path::new(&cfg.vault_dir), &format!("{vault_ref}.md")) {
                    r.err(&format!(
                        "{name} vault_ref does not resolve: \"{vault_ref}\" (no {vault_ref}.md under {})",
                        cfg.vault_dir
                    ));
                    refs_bad = true;
                }
            }
        }
        if refs_bad {
            return ChecksStatus::AbortedByLastCheck;
        }
        r.ok("all vault_refs resolve");
    } else {
        r.warn(&format!(
            "vault dir '{}' not found from {} (skipping vault_refs check)",
            cfg.vault_dir,
            cwd.display()
        ));
    }
    ChecksStatus::Completed
}

/// Backticked `*.md` names in the router, sorted and deduplicated
/// (`grep -o ... | tr -d '\`' | sort -u`).
fn router_refs(router: &str) -> Vec<String> {
    let mut refs: Vec<String> = router_ref_re()
        .find_iter(router)
        .map(|m| m.as_str().trim_matches('`').to_string())
        .collect();
    refs.sort();
    refs.dedup();
    refs
}

/// `"$dir"/*.md` minus `MEMORY.md`: non-hidden regular files, sorted by name
/// (bash expands the glob in sorted order and skips dotfiles).
fn list_topic_files(dir: &str) -> Vec<String> {
    let mut names = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') || !name.ends_with(".md") || name == "MEMORY.md" {
                continue;
            }
            if fs::metadata(entry.path())
                .map(|m| m.is_file())
                .unwrap_or(false)
            {
                names.push(name);
            }
        }
    }
    names.sort();
    names
}

/// awk '/^---$/{n++; next} n==1{print} n>=2{exit}' — the lines strictly
/// between the first two `---` lines, joined with newlines.
fn frontmatter_block(content: &str) -> String {
    let mut lines: Vec<&str> = content.split('\n').collect();
    if content.ends_with('\n') {
        lines.pop(); // awk sees no empty trailing record
    }
    let mut markers = 0;
    let mut fm = Vec::new();
    for line in lines {
        if line == "---" {
            markers += 1;
            if markers >= 2 {
                break;
            }
            continue;
        }
        if markers == 1 {
            fm.push(line);
        }
    }
    fm.join("\n")
}

/// The `vault_refs:` list items from a frontmatter block: up to 100 lines
/// after the first `vault_refs:` line, keeping lines shaped like
/// `[ws]* - [ws]* item`, with one leading and one trailing quote stripped
/// (grep -A100 | tail -n +2 | sed).
fn extract_vault_refs(fm: &str) -> Vec<String> {
    let lines: Vec<&str> = fm.split('\n').collect();
    let Some(start) = lines.iter().position(|l| l.starts_with("vault_refs:")) else {
        return Vec::new();
    };
    let window = lines.iter().skip(start + 1).take(100);
    let mut refs = Vec::new();
    for line in window {
        // sed -n 's/^[[:space:]]*-[[:space:]]*//p' — POSIX space class.
        let posix_space = |c: char| matches!(c, ' ' | '\t' | '\u{000B}' | '\u{000C}' | '\r');
        let stripped = line.trim_start_matches(posix_space);
        let Some(item) = stripped.strip_prefix('-') else {
            continue;
        };
        let item = item.trim_start_matches(posix_space);
        // sed 's/^"//; s/"$//' — strip one quote from each end, independently.
        let item = item.strip_prefix('"').unwrap_or(item);
        let item = item.strip_suffix('"').unwrap_or(item);
        if item.is_empty() {
            continue; // the loop's [[ -z "$ref" ]] && continue
        }
        refs.push(item.to_string());
    }
    refs
}

/// `find "$vault_dir" -name "$name" -print -quit`: does any entry named
/// `name` exist under `vault_dir`? Hidden entries are visited (find has no
/// dot filter), directory symlinks are not followed (`find -P`), and any
/// entry type matches. The name is matched literally rather than as a glob —
/// vault refs are document titles, not patterns.
fn doc_exists_under(vault_dir: &Path, name: &str) -> bool {
    let Ok(entries) = fs::read_dir(vault_dir) else {
        return false;
    };
    for entry in entries.flatten() {
        if entry.file_name().to_string_lossy() == name {
            return true;
        }
        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false)
            && doc_exists_under(&entry.path(), name)
        {
            return true;
        }
    }
    false
}

// ── Self-test: run the checks against known-good and known-bad fixtures ─

const PASS_MEMORY_MD: &str = "# Lookup Protocol\n\
Row match → read the file.\n\
## Topic File Router\n\
| File | Covers |\n\
| --- | --- |\n\
| `testing.md` | test gotchas |\n";

const PASS_TESTING_MD: &str = "---\n\
name: testing\n\
description: test gotchas\n\
metadata:\n\
  type: project\n\
---\n\
- reset mocks between suites\n";

const FAIL_MEMORY_MD: &str = "# Router\n\
| File | Covers |\n\
| --- | --- |\n\
| `missing.md` | points nowhere |\n";

const FAIL_ORPHAN_MD: &str = "no frontmatter, no router row\n";

/// Removes the self-test scratch directory on drop (the script's
/// `trap 'rm -rf "$tmp"' EXIT`).
struct ScratchDir {
    path: PathBuf,
}

impl Drop for ScratchDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn self_test(cfg: &MemoryConfig, cwd: &Path, out: &mut dyn Write) -> i32 {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tmp =
        std::env::temp_dir().join(format!("hyphasma-selftest-{}-{nanos}", std::process::id()));
    let scratch = ScratchDir { path: tmp.clone() };

    let pass_dir = tmp.join("pass").join("memory");
    let fail_dir = tmp.join("fail").join("memory");
    let fixtures = [
        (pass_dir.join("MEMORY.md"), PASS_MEMORY_MD),
        (pass_dir.join("testing.md"), PASS_TESTING_MD),
        (fail_dir.join("MEMORY.md"), FAIL_MEMORY_MD),
        (fail_dir.join("orphan.md"), FAIL_ORPHAN_MD),
    ];
    for (path, content) in &fixtures {
        let parent = path.parent().unwrap_or(&tmp);
        if let Err(e) = fs::create_dir_all(parent).and_then(|()| fs::write(path, content)) {
            eprintln!("self-test: cannot write fixture {}: {e}", path.display());
            return 1;
        }
    }

    let _ = writeln!(out, "=== self-test: known-good fixture (expect PASS) ===");
    let good_errors = {
        let mut r = Reporter::new(out);
        run_checks(&pass_dir.to_string_lossy(), cfg, cwd, false, &mut r);
        r.counters.errors
    };
    if good_errors == 0 {
        let _ = writeln!(out, "  ✓ good fixture passes");
    } else {
        let _ = writeln!(out, "  ✗ SELF-TEST FAILED: good fixture reported errors");
        return 1;
    }

    let _ = writeln!(out, "=== self-test: known-bad fixture (expect FAIL) ===");
    let bad_errors = {
        let mut sink = std::io::sink();
        let mut r = Reporter::new(&mut sink);
        run_checks(&fail_dir.to_string_lossy(), cfg, cwd, false, &mut r);
        r.counters.errors
    };
    if bad_errors > 0 {
        let _ = writeln!(
            out,
            "  ✓ bad fixture correctly fails (dead row, orphan, missing frontmatter)"
        );
    } else {
        let _ = writeln!(out, "  ✗ SELF-TEST FAILED: bad fixture passed");
        return 1;
    }

    let _ = writeln!(out, "self-test OK");
    drop(scratch);
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn router_refs_are_sorted_and_deduplicated() {
        let router = "| `zzz.md` | z | `aaa.md` | not-a-ref.txt `aaa.md` `.md` |";
        assert_eq!(router_refs(router), vec![".md", "aaa.md", "zzz.md"]);
    }

    #[test]
    fn router_refs_reject_names_with_other_characters() {
        // A space or slash breaks the grep character class.
        assert!(router_refs("`has space.md` `dir/x.md`").is_empty());
        assert_eq!(router_refs("`ok-name_2.v1.md`"), vec!["ok-name_2.v1.md"]);
    }

    #[test]
    fn frontmatter_block_takes_lines_between_the_first_two_markers() {
        let fm = frontmatter_block("---\na: 1\nb: 2\n---\nbody\n---\nmore\n");
        assert_eq!(fm, "a: 1\nb: 2");
        assert_eq!(frontmatter_block("no markers at all\n"), "");
        // Unterminated frontmatter runs to EOF, like the awk program.
        assert_eq!(frontmatter_block("---\nonly: open\n"), "only: open");
    }

    #[test]
    fn extract_vault_refs_handles_quotes_spacing_and_blanks() {
        let fm = "name: x\nvault_refs:\n  - Known Doc\n  - \"Quoted Doc\"\n\t-\tTabbed Doc\nother: y\n  - Trailing List Item";
        assert_eq!(
            extract_vault_refs(fm),
            vec![
                "Known Doc",
                "Quoted Doc",
                "Tabbed Doc",
                // `grep -A100` swallows unrelated list items after the key —
                // the quirk is preserved.
                "Trailing List Item",
            ]
        );
        assert!(extract_vault_refs("name: x\n").is_empty());
        // `- ""` strips to empty and is skipped.
        assert!(extract_vault_refs("vault_refs:\n  - \"\"\n").is_empty());
    }

    #[test]
    fn extract_vault_refs_window_is_100_lines() {
        let mut fm = String::from("vault_refs:\n");
        for i in 0..100 {
            fm.push_str(&format!("  - Doc {i}\n"));
        }
        fm.push_str("  - Doc Beyond\n");
        let refs = extract_vault_refs(&fm);
        assert_eq!(refs.len(), 100);
        assert_eq!(refs.last().map(String::as_str), Some("Doc 99"));
    }

    #[test]
    fn best_candidate_is_shortest_then_lexicographic() {
        let c = |s: &str| s.to_string();
        assert_eq!(
            pick_best_candidate(&[c("/p/x-slug-wt/memory"), c("/p/x-slug/memory")]),
            Some("/p/x-slug/memory".to_string())
        );
        assert_eq!(
            pick_best_candidate(&[c("/p/b-slug/memory"), c("/p/a-slug/memory")]),
            Some("/p/a-slug/memory".to_string())
        );
        assert_eq!(pick_best_candidate(&[]), None);
    }
}
