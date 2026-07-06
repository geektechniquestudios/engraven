#!/usr/bin/env node
/**
 * vault-check.mjs — Engram vault integrity linter (zero dependencies).
 *
 * Checks:
 *   1. Wiki-links resolve         [[Target]] / [[Target|alias]] / [[Target#h]]
 *   2. Duplicate titles           two files sharing a basename (ambiguous links)
 *   3. Frontmatter contract       required keys present (config: requireFrontmatter)
 *   4. Orphan docs                docs with no inbound links (entry points exempt)
 *   5. KB structure               each KB dir has a meta-analysis; docs covered by hub/meta
 *   6. Stub docs                  near-empty files that pollute retrieval
 *   7. Unresolved placeholders    leftover {{TOKENS}} from the bootstrap
 *
 * Usage:
 *   node scripts/vault-check.mjs [--vault <dir>] [--strict] [--allow-placeholders] [--quiet]
 *
 * Config: engram.config.json in the working directory (all keys optional):
 *   { "vaultDir": "docs/vault", "requireFrontmatter": ["tags","date"],
 *     "sessionArchiveDir": "Session-Archive" }
 *
 * Exit code: 0 clean · 1 errors (or warnings with --strict) · 2 usage error
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, basename, resolve } from "node:path";

// ── Arguments ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let vaultArg = null;
let strict = false;
let allowPlaceholders = false;
let quiet = false;
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--vault":
      vaultArg = args[++i];
      break;
    case "--strict":
      strict = true;
      break;
    case "--allow-placeholders":
      allowPlaceholders = true;
      break;
    case "--quiet":
      quiet = true;
      break;
    case "-h":
    case "--help":
      console.log(
        "Usage: node scripts/vault-check.mjs [--vault <dir>] [--strict] [--allow-placeholders] [--quiet]",
      );
      process.exit(0);
    default:
      console.error(`Unknown argument: ${args[i]}`);
      process.exit(2);
  }
}

// ── Config ────────────────────────────────────────────────────────────
let config = {};
if (existsSync("engram.config.json")) {
  try {
    config = JSON.parse(readFileSync("engram.config.json", "utf8"));
  } catch (e) {
    console.error(`engram.config.json is not valid JSON: ${e.message}`);
    process.exit(2);
  }
}
const VAULT = resolve(vaultArg ?? config.vaultDir ?? "docs/vault");
const REQUIRED_FM = config.requireFrontmatter ?? ["tags", "date"];
const ARCHIVE_DIR = config.sessionArchiveDir ?? "Session-Archive";

if (!existsSync(VAULT) || !statSync(VAULT).isDirectory()) {
  console.error(`Vault directory not found: ${VAULT}`);
  console.error(`(set "vaultDir" in engram.config.json or pass --vault <dir>)`);
  process.exit(2);
}

// ── Collect files ─────────────────────────────────────────────────────
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
}
const files = walk(VAULT).sort();
const rel = (f) => relative(VAULT, f);

// title (basename without .md) → [files]
const byTitle = new Map();
for (const f of files) {
  const title = basename(f, ".md");
  if (!byTitle.has(title)) byTitle.set(title, []);
  byTitle.get(title).push(f);
}

// ── Parse each file ───────────────────────────────────────────────────
const LINK_RE = /\[\[([^\]]+)\]\]/g;
const docs = new Map(); // file → { links:Set<title>, fm:Map, bodyLines, placeholders }
for (const f of files) {
  const raw = readFileSync(f, "utf8");
  let fmKeys = new Set();
  let body = raw;
  if (raw.startsWith("---\n")) {
    const end = raw.indexOf("\n---", 4);
    if (end !== -1) {
      const fmBlock = raw.slice(4, end);
      body = raw.slice(end + 4);
      for (const line of fmBlock.split("\n")) {
        const m = line.match(/^([A-Za-z_][\w-]*):/);
        if (m) fmKeys.add(m[1]);
      }
    }
  }
  // strip fenced code blocks and inline code so example links don't count
  const scannable = body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const links = new Set();
  for (const m of scannable.matchAll(LINK_RE)) {
    // [[Title|alias]] → Title ; [[Title#heading]] → Title
    const target = m[1].split("|")[0].split("#")[0].trim();
    if (target) links.add(target);
  }
  const bodyLines = body.split("\n").filter((l) => l.trim() !== "").length;
  const placeholders = [...raw.matchAll(/\{\{[A-Z0-9_]+\}\}/g)].map((m) => m[0]);
  docs.set(f, { links, fmKeys, bodyLines, placeholders });
}

// ── Checks ────────────────────────────────────────────────────────────
const errors = [];
const warnings = [];

// 1. link resolution
for (const [f, d] of docs) {
  for (const target of d.links) {
    if (!byTitle.has(target)) {
      errors.push(`broken link: [[${target}]] in ${rel(f)}`);
    }
  }
}

// 2. duplicate titles
for (const [title, list] of byTitle) {
  if (list.length > 1) {
    errors.push(
      `duplicate title "${title}": ${list.map(rel).join(" · ")} — wiki-links resolve ambiguously`,
    );
  }
}

// 3. frontmatter contract
for (const [f, d] of docs) {
  const missing = REQUIRED_FM.filter((k) => !d.fmKeys.has(k));
  if (missing.length) {
    warnings.push(`missing frontmatter [${missing.join(", ")}]: ${rel(f)}`);
  }
}

// inbound-link map
const inbound = new Map(files.map((f) => [f, 0]));
for (const [, d] of docs) {
  for (const target of d.links) {
    for (const t of byTitle.get(target) ?? []) {
      inbound.set(t, inbound.get(t) + 1);
    }
  }
}

// 4. orphans — entry points and archive entries exempt
const ENTRY_TITLES = new Set(["00-Index", "Research Library"]);
for (const f of files) {
  const title = basename(f, ".md");
  const inArchive = rel(f).startsWith(ARCHIVE_DIR + "/") || rel(f).startsWith(ARCHIVE_DIR + "\\");
  if (ENTRY_TITLES.has(title) || inArchive) continue;
  if (inbound.get(f) === 0) {
    warnings.push(`orphan doc (nothing links to it): ${rel(f)}`);
  }
}

// 5. KB structure — each top-level dir (except the archive) is a KB
const kbDirs = readdirSync(VAULT).filter((e) => {
  if (e.startsWith(".") || e === ARCHIVE_DIR) return false;
  return statSync(join(VAULT, e)).isDirectory();
});
for (const kb of kbDirs) {
  const kbFiles = files.filter((f) => rel(f).startsWith(kb + "/") || rel(f).startsWith(kb + "\\"));
  const isMeta = (f) => basename(f, ".md").endsWith("Meta-Analysis");
  const isHub = (f) => basename(f, ".md").endsWith("Section Hub");
  const metas = kbFiles.filter(isMeta);
  if (metas.length === 0) {
    warnings.push(`KB "${kb}" has no "* - Meta-Analysis.md" entry point`);
  }
  // every non-hub, non-meta doc should be linked from a hub or meta in the same KB
  const routerLinks = new Set();
  for (const f of kbFiles.filter((f) => isMeta(f) || isHub(f))) {
    for (const t of docs.get(f).links) routerLinks.add(t);
  }
  for (const f of kbFiles) {
    if (isMeta(f) || isHub(f)) continue;
    if (!routerLinks.has(basename(f, ".md"))) {
      warnings.push(`not covered by its KB's hub/meta-analysis: ${rel(f)}`);
    }
  }
}

// 6. stub docs
for (const [f, d] of docs) {
  if (d.bodyLines < 5) {
    warnings.push(`stub doc (${d.bodyLines} non-empty lines): ${rel(f)}`);
  }
}

// 7. unresolved placeholders
if (!allowPlaceholders) {
  for (const [f, d] of docs) {
    if (d.placeholders.length) {
      warnings.push(
        `unresolved placeholders ${[...new Set(d.placeholders)].join(" ")}: ${rel(f)} — run the bootstrap's placeholder pass`,
      );
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────
const say = (s) => !quiet && console.log(s);
say(`engram vault-check · ${files.length} docs · ${VAULT}`);
if (errors.length) {
  say(`\n${errors.length} error(s):`);
  for (const e of errors) say(`  ✗ ${e}`);
}
if (warnings.length) {
  say(`\n${warnings.length} warning(s):`);
  for (const w of warnings) say(`  ⚠ ${w}`);
}
if (!errors.length && !warnings.length) say("✓ vault is clean");
else if (!errors.length) say(`\n✓ no errors (${warnings.length} warnings)`);

process.exit(errors.length || (strict && warnings.length) ? 1 : 0);
