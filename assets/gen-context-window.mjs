#!/usr/bin/env node
// Generator for assets/context-window.svg: the four-surfaces, two-speeds
// demo. Three sessions run back to back so both speeds are visible at once:
// the left panel (context window) clears and reloads the same thin surfaces
// every session for a flat ~5k, while the right panel (a miniature knowledge
// graph of the vault, plus the session archive) never resets and lends a doc
// only when a router row fires: +1.4k, then +1.1k from a different KB, then
// a session that needs nothing and pays nothing. Read docs keep an ember.
// Deterministic (seeded PRNG). Run from the repo root:
//   node assets/gen-context-window.mjs
import { writeFileSync } from "node:fs";

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(11);
const R = (lo, hi) => lo + rnd() * (hi - lo);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const f2 = (v) => +v.toFixed(2);

// ── the vault as a miniature knowledge graph (right panel, never resets) ──
const CL = [
  { x: 524, y: 124, r: 24, n: 26, c: "#4cc9f0" },
  { x: 608, y: 160, r: 19, n: 20, c: "#fb7185" }, // payments
  { x: 696, y: 118, r: 23, n: 24, c: "#ffd60a" },
  { x: 772, y: 158, r: 17, n: 18, c: "#80ed99" }, // rate limiting
];
const dots = [];
CL.forEach((cl, ci) => {
  for (let i = 0; i < cl.n; i++) {
    const a = R(0, Math.PI * 2);
    const d = cl.r * Math.sqrt(rnd()) * R(0.5, 1.0);
    const hub = rnd() < 0.08;
    dots.push({
      x: +clamp(cl.x + Math.cos(a) * d * 1.25, 480, 812).toFixed(1),
      y: +clamp(cl.y + Math.sin(a) * d, 98, 188).toFixed(1),
      r: hub ? +R(2.7, 3.4).toFixed(1) : +R(1.3, 2.3).toFixed(1),
      c: cl.c, cl: ci,
    });
  }
});
for (let i = 0; i < 10; i++) {
  dots.push({ x: +R(486, 806).toFixed(1), y: +R(100, 186).toFixed(1), r: +R(1.1, 1.7).toFixed(1), c: "#6e7681", cl: -1 });
}
const dist2 = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const edges = [];
const key = (p, q) => [dots.indexOf(p), dots.indexOf(q)].sort((a, b) => a - b).join(":");
const seen = new Set();
const link = (p, q, o) => { if (p !== q && !seen.has(key(p, q))) { seen.add(key(p, q)); edges.push({ a: p, b: q, o }); } };
for (const n of dots) {
  const pool = n.cl === -1 ? dots.filter((m) => m !== n) : dots.filter((m) => m.cl === n.cl && m !== n);
  const nearest = pool.reduce((a, b) => (dist2(b, n) < dist2(a, n) ? b : a));
  link(n, nearest, n.cl === -1 ? 0.14 : R(0.13, 0.19));
}
CL.forEach((_, ci) => {
  const ns = dots.filter((m) => m.cl === ci);
  for (let i = 0; i < 5; i++) link(ns[Math.floor(rnd() * ns.length)], ns[Math.floor(rnd() * ns.length)], R(0.1, 0.15));
});
for (let i = 0; i < 7; i++) {
  const ca = Math.floor(rnd() * CL.length);
  const cb = (ca + 1 + Math.floor(rnd() * (CL.length - 1))) % CL.length;
  const na = dots.filter((m) => m.cl === ca), nb = dots.filter((m) => m.cl === cb);
  link(na[Math.floor(rnd() * na.length)], nb[Math.floor(rnd() * nb.length)], 0.11);
}
// read targets: the doc nearest each KB's center (bumped so the ember reads)
const targetOf = (ci) => dots.filter((m) => m.cl === ci).reduce((a, b) => (dist2(b, CL[ci]) < dist2(a, CL[ci]) ? b : a));
const t1 = targetOf(1), t2 = targetOf(3);
t1.r = Math.max(t1.r, 2.5); t2.r = Math.max(t2.r, 2.5);

