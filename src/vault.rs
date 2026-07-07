//! `hyphasma vault` — vault integrity linter.
//!
//! A line-for-line port of `scripts/vault-check.mjs`. The stdout report, the
//! wording and ordering of every error/warning, the `--fix` rewrite behavior,
//! and the exit codes are contractually identical to the script; when in
//! doubt about a quirk here, the script is the specification.
//!
//! Checks:
//!   1.  Wiki-links resolve        `[[Target]]` / `[[Target|alias]]` / `[[Target#h]]`
//!   2.  Duplicate titles          two files sharing a basename (ambiguous links)
//!   3.  Frontmatter contract      required keys present (config: requireFrontmatter)
//!   4.  Orphan docs               docs with no inbound links (entry points exempt)
//!   5.  KB structure              each KB dir has a meta-analysis; docs covered by hub/meta
//!   6.  Stub docs                 near-empty files that pollute retrieval
//!   7.  Unresolved placeholders   leftover `{{TOKENS}}` from the bootstrap
//!   8.  Count directives          `<!-- count:name -->N<!-- /count -->` stale values (`--fix` rewrites)
//!   9.  Entry-point reachability  every KB's meta-analysis linked from 00-Index / Research Library
//!   10. Archive index coverage    every session archive entry listed in the archive index
//!   11. Solitary docs             docs with zero outgoing wiki-links (dead ends in the graph)

use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::path::{MAIN_SEPARATOR, Path};
use std::sync::OnceLock;

use regex::Regex;

use crate::config;
use crate::counts::{CountStats, scan_counts};
use crate::util::{before, cmp_utf16, js_trim, read_text_lossy, relative_path, resolve_from};

#[derive(Debug, Default)]
pub struct VaultArgs {
    pub vault: Option<String>,
    pub strict: bool,
    pub fix: bool,
    pub allow_placeholders: bool,
    pub quiet: bool,
}

const ENTRY_TITLES: [&str; 2] = ["00-Index", "Research Library"];

fn link_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\[\[([^\]]+)\]\]").expect("fixed pattern"))
}

fn fm_key_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    // /^([A-Za-z_][\w-]*):/ with JavaScript's ASCII-only \w.
    RE.get_or_init(|| Regex::new(r"^([A-Za-z_][A-Za-z0-9_-]*):").expect("fixed pattern"))
}

fn fence_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?s)```.*?```").expect("fixed pattern"))
}

fn inline_code_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"`[^`\n]*`").expect("fixed pattern"))
}

fn comment_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?s)<!--.*?-->").expect("fixed pattern"))
}

fn placeholder_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\{\{[A-Z0-9_]+\}\}").expect("fixed pattern"))
}

/// Per-document parse results (the script's `docs` map entries).
pub(crate) struct ParsedDoc {
    /// Link targets, first-occurrence order, deduplicated (JS `Set`).
    pub links: Vec<String>,
    pub fm_keys: HashSet<String>,
    pub body_lines: usize,
    /// Every `{{TOKEN}}` occurrence in raw order (duplicates included).
    pub placeholders: Vec<String>,
}

/// Mirrors the script's per-file parse: frontmatter keys, wiki-links from the
/// body with code blocks / inline code / HTML comments stripped, non-empty
/// body line count, and `{{PLACEHOLDER}}` occurrences from the raw text.
pub(crate) fn parse_doc(raw: &str) -> ParsedDoc {
    let mut fm_keys = HashSet::new();
    let mut body: &str = raw;
    if let Some(rest) = raw.strip_prefix("---\n") {
        // end = raw.indexOf("\n---", 4); body = raw.slice(end + 4). The body
        // deliberately starts right after "\n---", even mid-line.
        if let Some(end) = rest.find("\n---") {
            let fm_block = &rest[..end];
            body = &rest[end + 4..];
            for line in fm_block.split('\n') {
                if let Some(caps) = fm_key_re().captures(line) {
                    fm_keys.insert(caps[1].to_string());
                }
            }
        }
    }

    // Strip fenced code blocks, inline code, and comments so example links
    // don't count — in this exact order, like the script.
    let no_fences = fence_re().replace_all(body, "");
    let no_inline = inline_code_re().replace_all(&no_fences, "");
    let scannable = comment_re().replace_all(&no_inline, "");

    let mut links = Vec::new();
    let mut link_set = HashSet::new();
    for caps in link_re().captures_iter(&scannable) {
        // [[Title|alias]] → Title ; [[Title#heading]] → Title
        let target = js_trim(before(before(&caps[1], '|'), '#'));
        if !target.is_empty() && link_set.insert(target.to_string()) {
            links.push(target.to_string());
        }
    }

    let body_lines = body.split('\n').filter(|l| !js_trim(l).is_empty()).count();
    let placeholders = placeholder_re()
        .find_iter(raw)
        .map(|m| m.as_str().to_string())
        .collect();

    ParsedDoc {
        links,
        fm_keys,
        body_lines,
        placeholders,
    }
}

