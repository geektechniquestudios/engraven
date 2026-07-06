//! Shared helpers for the CLI integration tests.
//!
//! Tests run the compiled `engraven` binary against fixture trees under
//! `tests/fixtures/` and compare full stdout against golden files under
//! `tests/expected/`, which were generated from the original scripts
//! (`scripts/vault-check.mjs`, `scripts/validate-memory.sh`) — the scripts
//! are the parity oracle. Goldens use `__VAULT__` / `__CWD__` placeholders
//! for machine-specific absolute paths. Paths are POSIX-style, like the
//! scripts themselves (the shell linter never ran on Windows).

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::sync::atomic::{AtomicUsize, Ordering};

pub fn bin() -> &'static str {
    env!("CARGO_BIN_EXE_engraven")
}

/// Canonicalized fixture directory (canonical so it matches the child
/// process's `getcwd`-based output even when the checkout path involves
/// symlinks).
pub fn fixture(name: &str) -> PathBuf {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures")
        .join(name);
    path.canonicalize()
        .unwrap_or_else(|e| panic!("fixture {name} missing: {e}"))
}

/// A golden file with placeholders substituted.
pub fn golden(name: &str, substitutions: &[(&str, &str)]) -> String {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/expected")
        .join(name);
    let mut text =
        fs::read_to_string(&path).unwrap_or_else(|e| panic!("golden {name} missing: {e}"));
    for (from, to) in substitutions {
        text = text.replace(from, to);
    }
    text
}

/// Run the binary with a controlled environment: `ENGRAVEN_MEMORY_DIR` is
/// always cleared; extra vars come from `envs`.
pub fn run_in(cwd: &Path, args: &[&str], envs: &[(&str, &str)]) -> Output {
    let mut cmd = Command::new(bin());
    cmd.args(args)
        .current_dir(cwd)
        .env_remove("ENGRAVEN_MEMORY_DIR");
    for (k, v) in envs {
        cmd.env(k, v);
    }
    cmd.output().expect("failed to run engraven binary")
}

pub fn stdout_of(output: &Output) -> String {
    String::from_utf8_lossy(&output.stdout).into_owned()
}

pub fn stderr_of(output: &Output) -> String {
    String::from_utf8_lossy(&output.stderr).into_owned()
}

pub fn code_of(output: &Output) -> i32 {
    output.status.code().expect("process terminated by signal")
}

/// Self-cleaning scratch directory (canonicalized, unique per call).
pub struct TestDir {
    path: PathBuf,
}

impl TestDir {
    pub fn new(label: &str) -> Self {
        static COUNTER: AtomicUsize = AtomicUsize::new(0);
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let path =
            std::env::temp_dir().join(format!("engraven-test-{label}-{}-{n}", std::process::id()));
        fs::create_dir_all(&path).expect("create test dir");
        let path = path.canonicalize().expect("canonicalize test dir");
        TestDir { path }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TestDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

/// Recursively copy a fixture tree into scratch space.
///
/// Each integration-test binary compiles this module independently; this
/// helper is used by `vault_cli` only, so `memory_cli`'s copy would otherwise
/// trip `-D dead_code`.
#[allow(dead_code)]
pub fn copy_dir_all(from: &Path, to: &Path) {
    fs::create_dir_all(to).expect("create copy target");
    for entry in fs::read_dir(from).expect("read copy source") {
        let entry = entry.expect("read dir entry");
        let target = to.join(entry.file_name());
        if entry.file_type().expect("file type").is_dir() {
            copy_dir_all(&entry.path(), &target);
        } else {
            fs::copy(entry.path(), &target).expect("copy file");
        }
    }
}