// ── timeline: three 8s sessions in a 24s loop ────────────────────────────
const DUR = 24;
const SES = [0, 33.333, 66.667];
const EASE = "cubic-bezier(.33,.09,.22,1)";
let css = "";
const kf = (name, frames) => { css += `    @keyframes ${name} { ${frames} }\n`; };
const cls = (name, extra = "") => { css += `    .${name} { animation: ${name} ${DUR}s linear infinite; animation-fill-mode: backwards; ${extra}}\n`; };
// opacity windows: visible from each [in,outEnd], with soft edges
const winKF = (name, windows, slide = "") => {
  cls(name);
  const t0 = slide ? `;transform:${slide}` : "";
  const t1s = slide ? `;transform:translate(0,0)` : "";
  let fr = `0%${windows[0][0] > 0.01 ? `,${f2(windows[0][0])}%` : ""}{opacity:0${t0}}`;
  for (const [i, o] of windows.map(([a, b]) => [a, b])) {
    fr += ` ${f2(i + 1.1)}%{opacity:1${t1s}} ${f2(o - 1.2)}%{opacity:1${t1s}} ${f2(o)}%{opacity:0${t1s}}`;
    const next = windows.find(([a]) => a > o);
    if (next) fr += ` ${f2(next[0])}%{opacity:0${t0}}`;
  }
  fr += ` 100%{opacity:0${t0}}`;
  kf(name, fr);
};
const O = (s, d) => f2(SES[s] + d);

// surfaces 1+2 reload every session, together, fast (the flat tax)
winKF("b1", SES.map((o) => [o + 0.5, o + 32]), "translateX(-14px)");
winKF("b2", SES.map((o) => [o + 0.8, o + 32.3]), "translateX(-14px)");
winKF("free", SES.map((o) => [o + 2.2, o + 31.6]));
// the gray counter shows until a doc lands (s1, s2); all session in s3
winKF("c5", [[O(0, 2.2), O(0, 12.4)], [O(1, 2.2), O(1, 12.4)], [O(2, 2.2), O(2, 31.6)]]);
// task chips, one per session
winKF("tk0", [[O(0, 3), O(0, 30.5)]], "translateY(-8px)");
winKF("tk1", [[O(1, 3), O(1, 30.5)]], "translateY(-8px)");
winKF("tk2", [[O(2, 3), O(2, 30.5)]], "translateY(-8px)");
// the matching router row lights (s1 row1, s2 row2)
const rowKF = (name, s) => {
  cls(name);
  kf(name, `0%,${O(s, 5)}%{fill:#6e7681} ${O(s, 5.8)}%,${O(s, 29.5)}%{fill:#fbbf24} ${O(s, 30.5)}%,100%{fill:#6e7681}`);
};
const rowBoxKF = (name, s) => {
  cls(name);
  kf(name, `0%,${O(s, 5)}%{stroke:transparent} ${O(s, 5.8)}%,${O(s, 29.5)}%{stroke:#4a3a20} ${O(s, 30.5)}%,100%{stroke:transparent}`);
};
rowKF("r1t", 0); rowBoxKF("r1b", 0);
rowKF("r2t", 1); rowBoxKF("r2b", 1);
// s3: both rows get scanned, neither matches
const scanKF = (name, S) => {
  cls(name);
  kf(name, `0%,${f2(S)}%{stroke:transparent} ${f2(S + 0.5)}%{stroke:#6e7681} ${f2(S + 1.3)}%,100%{stroke:transparent}`);
};
scanKF("sc1", O(2, 5)); scanKF("sc2", O(2, 6.4));
winKF("noro", [[O(2, 8.3), O(2, 30.5)]]);
// ping arc, heat, and the doc crossing over (s1, s2)
const pingKF = (name, s) => {
  cls(name);
  kf(name, `0%,${O(s, 6)}%{stroke-dashoffset:100;opacity:0;animation-timing-function:${EASE}} ${O(s, 6.2)}%{opacity:.9;animation-timing-function:${EASE}} ${O(s, 8.2)}%{stroke-dashoffset:0;opacity:.85} ${O(s, 11)}%{stroke-dashoffset:0;opacity:.5} ${O(s, 12.2)}%,100%{stroke-dashoffset:0;opacity:0}`);
};
pingKF("pg0", 0); pingKF("pg1", 1);
// the read dot heats amber, then keeps an ember until the loop ends:
// the vault side remembers; it never resets between sessions
const heatKF = (name, s) => {
  cls(name);
  kf(name, `0%,${O(s, 7.6)}%{opacity:0;fill:#fbbf24} ${O(s, 8.6)}%{opacity:1;fill:#fbbf24} ${O(s, 12)}%{opacity:.95;fill:#7c2d12} 97%{opacity:.95;fill:#7c2d12} 99.3%,100%{opacity:0;fill:#7c2d12}`);
};
heatKF("ht0", 0); heatKF("ht1", 1);
const flyKF = (name, s, dx, dy) => {
  cls(name, "animation-timing-function: cubic-bezier(.45,0,.25,1); ");
  kf(name, `0%,${O(s, 8.8)}%{opacity:0;transform:translate(0,0)} ${O(s, 9.2)}%{opacity:1} ${O(s, 11.2)}%{opacity:1;transform:translate(${dx}px,${dy}px)} ${O(s, 11.8)}%,100%{opacity:0;transform:translate(${dx}px,${dy}px)}`);
};
flyKF("fl0", 0, f2(78 - t1.x), f2(201 - t1.y));
flyKF("fl1", 1, f2(78 - t2.x), f2(201 - t2.y));
// the loaded doc bar (surface 3 crossing into the window)
const docKF = (name, s) => {
  cls(name, "transform-box: fill-box; transform-origin: top; ");
  kf(name, `0%,${O(s, 11.2)}%{opacity:0;transform:scaleY(0)} ${O(s, 11.6)}%{opacity:1} ${O(s, 12.4)}%{opacity:1;transform:scaleY(1)} ${O(s, 30.5)}%{opacity:1;transform:scaleY(1)} ${O(s, 31.6)}%,100%{opacity:0;transform:scaleY(1)}`);
};
docKF("dc0", 0); docKF("dc1", 1);
winKF("c60", [[O(0, 12.4), O(0, 31)]]);
winKF("c61", [[O(1, 12.4), O(1, 31)]]);
winKF("v1a", [[O(0, 12.4), O(0, 31.2)]]);
winKF("v1b", [[O(1, 12.4), O(1, 31.2)]]);
winKF("v0", [[0.01, O(0, 12.4)], [O(0, 31.2), O(1, 12.4)], [O(1, 31.2), 99.4]]);
// per-session punchlines
winKF("pl0", [[O(0, 13.5), O(0, 31)]]);
winKF("pl1", [[O(1, 13.5), O(1, 31)]]);
winKF("pl2", [[O(2, 10), O(2, 31)]]);