/// Basename without the `.md` suffix (Node's `basename(f, ".md")`).
fn title_of(path: &str) -> String {
    let name = Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    name.strip_suffix(".md").unwrap_or(&name).to_string()
}

/// `rel(f).startsWith(prefix + "/") || rel(f).startsWith(prefix + "\\")`.
fn under(rel: &str, prefix: &str) -> bool {
    rel.starts_with(&format!("{prefix}/")) || rel.starts_with(&format!("{prefix}\\"))
}

fn is_meta_title(title: &str) -> bool {
    title.ends_with("Meta-Analysis")
}

fn is_hub_title(title: &str) -> bool {
    title.ends_with("Section Hub")
}

/// Recursive walk in raw readdir order: skip dotfiles, follow directories
/// (via `metadata`, which follows symlinks like Node's `statSync`), collect
/// `*.md` files. Sorting happens afterwards, exactly like the script.
fn walk(dir: &str, out: &mut Vec<String>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("cannot read directory {dir}: {e}"))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("cannot read directory {dir}: {e}"))?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let full = format!("{dir}{MAIN_SEPARATOR}{name}");
        let meta = fs::metadata(&full).map_err(|e| format!("cannot stat {full}: {e}"))?;
        if meta.is_dir() {
            walk(&full, out)?;
        } else if name.ends_with(".md") {
            out.push(full);
        }
    }
    Ok(())
}

