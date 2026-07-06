//! Integration tests for `engraven vault` (and the shared CLI surface).
//!
//! Golden outputs were generated from `scripts/vault-check.mjs` — the parity
//! oracle. The fixtures exercise all 11 checks; `vault-bad` triggers every
//! one of them at least once.

mod common;

use std::fs;

use common::{TestDir, code_of, copy_dir_all, fixture, golden, run_in, stderr_of, stdout_of};

fn vault_path_of(fixture_name: &str) -> String {
    fixture(fixture_name).join("vault").display().to_string()
}

#[test]
fn clean_vault_reports_clean() {
    let dir = fixture("vault-clean");
    let out = run_in(&dir, &["vault"], &[]);
    assert_eq!(
        stdout_of(&out),
        golden(
            "vault-clean.txt",
            &[("__VAULT__", &vault_path_of("vault-clean"))]
        )
    );
    assert_eq!(code_of(&out), 0);
    assert_eq!(stderr_of(&out), "");
}

#[test]
fn clean_vault_is_clean_even_under_strict() {
    let dir = fixture("vault-clean");
    let out = run_in(&dir, &["vault", "--strict"], &[]);
    assert_eq!(code_of(&out), 0);
}

#[test]
fn bad_vault_reports_every_check_and_exits_1() {
    let dir = fixture("vault-bad");
    let out = run_in(&dir, &["vault"], &[]);
    let expected = golden(
        "vault-bad.txt",
        &[("__VAULT__", &vault_path_of("vault-bad"))],
    );
    assert_eq!(stdout_of(&out), expected);
    assert_eq!(code_of(&out), 1);

    // The fixture covers all 11 checks; pin one message per check so the
    // golden cannot silently lose coverage.
    for needle in [
        "broken link: [[Missing Doc]] in 00-Index.md", // 1
        "duplicate title \"Alpha Doc\": Alpha Doc.md · KB1/Alpha Doc.md (wiki-links resolve ambiguously)", // 2
        "missing frontmatter [tags, date]: Orphan Doc.md", // 3
        "orphan doc (nothing links to it): Orphan Doc.md", // 4
        "KB \"KB1\" has no \"* - Meta-Analysis.md\" entry point", // 5
        "not covered by its KB's hub/meta-analysis: KB2/Beta Uncovered.md", // 5
        "stub doc (2 non-empty lines): Orphan Doc.md",     // 6
        "unresolved placeholders {{TITLE}} {{DATE}}: Orphan Doc.md (run the bootstrap's placeholder pass)", // 7
        "stale count \"kbs\" in 00-Index.md: 99 → 3 (run --fix)", // 8
        "stale count \"vault-docs\" in COUNTS.md: 999 → 13 (run --fix)", // 8 (countFiles)
        "unknown count directive \"count:kb:Nope\" in COUNTS.md", // 8
        "KB \"KB3\" is not reachable from an entry point (00-Index / Research Library)", // 9
        "archive entry not listed in the archive index: Session-Archive/2026-01-02 Session.md", // 10
        "solitary doc (no outgoing wiki-links; weave it into the graph): Session-Archive/2026-01-02 Session.md", // 11
    ] {
        assert!(
            expected.contains(needle),
            "golden lost coverage of: {needle}"
        );
    }
}

#[test]
fn allow_placeholders_skips_check_7_only() {
    let dir = fixture("vault-bad");
    let out = run_in(&dir, &["vault", "--allow-placeholders"], &[]);
    let expected = golden(
        "vault-bad-allow-placeholders.txt",
        &[("__VAULT__", &vault_path_of("vault-bad"))],
    );
    assert_eq!(stdout_of(&out), expected);
    assert!(!expected.contains("unresolved placeholders"));
    assert_eq!(code_of(&out), 1);
}

#[test]
fn quiet_suppresses_output_but_keeps_the_exit_code() {
    let dir = fixture("vault-bad");
    let out = run_in(&dir, &["vault", "--quiet"], &[]);
    assert_eq!(stdout_of(&out), "");
    assert_eq!(code_of(&out), 1);

    let clean = run_in(&fixture("vault-clean"), &["vault", "--quiet"], &[]);
    assert_eq!(stdout_of(&clean), "");
    assert_eq!(code_of(&clean), 0);
}

#[test]
fn strict_turns_warnings_into_exit_1() {
    // vault-fix has warnings (stale counts) but no errors.
    let dir = fixture("vault-fix");
    let plain = run_in(&dir, &["vault"], &[]);
    assert_eq!(code_of(&plain), 0);
    let strict = run_in(&dir, &["vault", "--strict"], &[]);
    assert_eq!(code_of(&strict), 1);
}

#[test]
fn fix_rewrites_count_directives_exactly_and_is_idempotent() {
    let scratch = TestDir::new("vault-fix");
    copy_dir_all(&fixture("vault-fix"), scratch.path());
    let vault_abs = scratch.path().join("vault").display().to_string();
    let subs: [(&str, &str); 1] = [("__VAULT__", &vault_abs)];

    // Pre-fix report: three stale directives + one in the countFiles target.
    let pre = run_in(scratch.path(), &["vault"], &[]);
    assert_eq!(stdout_of(&pre), golden("vault-fix-1.txt", &subs));
    assert_eq!(code_of(&pre), 0);

    // --fix rewrites four directives and reports the refresh.
    let fix = run_in(scratch.path(), &["vault", "--fix"], &[]);
    assert_eq!(stdout_of(&fix), golden("vault-fix-2.txt", &subs));
    assert_eq!(code_of(&fix), 0);

    // Rewritten bytes match the oracle exactly: duplicate directives both
    // fixed, the multi-line span canonicalized, fresh + unknown untouched.
    let index = fs::read_to_string(scratch.path().join("vault/00-Index.md")).unwrap();
    assert_eq!(index, golden("vault-fix-00-Index-fixed.md", &[]));
    let notes = fs::read_to_string(scratch.path().join("NOTES.md")).unwrap();
    assert_eq!(notes, golden("vault-fix-NOTES-fixed.md", &[]));

    // Post-fix report: only the unknown-directive warning remains.
    let post = run_in(scratch.path(), &["vault"], &[]);
    assert_eq!(stdout_of(&post), golden("vault-fix-3.txt", &subs));

    // A second --fix run rewrites nothing.
    let again = run_in(scratch.path(), &["vault", "--fix"], &[]);
    assert_eq!(stdout_of(&again), golden("vault-fix-4.txt", &subs));
    assert!(!stdout_of(&again).contains("refreshed"));
}