// ── SVG ──────────────────────────────────────────────────────────────────
const arc = (ax, ay, bx, by, bulge) => {
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  return `M ${ax} ${ay} Q ${(mx + (-dy / len) * bulge).toFixed(1)} ${(my + (dx / len) * bulge).toFixed(1)} ${bx} ${by}`;
};
let s = "";
s += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 470" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">\n`;
s += `  <title>Four surfaces, two speeds, shown as three sessions back to back. Every session the context window clears and reloads the same two thin surfaces, instructions and router, for about five thousand tokens flat. The vault, drawn as a small knowledge graph, and the session archive sit on the other side and never reset. In session one a router row fires and one payments doc crosses over for 1.4k more; in session two a different row pulls a rate-limiting doc for 1.1k; in session three no row fires and the deep side costs nothing. Read docs keep a burnt ember, and the counters track each session's total.</title>\n`;
s += `  <style>\n${css}  </style>\n`;
s += `  <rect x="0.5" y="0.5" width="879" height="469" rx="12" fill="#0d1117" stroke="#30363d"/>\n`;

// task chips (one per session)
const chip = (cl2, text) =>
  `  <g class="${cl2}">\n` +
  `    <rect x="290" y="8" width="300" height="26" rx="13" fill="#161b22" stroke="#30363d"/>\n` +
  `    <text x="440" y="25" font-size="11.5" fill="#e6edf3" text-anchor="middle">${text}</text>\n` +
  `  </g>\n`;
s += chip("tk0", `session 1 · "why is checkout failing?"`);
s += chip("tk1", `session 2 · "are our rate limits sane?"`);
s += chip("tk2", `session 3 · "rename a config flag"`);