/// Run the vault linter. Writes the report to `out` (honoring `--quiet`) and
/// returns the process exit code: 0 clean, 1 errors (or warnings with
/// `--strict`), 2 usage/environment error.
pub fn run(args: &VaultArgs, out: &mut dyn Write) -> i32 {
    let cwd = match std::env::current_dir() {
        Ok(d) => d,
        Err(e) => {
            eprintln!("cannot determine working directory: {e}");
            return 2;
        }
    };

    let cfg = match config::vault_config() {
        Ok(c) => c,
        Err(msg) => {
            eprintln!("{msg}");
            return 2;
        }
    };

    let vault_setting = args
        .vault
        .clone()
        .or(cfg.vault_dir.clone())
        .unwrap_or_else(|| "docs/vault".to_string());
    let vault_path = resolve_from(&cwd, &vault_setting);
    let vault = vault_path.to_string_lossy().into_owned();

    if !fs::metadata(&vault_path)
        .map(|m| m.is_dir())
        .unwrap_or(false)
    {
        eprintln!("Vault directory not found: {vault}");
        eprintln!("(set \"vaultDir\" in hyphasma.config.json or pass --vault <dir>)");
        return 2;
    }

    // ── Collect files ─────────────────────────────────────────────────
    let mut files = Vec::new();
    if let Err(msg) = walk(&vault, &mut files) {
        eprintln!("{msg}");
        return 2;
    }
    files.sort_by(|a, b| cmp_utf16(a, b));
    let rel = |f: &str| relative_path(&vault_path, Path::new(f));
    let rels: Vec<String> = files.iter().map(|f| rel(f)).collect();
    let titles: Vec<String> = files.iter().map(|f| title_of(f)).collect();

    // title → file indices, plus first-insertion order for iteration parity.
    let mut by_title: HashMap<&str, Vec<usize>> = HashMap::new();
    let mut title_order: Vec<&str> = Vec::new();
    for (i, title) in titles.iter().enumerate() {
        let entry = by_title.entry(title.as_str()).or_default();
        if entry.is_empty() {
            title_order.push(title.as_str());
        }
        entry.push(i);
    }

    // ── Parse each file ───────────────────────────────────────────────
    let mut docs = Vec::with_capacity(files.len());
    for f in &files {
        match read_text_lossy(Path::new(f)) {
            Ok(raw) => docs.push(parse_doc(&raw)),
            Err(e) => {
                eprintln!("cannot read {f}: {e}");
                return 2;
            }
        }
    }

    // ── Checks ────────────────────────────────────────────────────────
    let mut errors: Vec<String> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();

    // 1. link resolution
    for (i, doc) in docs.iter().enumerate() {
        for target in &doc.links {
            if !by_title.contains_key(target.as_str()) {
                errors.push(format!("broken link: [[{target}]] in {}", rels[i]));
            }
        }
    }

    // 2. duplicate titles
    for title in &title_order {
        let list = &by_title[title];
        if list.len() > 1 {
            let shown: Vec<&str> = list.iter().map(|&i| rels[i].as_str()).collect();
            errors.push(format!(
                "duplicate title \"{title}\": {} (wiki-links resolve ambiguously)",
                shown.join(" · ")
            ));
        }
    }

    // 3. frontmatter contract
    for (i, doc) in docs.iter().enumerate() {
        let missing: Vec<&str> = cfg
            .require_frontmatter
            .iter()
            .filter(|k| !doc.fm_keys.contains(k.as_str()))
            .map(|k| k.as_str())
            .collect();
        if !missing.is_empty() {
            warnings.push(format!(
                "missing frontmatter [{}]: {}",
                missing.join(", "),
                rels[i]
            ));
        }
    }

    // inbound-link map
    let mut inbound = vec![0usize; files.len()];
    for doc in &docs {
        for target in &doc.links {
            if let Some(list) = by_title.get(target.as_str()) {
                for &t in list {
                    inbound[t] += 1;
                }
            }
        }
    }

    // 4. orphans — entry points and archive entries exempt
    let archive = cfg.session_archive_dir.as_str();
    for i in 0..files.len() {
        let in_archive = under(&rels[i], archive);
        if ENTRY_TITLES.contains(&titles[i].as_str()) || in_archive {
            continue;
        }
        if inbound[i] == 0 {
            warnings.push(format!("orphan doc (nothing links to it): {}", rels[i]));
        }
    }

    // 5. KB structure — each top-level dir (except the archive) is a KB
    let kb_dirs = match list_kb_dirs(&vault, archive) {
        Ok(dirs) => dirs,
        Err(msg) => {
            eprintln!("{msg}");
            return 2;
        }
    };
    for kb in &kb_dirs {
        let kb_files: Vec<usize> = (0..files.len()).filter(|&i| under(&rels[i], kb)).collect();
        let metas: Vec<usize> = kb_files
            .iter()
            .copied()
            .filter(|&i| is_meta_title(&titles[i]))
            .collect();
        if metas.is_empty() {
            warnings.push(format!(
                "KB \"{kb}\" has no \"* - Meta-Analysis.md\" entry point"
            ));
        }
        // every non-hub, non-meta doc should be linked from a hub or meta in
        // the same KB
        let mut router_links: HashSet<&str> = HashSet::new();
        for &i in kb_files
            .iter()
            .filter(|&&i| is_meta_title(&titles[i]) || is_hub_title(&titles[i]))
        {
            for l in &docs[i].links {
                router_links.insert(l.as_str());
            }
        }
        for &i in &kb_files {
            if is_meta_title(&titles[i]) || is_hub_title(&titles[i]) {
                continue;
            }
            if !router_links.contains(titles[i].as_str()) {
                warnings.push(format!(
                    "not covered by its KB's hub/meta-analysis: {}",
                    rels[i]
                ));
            }
        }
    }

    // 6. stub docs
    for (i, doc) in docs.iter().enumerate() {
        if doc.body_lines < 5 {
            warnings.push(format!(
                "stub doc ({} non-empty lines): {}",
                doc.body_lines, rels[i]
            ));
        }
    }

    // 7. unresolved placeholders
    if !args.allow_placeholders {
        for (i, doc) in docs.iter().enumerate() {
            if !doc.placeholders.is_empty() {
                let mut seen = HashSet::new();
                let unique: Vec<&str> = doc
                    .placeholders
                    .iter()
                    .filter(|p| seen.insert(p.as_str()))
                    .map(|p| p.as_str())
                    .collect();
                warnings.push(format!(
                    "unresolved placeholders {}: {} (run the bootstrap's placeholder pass)",
                    unique.join(" "),
                    rels[i]
                ));
            }
        }
    }

    // 8. count directives — <!-- count:name -->N<!-- /count -->
    let archive_entries: Vec<usize> = (0..files.len())
        .filter(|&i| under(&rels[i], archive) && !titles[i].contains("Index"))
        .collect();
    let stats = CountStats {
        vault_docs: files.len(),
        hubs: titles.iter().filter(|t| is_hub_title(t)).count(),
        meta_analyses: titles.iter().filter(|t| is_meta_title(t)).count(),
        archive_entries: archive_entries.len(),
        kb_doc_counts: kb_dirs
            .iter()
            .map(|kb| {
                let n = (0..files.len()).filter(|&i| under(&rels[i], kb)).count();
                (kb.clone(), n)
            })
            .collect(),
        kb_dirs: kb_dirs.clone(),
    };
    let mut count_targets: Vec<String> = files.clone();
    let mut seen_targets: HashSet<String> = files.iter().cloned().collect();
    for p in &cfg.count_files {
        let resolved = resolve_from(&cwd, p);
        if resolved.exists() {
            let s = resolved.to_string_lossy().into_owned();
            if seen_targets.insert(s.clone()) {
                count_targets.push(s);
            }
        }
    }
    let mut fixed_counts = 0;
    for f in &count_targets {
        let raw = match read_text_lossy(Path::new(f)) {
            Ok(raw) => raw,
            Err(e) => {
                eprintln!("cannot read {f}: {e}");
                return 2;
            }
        };
        let where_label = if f.starts_with(&vault) {
            rel(f)
        } else {
            relative_path(&cwd, Path::new(f))
        };
        let outcome = scan_counts(&raw, &where_label, args.fix, &stats);
        warnings.extend(outcome.warnings);
        fixed_counts += outcome.fixed;
        if outcome.updated != raw {
            if let Err(e) = fs::write(f, outcome.updated) {
                eprintln!("cannot write {f}: {e}");
                return 2;
            }
        }
    }

    // 9. entry-point reachability — each KB's meta-analysis linked from
    // 00-Index / Research Library
    let mut entry_links: HashSet<&str> = HashSet::new();
    for title in ENTRY_TITLES {
        if let Some(list) = by_title.get(title) {
            for &i in list {
                for l in &docs[i].links {
                    entry_links.insert(l.as_str());
                }
            }
        }
    }
    if !entry_links.is_empty() {
        for kb in &kb_dirs {
            let metas: Vec<usize> = (0..files.len())
                .filter(|&i| under(&rels[i], kb) && is_meta_title(&titles[i]))
                .collect();
            if !metas.is_empty()
                && !metas
                    .iter()
                    .any(|&i| entry_links.contains(titles[i].as_str()))
            {
                warnings.push(format!(
                    "KB \"{kb}\" is not reachable from an entry point (00-Index / Research Library)"
                ));
            }
        }
    }

    // 10. archive index coverage — every entry listed in the archive index
    let archive_indexes: Vec<usize> = (0..files.len())
        .filter(|&i| under(&rels[i], archive) && titles[i].contains("Index"))
        .collect();
    if !archive_indexes.is_empty() {
        let mut indexed: HashSet<&str> = HashSet::new();
        for &i in &archive_indexes {
            for l in &docs[i].links {
                indexed.insert(l.as_str());
            }
        }
        for &i in &archive_entries {
            if !indexed.contains(titles[i].as_str()) {
                warnings.push(format!(
                    "archive entry not listed in the archive index: {}",
                    rels[i]
                ));
            }
        }
    }

    // 11. solitary docs — zero outgoing wiki-links (dead ends; every doc
    // weaves into the graph)
    for (i, doc) in docs.iter().enumerate() {
        if doc.links.is_empty() {
            warnings.push(format!(
                "solitary doc (no outgoing wiki-links; weave it into the graph): {}",
                rels[i]
            ));
        }
    }

    // ── Report ────────────────────────────────────────────────────────
    let mut say = |s: &str| {
        if !args.quiet {
            let _ = writeln!(out, "{s}");
        }
    };
    say(&format!(
        "hyphasma vault-check · {} docs · {vault}",
        files.len()
    ));
    if fixed_counts > 0 {
        say(&format!("✎ refreshed {fixed_counts} count directive(s)"));
    }
    if !errors.is_empty() {
        say(&format!("\n{} error(s):", errors.len()));
        for e in &errors {
            say(&format!("  ✗ {e}"));
        }
    }
    if !warnings.is_empty() {
        say(&format!("\n{} warning(s):", warnings.len()));
        for w in &warnings {
            say(&format!("  ⚠ {w}"));
        }
    }
    if errors.is_empty() && warnings.is_empty() {
        say("✓ vault is clean");
    } else if errors.is_empty() {
        say(&format!("\n✓ no errors ({} warnings)", warnings.len()));
    }

    if !errors.is_empty() || (args.strict && !warnings.is_empty()) {
        1
    } else {
        0
    }
}

