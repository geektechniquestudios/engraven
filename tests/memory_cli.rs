//! Integration tests for `engraven memory`.
//!
//! Golden outputs were generated from `scripts/validate-memory.sh` — the
//! parity oracle. The `memory-project` fixture supplies the config (budget
//! 20, soft cap 20, vaultDir "vault", projectSlug "engraven-fixture-slug"),
//! a vault for vault_refs resolution, and good/bad memory directories.

mod common;

use std::fs;

use common::{TestDir, code_of, fixture, golden, run_in, stderr_of, stdout_of};

#[test]
fn good_memory_dir_passes_every_check() {
    let dir = fixture("memory-project");
    let out = run_in(&dir, &["memory", "--memory-dir", "memory-good"], &[]);
    assert_eq!(stdout_of(&out), golden("memory-good.txt", &[]));
    assert_eq!(code_of(&out), 0);
}

#[test]
fn bad_memory_dir_fails_and_aborts_before_the_summary() {
    // The shell script dies from `set -e` when the final vault_refs check
    // records a failure, so a run with unresolved vault_refs prints no
    // summary block. That quirk is part of the output contract.
    let dir = fixture("memory-project");
    let out = run_in(&dir, &["memory", "--memory-dir", "memory-bad"], &[]);
    let text = stdout_of(&out);
    assert_eq!(text, golden("memory-bad.txt", &[]));
    assert!(!text.contains("=== Summary ==="));
    assert_eq!(code_of(&out), 1);

    // The bad fixture covers every check the linter can fail.
    for needle in [
        "MEMORY.md is 22 lines — lines past 20 are silently truncated at session start", // 2
        "router references missing topic file: aaa_gone.md",                             // 3
        "router references missing topic file: zzz_gone.md",                             // 3
        "orphan topic file (no router entry): topic_orphan.md",                          // 4
        "topic_bad.md missing frontmatter field: description (required: name, description, metadata.type)", // 5
        "topic_bad.md missing frontmatter field: type (required: name, description, metadata.type)", // 5
        "topic_long.md is 22 lines — promote deep content to the vault, keep a pointer", // 6
        "topic_bad.md vault_ref does not resolve: \"Ghost Doc\" (no Ghost Doc.md under vault)", // 7
    ] {
        assert!(text.contains(needle), "missing: {needle}");
    }
}

#[test]
fn failing_run_without_vault_ref_errors_reaches_the_summary() {
    let dir = fixture("memory-project");
    let out = run_in(&dir, &["memory", "--memory-dir", "memory-bad2"], &[]);
    let text = stdout_of(&out);
    assert_eq!(text, golden("memory-bad2.txt", &[]));
    assert!(text.contains("=== Summary ==="));
    assert!(text.ends_with("FAIL — fix memory errors before moving on\n"));
    assert_eq!(code_of(&out), 1);
}

#[test]
fn budget_only_runs_checks_1_and_2_then_summarizes() {
    let dir = fixture("memory-project");
    let out = run_in(
        &dir,
        &["memory", "--memory-dir", "memory-bad", "--budget-only"],
        &[],
    );
    assert_eq!(stdout_of(&out), golden("memory-budget.txt", &[]));
    assert_eq!(code_of(&out), 1);

    // --ci is an exact alias.
    let ci = run_in(&dir, &["memory", "--ci", "--memory-dir", "memory-bad"], &[]);
    assert_eq!(stdout_of(&ci), golden("memory-budget.txt", &[]));
    assert_eq!(code_of(&ci), 1);
}

#[test]
fn missing_router_in_existing_dir_fails_with_summary() {
    let dir = fixture("memory-project");
    let out = run_in(&dir, &["memory", "--memory-dir", "memory-empty"], &[]);
    assert_eq!(stdout_of(&out), golden("memory-empty.txt", &[]));
    assert_eq!(code_of(&out), 1);
}

#[test]
fn nonexistent_memory_dir_skips_cleanly() {
    let dir = fixture("memory-project");
    let out = run_in(
        &dir,
        &["memory", "--memory-dir", "/tmp/no-such-dir-xyz"],
        &[],
    );
    assert_eq!(stdout_of(&out), golden("memory-skip.txt", &[]));
    assert_eq!(code_of(&out), 0);
}