// left: the context window (resets every session)
s += `  <text x="48" y="49" font-size="11" fill="#8b949e" letter-spacing=".08em">CONTEXT WINDOW</text>\n`;
s += `  <text x="168" y="49" font-size="10.5" fill="#4d5566">· reloads every session · flat</text>\n`;
s += `  <rect x="48" y="56" width="360" height="330" rx="10" fill="#10151c" stroke="#30363d"/>\n`;
s += `  <g class="b1">\n`;
s += `    <rect x="64" y="72" width="328" height="34" rx="7" fill="#0b2733" stroke="#2a4a55"/>\n`;
s += `    <text x="76" y="93" font-size="11.5" fill="#67e8f9">① CLAUDE.md · rules</text>\n`;
s += `    <text x="380" y="93" font-size="10.5" fill="#67e8f9" text-anchor="end">≈2k</text>\n`;
s += `  </g>\n`;
s += `  <g class="b2">\n`;
s += `    <rect x="64" y="114" width="328" height="66" rx="7" fill="#1d1530" stroke="#4c3a75"/>\n`;
s += `    <text x="76" y="132" font-size="11.5" fill="#a78bfa">② MEMORY.md router (≤200 lines)</text>\n`;
s += `    <text x="380" y="132" font-size="10.5" fill="#a78bfa" text-anchor="end">≈3k</text>\n`;
s += `    <rect class="r1b sc1" x="72" y="140" width="312" height="16" rx="4" fill="none" stroke="transparent"/>\n`;
s += `    <text class="r1t" x="80" y="152" font-size="10.5" fill="#6e7681">payments → read [[Dunning and Retries]]</text>\n`;
s += `    <rect class="r2b sc2" x="72" y="159" width="312" height="16" rx="4" fill="none" stroke="transparent"/>\n`;
s += `    <text class="r2t" x="80" y="171" font-size="10.5" fill="#6e7681">rate limits → read [[Rate Limiting]]</text>\n`;
s += `  </g>\n`;
s += `  <g class="dc0">\n`;
s += `    <rect x="64" y="188" width="328" height="26" rx="7" fill="#2a1f10" stroke="#4a3a20"/>\n`;
s += `    <text x="76" y="205" font-size="11.5" fill="#fbbf24">Dunning and Retries.md</text>\n`;
s += `    <text x="380" y="205" font-size="10.5" fill="#fbbf24" text-anchor="end">+1.4k</text>\n`;
s += `  </g>\n`;
s += `  <g class="dc1">\n`;
s += `    <rect x="64" y="188" width="328" height="26" rx="7" fill="#2a1f10" stroke="#4a3a20"/>\n`;
s += `    <text x="76" y="205" font-size="11.5" fill="#fbbf24">Rate Limiting.md</text>\n`;
s += `    <text x="380" y="205" font-size="10.5" fill="#fbbf24" text-anchor="end">+1.1k</text>\n`;
s += `  </g>\n`;
s += `  <text class="noro" x="76" y="205" font-size="11" fill="#4d5566">no row fired · nothing loaded from the vault</text>\n`;
s += `  <text class="free" x="228" y="300" font-size="11" fill="#4d5566" text-anchor="middle">~194k free for the actual task</text>\n`;
s += `  <text class="c5" x="392" y="372" font-size="11.5" fill="#8b949e" text-anchor="end">5.0k tok loaded</text>\n`;
s += `  <text class="c60" x="392" y="372" font-size="11.5" fill="#fbbf24" text-anchor="end">6.4k tok loaded</text>\n`;
s += `  <text class="c61" x="392" y="372" font-size="11.5" fill="#fbbf24" text-anchor="end">6.1k tok loaded</text>\n`;