/// Top-level vault directories, skipping dotfiles and the session-archive
/// directory (the script's `kbDirs`). Node's `readdirSync` returns entries
/// sorted (libuv scandir uses `alphasort`), and the KB iteration order shows
/// in the report, so the names are sorted here too.
fn list_kb_dirs(vault: &str, archive: &str) -> Result<Vec<String>, String> {
    let mut kb_dirs = Vec::new();
    let entries = fs::read_dir(vault).map_err(|e| format!("cannot read directory {vault}: {e}"))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("cannot read directory {vault}: {e}"))?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') || name == archive {
            continue;
        }
        let full = format!("{vault}{MAIN_SEPARATOR}{name}");
        let meta = fs::metadata(&full).map_err(|e| format!("cannot stat {full}: {e}"))?;
        if meta.is_dir() {
            kb_dirs.push(name);
        }
    }
    kb_dirs.sort();
    Ok(kb_dirs)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_doc_extracts_frontmatter_keys() {
        let doc = parse_doc("---\ntags: [a]\ndate: 2026-01-01\nnot a key\n---\nbody\n");
        assert!(doc.fm_keys.contains("tags"));
        assert!(doc.fm_keys.contains("date"));
        assert_eq!(doc.fm_keys.len(), 2);
        assert_eq!(doc.body_lines, 1);
    }

    #[test]
    fn parse_doc_body_starts_right_after_the_fm_terminator() {
        // The script slices the body at "\n---" + 4, so text on the same line
        // as the closing marker belongs to the body.
        let doc = parse_doc("---\ntags: [a]\ndate: d\n--- trailing text\nbody [[Target]]\n");
        assert!(doc.fm_keys.contains("tags"));
        assert_eq!(doc.body_lines, 2); // " trailing text" + "body [[Target]]"
        assert_eq!(doc.links, vec!["Target"]);
    }

    #[test]
    fn parse_doc_without_frontmatter_treats_everything_as_body() {
        let doc = parse_doc("just text {{TOKEN}} and [[A Link]]\n");
        assert!(doc.fm_keys.is_empty());
        assert_eq!(doc.links, vec!["A Link"]);
        assert_eq!(doc.placeholders, vec!["{{TOKEN}}"]);
    }

    #[test]
    fn links_are_deduplicated_in_first_occurrence_order() {
        let doc = parse_doc("[[B]] then [[A]] then [[B|alias]] then [[A#head]]\n");
        assert_eq!(doc.links, vec!["B", "A"]);
    }

    #[test]
    fn code_and_comments_do_not_produce_links() {
        let raw = "\
```\n[[In Fence]]\n```\n\
inline `[[In Code]]` end\n\
<!-- [[In Comment]] -->\n\
real [[Kept]]\n";
        let doc = parse_doc(raw);
        assert_eq!(doc.links, vec!["Kept"]);
    }

    #[test]
    fn empty_link_targets_are_skipped() {
        let doc = parse_doc("[[ ]] [[|alias]] [[#heading]] [[Real]]\n");
        assert_eq!(doc.links, vec!["Real"]);
    }

    #[test]
    fn placeholders_keep_duplicates_in_raw_order() {
        let doc = parse_doc("{{B}} {{A}} {{B}}\n");
        assert_eq!(doc.placeholders, vec!["{{B}}", "{{A}}", "{{B}}"]);
    }

    #[test]
    fn title_and_prefix_helpers() {
        assert_eq!(title_of("/v/KB/Doc Name.md"), "Doc Name");
        assert!(is_meta_title("Beta - Meta-Analysis"));
        assert!(is_hub_title("Core - Section Hub"));
        assert!(!is_meta_title("Meta-Analysis Notes"));
        assert!(under("KB/Doc.md", "KB"));
        assert!(under("KB\\Doc.md", "KB"));
        assert!(!under("KB2/Doc.md", "KB"));
    }
}