#[test]
fn env_var_supplies_the_memory_dir_and_the_flag_beats_it() {
    let dir = fixture("memory-project");
    let via_env = run_in(&dir, &["memory"], &[("ENGRAVEN_MEMORY_DIR", "memory-good")]);
    assert_eq!(stdout_of(&via_env), golden("memory-good.txt", &[]));
    assert_eq!(code_of(&via_env), 0);

    // Explicit flag wins over the environment.
    let flag_wins = run_in(
        &dir,
        &["memory", "--memory-dir", "memory-good"],
        &[("ENGRAVEN_MEMORY_DIR", "memory-bad2")],
    );
    assert_eq!(stdout_of(&flag_wins), golden("memory-good.txt", &[]));

    // An empty env var counts as unset and discovery finds nothing under an
    // empty HOME → skip.
    let home = TestDir::new("empty-home");
    let home_str = home.path().display().to_string();
    let empty_env = run_in(
        &dir,
        &["memory"],
        &[("ENGRAVEN_MEMORY_DIR", ""), ("HOME", home_str.as_str())],
    );
    assert_eq!(stdout_of(&empty_env), golden("memory-skip.txt", &[]));
    assert_eq!(code_of(&empty_env), 0);
}

#[test]
fn discovery_picks_the_shortest_matching_path() {
    let home = TestDir::new("fake-home");
    let projects = home.path().join(".claude/projects");
    let short = projects.join("x-engraven-fixture-slug/memory");
    let long = projects.join("x-engraven-fixture-slug-worktree/memory");
    fs::create_dir_all(&short).unwrap();
    fs::create_dir_all(&long).unwrap();
    // Non-matching depth-1 "memory" dir must be ignored.
    fs::create_dir_all(projects.join("memory")).unwrap();
    let source = fixture("memory-project").join("memory-good");
    fs::copy(source.join("MEMORY.md"), short.join("MEMORY.md")).unwrap();
    fs::copy(source.join("topic_a.md"), short.join("topic_a.md")).unwrap();

    let home_str = home.path().display().to_string();
    let out = run_in(
        &fixture("memory-project"),
        &["memory", "--budget-only"],
        &[("HOME", home_str.as_str())],
    );
    let text = stdout_of(&out);
    assert!(
        text.starts_with(&format!(
            "engraven validate-memory · {home_str}/.claude/projects/x-engraven-fixture-slug/memory\n"
        )),
        "unexpected header: {text}"
    );
    assert!(text.contains("MEMORY.md is 6/20 lines"));
    assert_eq!(code_of(&out), 0);
}

#[test]
fn no_discoverable_memory_dir_skips_cleanly() {
    let home = TestDir::new("bare-home");
    let home_str = home.path().display().to_string();
    let out = run_in(
        &fixture("memory-project"),
        &["memory"],
        &[("HOME", home_str.as_str())],
    );
    assert_eq!(stdout_of(&out), golden("memory-skip.txt", &[]));
    assert_eq!(code_of(&out), 0);
}

#[test]
fn self_test_uses_the_working_directory_config() {
    // From memory-project the config sets budget/soft-cap 20 and the vault
    // exists, so the good fixture ends with "all vault_refs resolve".
    let out = run_in(&fixture("memory-project"), &["memory", "--self-test"], &[]);
    assert_eq!(stdout_of(&out), golden("memory-selftest-project.txt", &[]));
    assert_eq!(code_of(&out), 0);
}

#[test]
fn self_test_with_defaults_warns_about_the_missing_vault_dir() {
    // From a bare directory the defaults apply (budget 200, docs/vault) and
    // the vault_refs check is skipped with a warning naming the cwd.
    let scratch = TestDir::new("selftest-cwd");
    let cwd = scratch.path().display().to_string();
    let out = run_in(scratch.path(), &["memory", "--self-test"], &[]);
    assert_eq!(
        stdout_of(&out),
        golden("memory-selftest-defaults.txt", &[("__CWD__", cwd.as_str())])
    );
    assert_eq!(code_of(&out), 0);
}

#[test]
fn memory_dir_without_a_value_exits_1_silently() {
    // Mirrors the script: `--memory-dir` as the last argument kills bash via
    // `set -e` on the failing `shift` — exit 1, no output.
    let dir = fixture("memory-project");
    let out = run_in(&dir, &["memory", "--memory-dir"], &[]);
    assert_eq!(code_of(&out), 1);
    assert_eq!(stdout_of(&out), "");
    assert_eq!(stderr_of(&out), "");
}

#[test]
fn unknown_argument_exits_2() {
    let dir = fixture("memory-project");
    let out = run_in(&dir, &["memory", "--bogus"], &[]);
    assert_eq!(code_of(&out), 2);
    assert_eq!(stdout_of(&out), "");
    assert_eq!(stderr_of(&out), "Unknown argument: --bogus\n");
}
