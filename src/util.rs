//! Shared helpers that reproduce the exact semantics the original scripts
//! relied on: JavaScript's default sort order, JavaScript's whitespace class,
//! and Node's lexical path resolution. Output parity with the scripts depends
//! on these details, so they are mirrored precisely rather than approximated.

use std::cmp::Ordering;
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

/// Compare two strings the way JavaScript's default `Array.prototype.sort`
/// does: by UTF-16 code units. This differs from Rust's byte-wise `str`
/// ordering only for code points above U+FFFF, but the vault walker sorts
/// with it so file ordering matches `vault-check.mjs` on any input.
pub fn cmp_utf16(a: &str, b: &str) -> Ordering {
    let mut ua = a.encode_utf16();
    let mut ub = b.encode_utf16();
    loop {
        match (ua.next(), ub.next()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(x), Some(y)) => match x.cmp(&y) {
                Ordering::Equal => continue,
                other => return other,
            },
        }
    }
}

/// JavaScript's `\s` / `String.prototype.trim` whitespace class. It matches
/// Unicode `White_Space` plus U+FEFF (BOM), which Rust's `char::is_whitespace`
/// excludes.
pub fn is_js_whitespace(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{000B}' | '\u{000C}' | '\r' | ' ' | '\u{00A0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200A}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202F}'
                | '\u{205F}'
                | '\u{3000}'
                | '\u{FEFF}'
    )
}

/// `String.prototype.trim` equivalent (see [`is_js_whitespace`]).
pub fn js_trim(s: &str) -> &str {
    s.trim_matches(is_js_whitespace)
}

/// The character class used inside regexes to mirror JavaScript's `\s`.
pub const JS_WS_CLASS: &str = "[\\t\\n\\x0B\\x0C\\r \\u{00A0}\\u{1680}\\u{2000}-\\u{200A}\\u{2028}\\u{2029}\\u{202F}\\u{205F}\\u{3000}\\u{FEFF}]";

/// Read a file as text the way Node's `readFileSync(f, "utf8")` does:
/// invalid UTF-8 sequences become U+FFFD instead of failing.
pub fn read_text_lossy(path: &Path) -> io::Result<String> {
    let bytes = fs::read(path)?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

/// `wc -l` semantics: the number of newline bytes in the file.
pub fn count_newlines(path: &Path) -> io::Result<usize> {
    let bytes = fs::read(path)?;
    Ok(bytes.iter().filter(|&&b| b == b'\n').count())
}

/// Node's `path.resolve(base, p)`: join `p` onto `base` unless `p` is already
/// absolute, then normalize lexically (collapse `.`/`..`) without touching the
/// filesystem.
pub fn resolve_from(base: &Path, p: &str) -> PathBuf {
    let path = Path::new(p);
    let joined = if path.is_absolute() {
        path.to_path_buf()
    } else {
        base.join(path)
    };
    normalize(&joined)
}

/// Lexical normalization: drop `.` components, apply `..` by popping (a `..`
/// at the root is dropped, like Node's `path.resolve("/..") === "/"`).
fn normalize(p: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for component in p.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                // At the root, `pop` is a no-op, matching Node.
                out.pop();
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// Node's `path.relative(from, to)` for two normalized paths, joined with the
/// platform separator. Returns an empty string when the paths are equal.
pub fn relative_path(from: &Path, to: &Path) -> String {
    let from_parts: Vec<Component> = from.components().collect();
    let to_parts: Vec<Component> = to.components().collect();
    let mut shared = 0;
    while shared < from_parts.len()
        && shared < to_parts.len()
        && from_parts[shared] == to_parts[shared]
    {
        shared += 1;
    }
    let mut parts: Vec<String> = from_parts[shared..]
        .iter()
        .map(|_| "..".to_string())
        .collect();
    parts.extend(
        to_parts[shared..]
            .iter()
            .map(|c| c.as_os_str().to_string_lossy().into_owned()),
    );
    parts.join(std::path::MAIN_SEPARATOR_STR)
}

/// `s` up to (not including) the first `ch`, or all of `s` if absent.
pub fn before(s: &str, ch: char) -> &str {
    match s.find(ch) {
        Some(i) => &s[..i],
        None => s,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utf16_order_matches_javascript_sort() {
        // "\u{FF61}" is one UTF-16 unit (0xFF61); "\u{10000}" is a surrogate
        // pair starting 0xD800. JavaScript sorts the surrogate pair first;
        // byte-wise ordering would sort it last.
        assert_eq!(cmp_utf16("\u{10000}", "\u{FF61}"), Ordering::Less);
        assert_eq!(cmp_utf16("a", "b"), Ordering::Less);
        assert_eq!(cmp_utf16("abc", "ab"), Ordering::Greater);
        assert_eq!(cmp_utf16("same", "same"), Ordering::Equal);

        let mut v = vec!["B.md", "A.md", "A/z.md", "A b.md"];
        v.sort_by(|a, b| cmp_utf16(a, b));
        assert_eq!(v, vec!["A b.md", "A.md", "A/z.md", "B.md"]);
    }

    #[test]
    fn js_trim_strips_bom_and_unicode_space() {
        assert_eq!(js_trim("\u{FEFF} x \u{3000}"), "x");
        assert_eq!(js_trim("  plain  "), "plain");
        assert_eq!(js_trim("\u{FEFF}"), "");
        // Rust's built-in trim would keep the BOM.
        assert_eq!("\u{FEFF}".trim(), "\u{FEFF}");
    }

    #[test]
    fn resolve_from_mirrors_node_path_resolve() {
        let base = Path::new("/repo/sub");
        assert_eq!(
            resolve_from(base, "vault"),
            PathBuf::from("/repo/sub/vault")
        );
        assert_eq!(
            resolve_from(base, "./vault/"),
            PathBuf::from("/repo/sub/vault")
        );
        assert_eq!(resolve_from(base, "../other"), PathBuf::from("/repo/other"));
        assert_eq!(resolve_from(base, "/abs/./p/../q"), PathBuf::from("/abs/q"));
        assert_eq!(resolve_from(base, ""), PathBuf::from("/repo/sub"));
        assert_eq!(resolve_from(base, "/.."), PathBuf::from("/"));
    }

    #[test]
    fn relative_path_mirrors_node_path_relative() {
        let vault = Path::new("/repo/vault");
        assert_eq!(
            relative_path(vault, Path::new("/repo/vault/a/b.md")),
            "a/b.md"
        );
        assert_eq!(
            relative_path(vault, Path::new("/repo/other/c.md")),
            "../other/c.md"
        );
        assert_eq!(relative_path(vault, Path::new("/repo/vault")), "");
    }

    #[test]
    fn before_splits_on_first_occurrence() {
        assert_eq!(before("Title|alias", '|'), "Title");
        assert_eq!(before("Title#heading", '#'), "Title");
        assert_eq!(before("plain", '|'), "plain");
        assert_eq!(before("", '#'), "");
    }
}