// right: everything it knows (never resets)
s += `  <text x="460" y="49" font-size="11" fill="#8b949e" letter-spacing=".08em">EVERYTHING IT KNOWS</text>\n`;
s += `  <text x="616" y="49" font-size="10.5" fill="#4d5566">· persistent · loads only when routed</text>\n`;
s += `  <rect x="460" y="56" width="372" height="330" rx="10" fill="#10151c" stroke="#30363d"/>\n`;
s += `  <text x="476" y="84" font-size="11" fill="#8b949e">③ vault · docs/vault/ · a wiki-linked graph</text>\n`;
s += `  <g stroke="#8b949e" stroke-width="0.4">\n`;
for (const e of edges) s += `    <line x1="${e.a.x}" y1="${e.a.y}" x2="${e.b.x}" y2="${e.b.y}" opacity="${(+e.o).toFixed(3)}"/>\n`;
s += `  </g>\n`;
s += `  <g>\n`;
for (const n of dots) s += `    <circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${n.c}" opacity="0.92"/>\n`;
s += `  </g>\n`;
s += `  <circle class="ht0" cx="${t1.x}" cy="${t1.y}" r="${(t1.r + 0.7).toFixed(1)}" fill="#fbbf24" opacity="0"/>\n`;
s += `  <circle class="ht1" cx="${t2.x}" cy="${t2.y}" r="${(t2.r + 0.7).toFixed(1)}" fill="#fbbf24" opacity="0"/>\n`;
s += `  <text class="v0" x="476" y="207" font-size="10.5" fill="#6e7681">3,800 docs · ~2.1M tok · 0 loaded</text>\n`;
s += `  <text class="v1a" x="476" y="207" font-size="10.5" fill="#6e7681">3,800 docs · ~2.1M tok · <tspan fill="#fbbf24">1 loaded</tspan></text>\n`;
s += `  <text class="v1b" x="476" y="207" font-size="10.5" fill="#6e7681">3,800 docs · ~2.1M tok · <tspan fill="#fbbf24">1 loaded</tspan></text>\n`;
s += `  <rect x="476" y="224" width="308" height="42" rx="8" fill="#0f1712" stroke="#2b4534"/>\n`;
s += `  <text x="490" y="242" font-size="11" fill="#3fb950">④ session archive</text>\n`;
s += `  <text x="490" y="257" font-size="10" fill="#6e7681">187 sessions · decisions and the why · ≈0 loaded</text>\n`;
s += `  <text x="476" y="296" font-size="11" fill="#4d5566">everything on this side costs 0 tokens</text>\n`;
s += `  <text x="476" y="312" font-size="11" fill="#4d5566">until a router row routes into it</text>\n`;

// the routed reads: row → dot, then the doc crosses over
s += `  <path class="pg0" pathLength="100" d="${arc(388, 148, t1.x - 3, t1.y, -26)}" fill="none" stroke="#fbbf24" stroke-width="1.4"/>\n`;
s += `  <path class="pg1" pathLength="100" d="${arc(388, 167, t2.x - 3, t2.y, -30)}" fill="none" stroke="#fbbf24" stroke-width="1.4"/>\n`;
s += `  <circle class="fl0" cx="${t1.x}" cy="${t1.y}" r="3.4" fill="#fbbf24"/>\n`;
s += `  <circle class="fl1" cx="${t2.x}" cy="${t2.y}" r="3.4" fill="#fbbf24"/>\n`;

// per-session punchlines + the standing thesis
s += `  <text class="pl0" x="440" y="424" font-size="12" fill="#8b949e" text-anchor="middle">session 1: <tspan fill="#fbbf24">6.4k</tspan> of ~3.0M known (0.2%) · chosen by a row, not similarity</text>\n`;
s += `  <text class="pl1" x="440" y="424" font-size="12" fill="#8b949e" text-anchor="middle">session 2: <tspan fill="#fbbf24">6.1k</tspan> · a different row, a different KB, same flat base</text>\n`;
s += `  <text class="pl2" x="440" y="424" font-size="12" fill="#8b949e" text-anchor="middle">session 3: 5.0k · no row fired, the deep side cost nothing</text>\n`;
s += `  <text x="440" y="450" font-size="11" fill="#6e7681" text-anchor="middle">memory can grow without bound; the per-session tax stays flat</text>\n`;
s += `</svg>\n`;

writeFileSync(new URL("./context-window.svg", import.meta.url).pathname, s);
console.log(`context-window.svg: 3 sessions/${DUR}s, ${dots.length} vault dots, ${edges.length} edges, ${(s.length / 1024).toFixed(0)} KB`);
