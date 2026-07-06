//! `engraven.config.json` loading.
//!
//! Both linters read the config from the *current working directory*, exactly
//! like the scripts they replace. They differ in how they treat a broken
//! config, and each side of that difference is mirrored here:
//!
//! - `vault-check.mjs` exits 2 with a message when the JSON is invalid
//!   (see [`vault_config`]).
//! - `validate-memory.sh` pipes the config through `node -e` with stderr
//!   suppressed, so a missing or invalid config silently falls back to the
//!   defaults (see [`memory_config`]).

use std::path::Path;

use serde_json::Value;

pub const CONFIG_FILE: &str = "engraven.config.json";

/// Config keys consumed by `engraven vault` (`vault-check.mjs` parity).
#[derive(Debug, Default)]
pub struct VaultConfig {
    pub vault_dir: Option<String>,
    pub require_frontmatter: Vec<String>,
    pub session_archive_dir: String,
    pub count_files: Vec<String>,
}

/// Config keys consumed by `engraven memory` (`validate-memory.sh` parity).
#[derive(Debug)]
pub struct MemoryConfig {
    pub budget: i64,
    pub soft_cap: i64,
    pub vault_dir: String,
    pub project_slug: String,
}

/// Load the config for the vault linter. `Err` carries the message to print
/// on stderr before exiting 2 (mirrors the `.mjs` behavior for invalid JSON).
pub fn vault_config() -> Result<VaultConfig, String> {
    let root = match read_config_value()? {
        Some(v) => v,
        None => Value::Null,
    };
    Ok(VaultConfig {
        vault_dir: get_string(&root, "vaultDir"),
        require_frontmatter: get_string_list(&root, "requireFrontmatter")
            .unwrap_or_else(|| vec!["tags".to_string(), "date".to_string()]),
        session_archive_dir: get_string(&root, "sessionArchiveDir")
            .unwrap_or_else(|| "Session-Archive".to_string()),
        count_files: get_string_list(&root, "countFiles").unwrap_or_default(),
    })
}

/// Load the config for the memory linter. Missing or invalid config falls
/// back to defaults silently, mirroring the shell script's `cfg()` helper.
pub fn memory_config(cwd: &Path) -> MemoryConfig {
    let root = read_config_value().ok().flatten().unwrap_or(Value::Null);
    let default_slug = cwd
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| cwd.to_string_lossy().into_owned());
    MemoryConfig {
        budget: get_int(&root, "memoryBudget").unwrap_or(200),
        soft_cap: get_int(&root, "topicFileSoftCap").unwrap_or(150),
        vault_dir: get_string(&root, "vaultDir").unwrap_or_else(|| "docs/vault".to_string()),
        project_slug: get_string(&root, "projectSlug").unwrap_or(default_slug),
    }
}

/// Read and parse `engraven.config.json` from the working directory.
/// `Ok(None)` means the file does not exist; `Err` carries the exit-2 message.
fn read_config_value() -> Result<Option<Value>, String> {
    let path = Path::new(CONFIG_FILE);
    if !path.exists() {
        return Ok(None);
    }
    let raw = crate::util::read_text_lossy(path)
        .map_err(|e| format!("{CONFIG_FILE} is not valid JSON: {e}"))?;
    let value: Value =
        serde_json::from_str(&raw).map_err(|e| format!("{CONFIG_FILE} is not valid JSON: {e}"))?;
    Ok(Some(value))
}

/// String-valued key. Numbers and booleans are stringified (the shell
/// script's `String(v)`); other types count as absent. `null` falls through
/// to the default, matching the `??` / `!== null` guards in both scripts.
fn get_string(root: &Value, key: &str) -> Option<String> {
    match root.get(key)? {
        Value::String(s) => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        Value::Bool(b) => Some(b.to_string()),
        _ => None,
    }
}

/// Array-of-strings key; primitive items are stringified, non-primitives are
/// skipped. Non-array values count as absent.
fn get_string_list(root: &Value, key: &str) -> Option<Vec<String>> {
    let items = root.get(key)?.as_array()?;
    Some(
        items
            .iter()
            .filter_map(|v| match v {
                Value::String(s) => Some(s.clone()),
                Value::Number(n) => Some(n.to_string()),
                Value::Bool(b) => Some(b.to_string()),
                _ => None,
            })
            .collect(),
    )
}

/// Integer-valued key; numeric strings are accepted. Anything else counts as
/// absent so the schema defaults apply (the shell script would degrade into
/// bash arithmetic on garbage here; falling back to the default is the one
/// deliberate divergence, and it only triggers on schema-invalid configs).
fn get_int(root: &Value, key: &str) -> Option<i64> {
    match root.get(key)? {
        Value::Number(n) => n.as_i64(),
        Value::String(s) => s.trim().parse().ok(),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn string_extraction_stringifies_primitives() {
        let v = json!({ "a": "x", "b": 7, "c": true, "d": null, "e": ["x"] });
        assert_eq!(get_string(&v, "a").as_deref(), Some("x"));
        assert_eq!(get_string(&v, "b").as_deref(), Some("7"));
        assert_eq!(get_string(&v, "c").as_deref(), Some("true"));
        assert_eq!(get_string(&v, "d"), None);
        assert_eq!(get_string(&v, "e"), None);
        assert_eq!(get_string(&v, "missing"), None);
    }

    #[test]
    fn int_extraction_accepts_numbers_and_numeric_strings() {
        let v = json!({ "n": 42, "s": "17", "f": 1.5, "junk": "abc" });
        assert_eq!(get_int(&v, "n"), Some(42));
        assert_eq!(get_int(&v, "s"), Some(17));
        assert_eq!(get_int(&v, "f"), None);
        assert_eq!(get_int(&v, "junk"), None);
    }

    #[test]
    fn list_extraction_keeps_order_and_skips_non_primitives() {
        let v = json!({ "l": ["a", 2, {"x": 1}, "b"] });
        assert_eq!(
            get_string_list(&v, "l"),
            Some(vec!["a".to_string(), "2".to_string(), "b".to_string()])
        );
        assert_eq!(get_string_list(&v, "missing"), None);
    }
}
