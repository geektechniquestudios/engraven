//! Check 8 of the vault linter: `<!-- count:name -->N<!-- /count -->`
//! directives. Parsing, staleness warnings, and `--fix` rewriting mirror
//! `vault-check.mjs` byte-for-byte, including its fix algorithm: each regex
//! match found in the *original* text replaces the first occurrence of that
//! exact directive text still present in the *updated* text (JavaScript's
//! `String.replace(string, string)` semantics).

use std::collections::HashMap;
use std::sync::OnceLock;

use regex::Regex;

use crate::util::{JS_WS_CLASS, js_trim};

fn count_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        // /<!-- count:([A-Za-z0-9:_-]+) -->\s*([^<]*?)\s*<!-- \/count -->/g
        // with \s expanded to JavaScript's exact whitespace class.
        let pattern = format!(
            "<!-- count:([A-Za-z0-9:_-]+) -->{ws}*([^<]*?){ws}*<!-- /count -->",
            ws = JS_WS_CLASS
        );
        Regex::new(&pattern).expect("count directive regex is a fixed, valid pattern")
    })
}

/// Vault-wide statistics the count vocabulary is answered from.
pub struct CountStats {
    pub vault_docs: usize,
    pub kb_dirs: Vec<String>,
    pub hubs: usize,
    pub meta_analyses: usize,
    pub archive_entries: usize,
    /// Doc count per KB directory; keys are exactly `kb_dirs`.
    pub kb_doc_counts: HashMap<String, usize>,
}

/// `countValue(name)` from the script: `None` means "unknown directive".
pub fn count_value(stats: &CountStats, name: &str) -> Option<usize> {
    match name {
        "vault-docs" => Some(stats.vault_docs),
        "kbs" => Some(stats.kb_dirs.len()),
        "hubs" => Some(stats.hubs),
        "meta-analyses" => Some(stats.meta_analyses),
        "archive-entries" => Some(stats.archive_entries),
        _ => {
            let kb = name.strip_prefix("kb:")?;
            if stats.kb_dirs.iter().any(|d| d == kb) {
                stats.kb_doc_counts.get(kb).copied()
            } else {
                None
            }
        }
    }
}

/// Result of scanning (and optionally fixing) one file's count directives.
pub struct ScanOutcome {
    /// File content after fixes; equals the input when nothing was rewritten.
    pub updated: String,
    /// Number of directives rewritten (only ever non-zero with `fix`).
    pub fixed: usize,
    /// Warnings in the exact wording and order the script emits.
    pub warnings: Vec<String>,
}

/// Scan `raw` for count directives. `where_label` is the path string used in
/// messages (vault-relative inside the vault, cwd-relative outside it).
pub fn scan_counts(raw: &str, where_label: &str, fix: bool, stats: &CountStats) -> ScanOutcome {
    let mut updated = raw.to_string();
    let mut fixed = 0;
    let mut warnings = Vec::new();
    for caps in count_re().captures_iter(raw) {
        let directive = &caps[0];
        let name = &caps[1];
        let found = js_trim(&caps[2]);
        let Some(expected) = count_value(stats, name) else {
            warnings.push(format!(
                "unknown count directive \"count:{name}\" in {where_label}"
            ));
            continue;
        };
        if found != expected.to_string() {
            if fix {
                let replacement = format!("<!-- count:{name} -->{expected}<!-- /count -->");
                updated = updated.replacen(directive, &replacement, 1);
                fixed += 1;
            } else {
                let shown = if found.is_empty() { "(empty)" } else { found };
                warnings.push(format!(
                    "stale count \"{name}\" in {where_label}: {shown} → {expected} (run --fix)"
                ));
            }
        }
    }
    ScanOutcome {
        updated,
        fixed,
        warnings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stats() -> CountStats {
        CountStats {
            vault_docs: 13,
            kb_dirs: vec!["KB2".to_string(), "KB1".to_string()],
            hubs: 1,
            meta_analyses: 2,
            archive_entries: 2,
            kb_doc_counts: HashMap::from([("KB2".to_string(), 4), ("KB1".to_string(), 1)]),
        }
    }

    #[test]
    fn count_value_covers_the_vocabulary() {
        let s = stats();
        assert_eq!(count_value(&s, "vault-docs"), Some(13));
        assert_eq!(count_value(&s, "kbs"), Some(2));
        assert_eq!(count_value(&s, "hubs"), Some(1));
        assert_eq!(count_value(&s, "meta-analyses"), Some(2));
        assert_eq!(count_value(&s, "archive-entries"), Some(2));
        assert_eq!(count_value(&s, "kb:KB2"), Some(4));
        assert_eq!(count_value(&s, "kb:Nope"), None);
        assert_eq!(count_value(&s, "bogus"), None);
    }

    #[test]
    fn stale_fresh_empty_and_unknown_warnings() {
        let raw = "a <!-- count:vault-docs -->9<!-- /count --> \
                   b <!-- count:hubs -->1<!-- /count --> \
                   c <!-- count:kbs --><!-- /count --> \
                   d <!-- count:bogus -->7<!-- /count -->";
        let out = scan_counts(raw, "X.md", false, &stats());
        assert_eq!(out.fixed, 0);
        assert_eq!(out.updated, raw);
        assert_eq!(
            out.warnings,
            vec![
                "stale count \"vault-docs\" in X.md: 9 → 13 (run --fix)",
                "stale count \"kbs\" in X.md: (empty) → 2 (run --fix)",
                "unknown count directive \"count:bogus\" in X.md",
            ]
        );
    }

    #[test]
    fn fix_rewrites_duplicates_and_multiline_spans() {
        // Two identical stale directives plus a directive whose value spans
        // lines: the .mjs fixes all three and canonicalizes the span.
        let raw = "x <!-- count:vault-docs -->9<!-- /count --> y \
                   <!-- count:vault-docs -->9<!-- /count -->\n\
                   w <!-- count:hubs -->\n  0 <!-- /count -->\n\
                   keep <!-- count:meta-analyses -->2<!-- /count -->\n\
                   odd <!-- count:bogus -->7<!-- /count -->\n";
        let out = scan_counts(raw, "X.md", true, &stats());
        assert_eq!(out.fixed, 3);
        assert_eq!(
            out.updated,
            "x <!-- count:vault-docs -->13<!-- /count --> y \
             <!-- count:vault-docs -->13<!-- /count -->\n\
             w <!-- count:hubs -->1<!-- /count -->\n\
             keep <!-- count:meta-analyses -->2<!-- /count -->\n\
             odd <!-- count:bogus -->7<!-- /count -->\n"
        );
        // Unknown directives still warn in fix mode.
        assert_eq!(
            out.warnings,
            vec!["unknown count directive \"count:bogus\" in X.md"]
        );
    }

    #[test]
    fn fix_is_idempotent() {
        let raw = "n = <!-- count:vault-docs -->9<!-- /count -->";
        let first = scan_counts(raw, "X.md", true, &stats());
        assert_eq!(first.fixed, 1);
        let second = scan_counts(&first.updated, "X.md", true, &stats());
        assert_eq!(second.fixed, 0);
        assert_eq!(second.updated, first.updated);
    }

    #[test]
    fn value_with_js_only_whitespace_is_trimmed_like_the_script() {
        // U+FEFF is whitespace to JavaScript's trim but not to Rust's.
        let raw = "<!-- count:hubs -->\u{FEFF}1\u{FEFF}<!-- /count -->";
        let out = scan_counts(raw, "X.md", false, &stats());
        assert!(out.warnings.is_empty(), "{:?}", out.warnings);
    }
}