#[test]
fn vault_flag_without_value_falls_back_to_config() {
    // Mirrors the .mjs: `--vault` as the last token reads undefined and the
    // config's vaultDir applies.
    let dir = fixture("vault-clean");
    let out = run_in(&dir, &["vault", "--vault"], &[]);
    assert_eq!(
        stdout_of(&out),
        golden(
            "vault-clean.txt",
            &[("__VAULT__", &vault_path_of("vault-clean"))]
        )
    );
    assert_eq!(code_of(&out), 0);
}

#[test]
fn missing_vault_dir_exits_2_with_guidance() {
    let dir = fixture("vault-clean");
    let out = run_in(&dir, &["vault", "--vault", "nope"], &[]);
    assert_eq!(code_of(&out), 2);
    assert_eq!(stdout_of(&out), "");
    let err = stderr_of(&out);
    assert!(err.contains("Vault directory not found: "), "stderr: {err}");
    assert!(
        err.contains("(set \"vaultDir\" in engraven.config.json or pass --vault <dir>)"),
        "stderr: {err}"
    );
}

#[test]
fn unknown_argument_exits_2() {
    let dir = fixture("vault-clean");
    let out = run_in(&dir, &["vault", "--bogus"], &[]);
    assert_eq!(code_of(&out), 2);
    assert_eq!(stdout_of(&out), "");
    assert_eq!(stderr_of(&out), "Unknown argument: --bogus\n");
}

#[test]
fn invalid_config_json_exits_2() {
    let dir = fixture("vault-badjson");
    let out = run_in(&dir, &["vault"], &[]);
    assert_eq!(code_of(&out), 2);
    assert!(
        stderr_of(&out).starts_with("engraven.config.json is not valid JSON:"),
        "stderr: {}",
        stderr_of(&out)
    );
}

#[test]
fn version_and_help_surface() {
    let dir = fixture("vault-clean");

    let version = run_in(&dir, &["--version"], &[]);
    assert_eq!(stdout_of(&version), "engraven 0.2.0\n");
    assert_eq!(code_of(&version), 0);

    let help = run_in(&dir, &["--help"], &[]);
    assert_eq!(code_of(&help), 0);
    assert!(stdout_of(&help).contains("Usage:"));

    let vault_help = run_in(&dir, &["vault", "--help"], &[]);
    assert_eq!(code_of(&vault_help), 0);
    let text = stdout_of(&vault_help);
    assert!(text.contains(
        "Usage: engraven vault [--vault <dir>] [--strict] [--fix] [--allow-placeholders] [--quiet]"
    ));

    let memory_help = run_in(&dir, &["memory", "--help"], &[]);
    assert_eq!(code_of(&memory_help), 0);
    assert!(stdout_of(&memory_help).contains(
        "Usage: engraven memory [--budget-only|--ci] [--memory-dir <dir>] [--self-test]"
    ));

    let check_help = run_in(&dir, &["check", "--help"], &[]);
    assert_eq!(code_of(&check_help), 0);
    assert!(stdout_of(&check_help).contains("Usage: engraven check"));

    let bare = run_in(&dir, &[], &[]);
    assert_eq!(code_of(&bare), 2);
    assert_eq!(stdout_of(&bare), "");
    assert!(stderr_of(&bare).contains("Usage:"));

    let unknown = run_in(&dir, &["frobnicate"], &[]);
    assert_eq!(code_of(&unknown), 2);
    assert!(stderr_of(&unknown).contains("Unknown command: frobnicate"));
}

#[test]
fn check_runs_vault_then_memory_and_combines_exit_codes() {
    // Clean vault + no memory dir anywhere → vault output, memory skip, 0.
    let home = TestDir::new("check-home");
    let home_str = home.path().display().to_string();
    let dir = fixture("vault-clean");
    let out = run_in(&dir, &["check"], &[("HOME", home_str.as_str())]);
    let vault_part = golden(
        "vault-clean.txt",
        &[("__VAULT__", &vault_path_of("vault-clean"))],
    );
    let expected = format!(
        "{vault_part}No memory directory found for project 'vault-clean-fixture' — skipping.\n\
         (normal on CI runners; locally, pass --memory-dir or set ENGRAVEN_MEMORY_DIR)\n"
    );
    assert_eq!(stdout_of(&out), expected);
    assert_eq!(code_of(&out), 0);

    // Bad vault → combined exit is the vault linter's 1.
    let bad = run_in(
        &fixture("vault-bad"),
        &["check"],
        &[("HOME", home_str.as_str())],
    );
    assert_eq!(code_of(&bad), 1);
    let text = stdout_of(&bad);
    assert!(text.contains("engraven vault-check"));
    assert!(text.contains("No memory directory found"));

    // Extra arguments are rejected.
    let extra = run_in(&dir, &["check", "--fast"], &[]);
    assert_eq!(code_of(&extra), 2);
    assert_eq!(stderr_of(&extra), "Unknown argument: --fast\n");
}
