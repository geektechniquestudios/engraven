#!/usr/bin/env node
// Generator for assets/graph.svg: a synthetic Obsidian-style vault graph.
// The still image is a mature vault; the animation layer is a day in its
// life: four lookups land four different ways (3-hop drill-down, 1-hop deep
// link, cross-KB wiki-link, episodic archive read) with node names appearing
// at each hop, while a new KB quietly grows in the background and stale docs
// get repaired. When the new KB matures, synthesis welds it into its
// neighbor KBs with persistent violet links; a fifth lookup then routes
// into it, and a sixth rides a weld across the seam. Traces draw as eased
// curves with a comet head at the drawing tip.
// Deterministic (seeded PRNG) so regeneration is reproducible.
// Run from the repo root: node assets/gen-graph.mjs
import { writeFileSync } from "node:fs";

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(42);
const R = (lo, hi) => lo + rnd() * (hi - lo);

const W = 1200, H = 800, CAP_Y = 738; // caption zone below
const clusters = [
  { x: 170, y: 180, r: 95, n: 72, c: "#4cc9f0" },
  { x: 395, y: 140, r: 80, n: 55, c: "#f72585" },
  { x: 610, y: 115, r: 70, n: 48, c: "#ffd60a" },
  { x: 835, y: 150, r: 85, n: 60, c: "#7209b7" },
  { x: 1050, y: 230, r: 75, n: 52, c: "#3a86ff" },
  { x: 150, y: 415, r: 80, n: 58, c: "#2dd4bf" },
  { x: 360, y: 330, r: 72, n: 50, c: "#f77f00" },
  { x: 585, y: 300, r: 88, n: 66, c: "#80ed99" },
  { x: 810, y: 345, r: 92, n: 70, c: "#e63946" },
  { x: 1035, y: 450, r: 78, n: 54, c: "#b5179e" },
  { x: 215, y: 610, r: 85, n: 62, c: "#90be6d" },
  { x: 435, y: 545, r: 70, n: 46, c: "#f9c74f" },
  { x: 655, y: 545, r: 82, n: 58, c: "#577590" },
  { x: 860, y: 595, r: 88, n: 64, c: "#43aa8b" },
  { x: 1055, y: 655, r: 64, n: 40, c: "#c77dff" },
  { x: 520, y: 685, r: 58, n: 36, c: "#768390" }, // the session archive: muted slate
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const nodes = []; // {x,y,r,c,cluster,hub}
clusters.forEach((cl, ci) => {
  const stretch = R(1.0, 1.35), rot = R(0, Math.PI);
  for (let i = 0; i < cl.n; i++) {
    const a = R(0, Math.PI * 2);
    // sqrt for disk-uniform, squeezed toward center for blob density
    const d = cl.r * Math.sqrt(rnd()) * R(0.55, 1.0);
    let dx = Math.cos(a) * d * stretch, dy = Math.sin(a) * d;
    const x = clamp(cl.x + dx * Math.cos(rot) - dy * Math.sin(rot), 26, W - 26);
    const y = clamp(cl.y + dx * Math.sin(rot) + dy * Math.cos(rot), 26, CAP_Y - 14);
    const hub = rnd() < 0.08;
    const gray = rnd() < 0.09;
    nodes.push({ x: +x.toFixed(1), y: +y.toFixed(1), r: hub ? +R(4.2, 6.4).toFixed(1) : +R(1.5, 3.1).toFixed(1), c: gray ? "#8b949e" : cl.c, cluster: ci, hub });
  }
});
// stragglers between clusters
for (let i = 0; i < 90; i++) {
  nodes.push({ x: +R(30, W - 30).toFixed(1), y: +R(30, CAP_Y - 16).toFixed(1), r: +R(1.2, 2.2).toFixed(1), c: "#6e7681", cluster: -1, hub: false });
}

const byCluster = clusters.map((_, ci) => nodes.filter((n) => n.cluster === ci));
const hubsOf = byCluster.map((ns) => ns.filter((n) => n.hub));

const intra = [], weave = [], highways = []; // {a,b,o}
byCluster.forEach((ns, ci) => {
  const hubs = hubsOf[ci].length ? hubsOf[ci] : ns.slice(0, 3);
  ns.forEach((n) => {
    const h = hubs[Math.floor(rnd() * hubs.length)];
    if (h !== n) intra.push({ a: n, b: h, o: R(0.12, 0.2) });
    if (rnd() < 0.35) {
      const m = ns[Math.floor(rnd() * ns.length)];
      if (m !== n) intra.push({ a: n, b: m, o: R(0.09, 0.15) });
    }
  });
});
// inter-cluster weave: the cross-links, kept clearly visible on dark screens
for (let i = 0; i < 150; i++) {
  const ca = Math.floor(rnd() * clusters.length);
  let cb = Math.floor(rnd() * clusters.length);
  if (cb === ca) cb = (cb + 1) % clusters.length;
  const a = byCluster[ca][Math.floor(rnd() * byCluster[ca].length)];
  const b = byCluster[cb][Math.floor(rnd() * byCluster[cb].length)];
  weave.push({ a, b, o: R(0.11, 0.17) });
}
// hub highways
for (let i = 0; i < 16; i++) {
  const ca = i % clusters.length;
  let cb = Math.floor(rnd() * clusters.length);
  if (cb === ca) cb = (cb + 3) % clusters.length;
  const a = hubsOf[ca][0] || byCluster[ca][0];
  const b = hubsOf[cb][0] || byCluster[cb][0];
  highways.push({ a, b, o: 0.2 });
}
// no orphans: every straggler links to its nearest clustered doc
// (fixed opacity, zero PRNG draws, so the approved layout is untouched)
const stragglerEdges = [];
for (const st of nodes.filter((n) => n.cluster === -1)) {
  let best = null, bd = Infinity;
  for (const n of nodes) {
    if (n.cluster === -1) continue;
    const d = (n.x - st.x) ** 2 + (n.y - st.y) ** 2;
    if (d < bd) { bd = d; best = n; }
  }
  stragglerEdges.push({ a: st, b: best, o: 0.13 });
}

// pulsing hubs (staggered halos)
const haloPicks = [0, 3, 7, 10, 13, 4].map((ci) => hubsOf[ci][0] || byCluster[ci][0]);

// ── the animation cast (deterministic picks; no PRNG so layout is stable) ──
const INDEX = { x: 598, y: 428 };
const dist2 = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const far = (ns, from, skip = []) => {
  let best = null, bd = -1;
  for (const n of ns) {
    if (n === from || skip.includes(n)) continue;
    const d = (n.x - from.x) ** 2 + (n.y - from.y) ** 2;
    if (d > bd) { bd = d; best = n; }
  }
  return best;
};
// a traversal should visibly change direction at each hop: pick the node
// with the biggest perpendicular offset from the straight a→b line
const zigPick = (ns, a, b, skip = []) => {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  let best = null, bd = -1;
  for (const n of ns) {
    if (n === a || n === b || skip.includes(n)) continue;
    const t = ((n.x - a.x) * dx + (n.y - a.y) * dy) / (len * len);
    if (t < 0.15 || t > 0.85) continue; // stay between the endpoints
    const perp = Math.abs((n.x - a.x) * dy - (n.y - a.y) * dx) / len;
    const score = perp * (n.hub ? 1.5 : 1);
    if (score > bd) { bd = score; best = n; }
  }
  return best || far(ns, a, [b, ...skip]);
};

// L1 · drill-down, 3 hops (the dev-east read)
const l1meta = hubsOf[0][0] || byCluster[0][0];
const l1doc = far(byCluster[0], l1meta);
const l1hub = zigPick(byCluster[0], l1meta, l1doc);
// L2 · deep link, 1 hop
const l2doc = hubsOf[9][0] || byCluster[9][0];
// L3 · cross-KB: hop to one doc, wiki-link arc to its neighbor KB
const l3a = hubsOf[6][0] || byCluster[6][0];
const l3b = hubsOf[7][0] || byCluster[7][0];
// L4 · episodic: two hops into the session archive
const l4sai = hubsOf[15][0] || byCluster[15][0];
const l4doc = far(byCluster[15], l4sai);
// stale repairs, spread through the day
const repairs = [byCluster[2][7], byCluster[8][11], byCluster[12][9]];

// new KB growing in the background (all PRNG below runs after the existing
// layout draws)
const NK = { x: 365, y: 455, r: 42, c: "#fb7185" };
const nkNodes = [];
for (let i = 0; i < 13; i++) {
  const a = R(0, Math.PI * 2);
  const d = NK.r * Math.sqrt(rnd()) * R(0.5, 1.0);
  nkNodes.push({
    x: +(NK.x + Math.cos(a) * d * 1.2).toFixed(1),
    y: +(NK.y + Math.sin(a) * d).toFixed(1),
    r: +R(1.8, 3).toFixed(1),
    wave: Math.min(3, Math.floor(i / 3.5)),
    jit: +R(-0.1, 0.1).toFixed(2),
  });
}
const nkEdges = nkNodes.slice(1).map((n) => {
  let best = nkNodes[0], bd = Infinity;
  for (const m of nkNodes) {
    if (m === n || m.wave > n.wave) continue;
    const d = (n.x - m.x) ** 2 + (n.y - m.y) ** 2;
    if (d < bd) { bd = d; best = m; }
  }
  return { a: n, b: best, w: n.wave };
});
// a young KB isn't a bare tree: each later node also cross-links to its
// second-nearest settled neighbor (deterministic, zero PRNG draws)
{
  const key = (p, q) => [nkNodes.indexOf(p), nkNodes.indexOf(q)].sort((a, b) => a - b).join(":");
  const seen = new Set(nkEdges.map((e) => key(e.a, e.b)));
  for (const n of nkNodes) {
    if (n.wave === 0) continue;
    const cands = nkNodes
      .filter((m) => m !== n && m.wave <= n.wave)
      .sort((p, q) => dist2(p, n) - dist2(q, n));
    for (const m of cands.slice(0, 2)) {
      if (seen.has(key(n, m))) continue;
      seen.add(key(n, m));
      nkEdges.push({ a: n, b: m, w: n.wave });
      break;
    }
  }
}
// L5 · the payoff: a lookup routes into the KB that just grew; the doc is
// picked north of the meta so its label clears the meta-analysis label
const nkMeta = { x: NK.x, y: NK.y, r: 5.5 };
const nkDoc = far(nkNodes.filter((n) => n.y <= NK.y - 6), nkMeta) || far(nkNodes, nkMeta);
// L6 · a cross-KB read rides a synthesis weld into the new cluster; the doc
// is the west-most node so its left-anchored label clears the meta's label
const l6doc = nkNodes.filter((n) => n !== nkDoc).reduce((a, b) => (b.x < a.x ? b : a));
// the meta-analysis wires itself to its nearest docs as it forms
const nkSpokes = nkNodes
  .slice()
  .sort((m, n) => dist2(m, nkMeta) - dist2(n, nkMeta))
  .slice(0, 7)
  .map((n) => ({ a: nkMeta, b: n }));
// synthesis welds: once the meta forms, the new KB is linked into its
// neighbors (the rate-limiting hub the sixth lookup will ride, plus the
// nearest docs of the two adjacent KBs). Welds persist: they are structure.
const nearNK = (ns) => ns.reduce((a, b) => (dist2(b, NK) < dist2(a, NK) ? b : a));
const welds = [
  { a: nkMeta, b: l3b, bulge: 34 },
  { a: nkMeta, b: nearNK(byCluster[6]), bulge: -18 },
  { a: nkMeta, b: nearNK(byCluster[11]), bulge: 16 },
];

const arcPath = (a, b, bulge) => {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  return `M ${a.x} ${a.y} Q ${(mx + (-dy / len) * bulge).toFixed(1)} ${(my + (dx / len) * bulge).toFixed(1)} ${b.x} ${b.y}`;
};

// ── SVG ─────────────────────────────────────────────────────────────────────
const DUR = 32;
const EASE = "cubic-bezier(.33,.09,.22,1)"; // quick start, feathered landing
let css = "";
const kf = (name, frames) => { css += `    @keyframes ${name} { ${frames} }\n`; };
const cls = (name, extra = "") => { css += `    .${name} { animation: ${name} ${DUR}s linear infinite; animation-fill-mode: backwards; ${extra}}\n`; };
const f2 = (v) => +v.toFixed(2);

// a routed read: the curve draws with an eased sweep, holds, melts away
const lineKF = (name, S, E, F) => {
  cls(name);
  kf(name, `0%,${S}%{stroke-dashoffset:100;opacity:0;animation-timing-function:${EASE}} ${f2(S + 0.25)}%{opacity:.9;animation-timing-function:${EASE}} ${E}%{stroke-dashoffset:0;opacity:.88} ${f2(F - 2.5)}%{stroke-dashoffset:0;opacity:.65} ${F}%,100%{stroke-dashoffset:0;opacity:0}`);
};
// the comet: a bright 7-unit head riding the drawing tip of the same curve
const cometKF = (name, S, E) => {
  cls(name);
  kf(name, `0%,${S}%{stroke-dashoffset:107;opacity:0;animation-timing-function:${EASE}} ${f2(S + 0.25)}%{opacity:.95;animation-timing-function:${EASE}} ${E}%{stroke-dashoffset:7;opacity:.9} ${f2(E + 1.6)}%,100%{stroke-dashoffset:7;opacity:0}`);
};
// a node name label: in at S, out by F
const textKF = (name, S, F) => {
  cls(name);
  kf(name, `0%,${S}%{opacity:0} ${f2(S + 1)}%{opacity:1} ${f2(F - 1.4)}%{opacity:1} ${F}%,100%{opacity:0}`);
};
// a violet potentiation pulse: some of the landed node's own links glow
// exactly as its name shows (never all of them, and never the index's)
const burstKF = (name, S) => {
  cls(name);
  kf(name, `0%,${S}%{opacity:0} ${f2(S + 0.7)}%{opacity:.85} ${f2(S + 2.2)}%{opacity:.65} ${f2(S + 3.8)}%{opacity:0} 100%{opacity:0}`);
};
// the index pings when a lookup starts
const pingKF = (name, S) => {
  cls(name, "transform-box: fill-box; transform-origin: center; ");
  kf(name, `0%,${S}%{transform:scale(.4);opacity:.9} ${f2(S + 3.5)}%{transform:scale(2.4);opacity:0} 100%{transform:scale(2.4);opacity:0}`);
};
// one lookup segment = eased curve + comet head, drawn together
const seg = (name, S, E, F) => { lineKF(name, S, E, F); cometKF(`c${name}`, S, E); };

// L1 drill-down: index → meta → hub → doc (1.5%..21%)
pingKF("i1", 1);
seg("l1a", 1.5, 5, 21); burstKF("f1a", 4.6); textKF("t1a", 5, 20);
seg("l1b", 5.5, 8.2, 21); burstKF("f1b", 7.8); textKF("t1b", 8.2, 20);
seg("l1c", 8.7, 11.4, 21); burstKF("f1c", 11); textKF("t1c", 11.4, 20);
// L2 deep link: one hop, done (23%..33%)
pingKF("i2", 22.5);
seg("l2", 23, 26.5, 33); burstKF("f2", 26.1); textKF("t2", 26.5, 32);
// L3 cross-KB: hop, then the wiki-link bridge (35%..47%)
pingKF("i3", 34.5);
seg("l3a", 35, 38, 47); burstKF("f3a", 37.6); textKF("t3a", 38, 45.5);
seg("l3x", 38.5, 41.5, 47); burstKF("f3b", 41.1); textKF("t3b", 41.5, 45.5);
// L4 episodic: two hops into the archive (49%..61%)
pingKF("i4", 48.5);
seg("l4a", 49, 52, 61); burstKF("f4a", 51.6); textKF("t4a", 52, 59.5);
seg("l4b", 52.5, 55.5, 61); burstKF("f4b", 55.1); textKF("t4b", 55.5, 59.5);
// ...meanwhile a new KB has been growing all along (8%..58%)
[8, 22, 36, 50].forEach((S, k) => {
  cls(`nw${k}`, "transform-box: fill-box; transform-origin: center; ");
  kf(`nw${k}`, `0%,${S}%{transform:scale(0);opacity:0} ${f2(S + 0.7)}%{transform:scale(1.3);opacity:1} ${f2(S + 1.3)}%{transform:scale(1)} 95.5%{transform:scale(1);opacity:1} 99.2%,100%{transform:scale(1);opacity:0}`);
  cls(`ne${k}`);
  kf(`ne${k}`, `0%,${f2(S + 1)}%{stroke-dashoffset:100;opacity:0;animation-timing-function:${EASE}} ${f2(S + 1.2)}%{opacity:.5} ${f2(S + 2.6)}%{stroke-dashoffset:0;opacity:.3} 95.5%{stroke-dashoffset:0;opacity:.25} 99.2%,100%{opacity:0}`);
});
cls("nkm", "transform-box: fill-box; transform-origin: center; ");
kf("nkm", `0%,60%{transform:scale(0);opacity:0} 60.8%{transform:scale(1.35);opacity:1} 61.5%{transform:scale(1)} 95.5%{transform:scale(1);opacity:1} 99.2%,100%{opacity:0}`);
cls("nkh", "transform-box: fill-box; transform-origin: center; ");
kf("nkh", `0%,60%{transform:scale(.4);opacity:0} 60.8%{opacity:.85} 64%{transform:scale(2.1);opacity:0} 100%{transform:scale(2.1);opacity:0}`);
// the meta's name shows twice, briefly, matching every other label's
// rhythm: once as the node forms, once when the finale lookup lands on it
cls("nkl");
kf("nkl", `0%,61.5%{opacity:0} 62.5%{opacity:1} 65.2%{opacity:1} 66.4%{opacity:0} 70.3%{opacity:0} 71.3%{opacity:1} 78.1%{opacity:1} 79.5%,100%{opacity:0}`);
// the meta's spokes draw as it forms; then the synthesis welds reach out to
// the neighbor KBs, draw once, and settle in as permanent structure
cls("nsp");
kf("nsp", `0%,60.8%{stroke-dashoffset:100;opacity:0;animation-timing-function:${EASE}} 61%{opacity:.6;animation-timing-function:${EASE}} 62.8%{stroke-dashoffset:0;opacity:.45} 65%{stroke-dashoffset:0;opacity:.3} 95.5%{stroke-dashoffset:0;opacity:.28} 99.2%,100%{opacity:0}`);
const weldKF = (name, S, E) => {
  cls(name);
  kf(name, `0%,${S}%{stroke-dashoffset:100;opacity:0;animation-timing-function:${EASE}} ${f2(S + 0.25)}%{opacity:.85;animation-timing-function:${EASE}} ${E}%{stroke-dashoffset:0;opacity:.7} ${f2(E + 3)}%{stroke-dashoffset:0;opacity:.34} 95.5%{stroke-dashoffset:0;opacity:.3} 99.2%,100%{stroke-dashoffset:0;opacity:0}`);
  cometKF(`c${name}`, S, E);
};
weldKF("wd0", 61.5, 64.3);
weldKF("wd1", 62.7, 65.2);
weldKF("wd2", 63.9, 66.2);
// L5 the finale: routing into the KB that grew during the demo (67%..80%)
pingKF("i5", 66.5);
seg("l5a", 67, 69.8, 80); burstKF("f5a", 69.4);
seg("l5b", 70.3, 72.8, 80); burstKF("f5b", 72.4); textKF("t5b", 72.8, 79.5);
// L6: a cross-KB read rides a fresh weld into the new cluster (81%..96%)
pingKF("i6", 80.5);
seg("l6a", 81, 83.4, 96); burstKF("f6a", 83); textKF("t6a", 83.4, 93.5);
seg("l6x", 83.9, 87.3, 96); burstKF("f6b", 86.9); textKF("t6b", 87.3, 94);
// ...while stale docs get repaired: red pulse → green pulse → healthy
[24, 40, 56].forEach((S, k) => {
  cls(`rp${k}`, "transform-box: fill-box; transform-origin: center; ");
  kf(`rp${k}`, `0%,${S}%{transform:scale(.5);opacity:0;stroke:#f85149} ${f2(S + 0.5)}%{opacity:.95;stroke:#f85149} ${f2(S + 2)}%{transform:scale(1.5);stroke:#f85149;opacity:.7} ${f2(S + 2.5)}%{stroke:#3fb950;opacity:.95} ${f2(S + 5)}%{transform:scale(2.1);stroke:#3fb950;opacity:0} 100%{transform:scale(2.1);opacity:0}`);
});
// ambient life
css += `    .halo { transform-box: fill-box; transform-origin: center; animation: halo 7s infinite; }\n`;
kf("halo", `0%{transform:scale(.5);opacity:.8} 60%{transform:scale(2.6);opacity:0} 100%{transform:scale(2.6);opacity:0}`);
css += `    .idx { animation: idxb 6s ease-in-out infinite; }\n`;
kf("idxb", `0%,100%{opacity:.85} 50%{opacity:1}`);

let s = "";
s += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">\n`;
s += `  <title>A mature Engraven vault as a graph: every dot a doc, every line a wiki-link, every color a knowledge base. Six lookups land six different ways (a three-hop drill-down to the dev-east runbook, a one-hop deep link, a cross-KB wiki-link read, an episodic archive read, a read into a knowledge base that grew during the demo, and a cross-KB read riding one of the synthesis links that welded the new KB to its neighbors), each hop naming the doc it lands on while stale docs elsewhere are repaired.</title>\n`;
s += `  <style>\n${css}  </style>\n`;
s += `  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="#0d1117" stroke="#30363d"/>\n`;

s += `  <g stroke="#8b949e" stroke-width="0.5">\n`;
for (const e of intra) s += `    <line x1="${e.a.x}" y1="${e.a.y}" x2="${e.b.x}" y2="${e.b.y}" opacity="${e.o.toFixed(3)}"/>\n`;
s += `  </g>\n`;
s += `  <g stroke="#9aa5b1" stroke-width="0.65">\n`;
for (const e of weave) s += `    <line x1="${e.a.x}" y1="${e.a.y}" x2="${e.b.x}" y2="${e.b.y}" opacity="${e.o.toFixed(3)}"/>\n`;
s += `  </g>\n`;
s += `  <g stroke="#9aa5b1" stroke-width="0.85">\n`;
for (const e of highways) s += `    <line x1="${e.a.x}" y1="${e.a.y}" x2="${e.b.x}" y2="${e.b.y}" opacity="${e.o.toFixed(3)}"/>\n`;
s += `  </g>\n`;
s += `  <g stroke="#8b949e" stroke-width="0.5">\n`;
for (const e of stragglerEdges) s += `    <line x1="${e.a.x}" y1="${e.a.y}" x2="${e.b.x}" y2="${e.b.y}" opacity="${e.o}"/>\n`;
s += `  </g>\n`;

s += `  <g>\n`;
for (const n of nodes) s += `    <circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${n.c}"${n.hub ? "" : ` opacity="0.92"`}/>\n`;
s += `  </g>\n`;

haloPicks.forEach((h, i) => {
  s += `  <circle class="halo" cx="${h.x}" cy="${h.y}" r="9" fill="none" stroke="${clusters[[0, 3, 7, 10, 13, 4][i]].c}" stroke-width="1.6" style="animation-delay:${(i * 1.15).toFixed(2)}s"/>\n`;
});

// hop label helper: stroked name that appears when the trace lands
const label = (cl2, n, text, dy = 20, side = null) => {
  if (side === "left") {
    return `  <text class="${cl2}" x="${(n.x - 14).toFixed(1)}" y="${(n.y + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="#dbe2ea" stroke="#0d1117" stroke-width="3.5" paint-order="stroke">${text}</text>\n`;
  }
  const lx = clamp(n.x, 118, W - 118);
  const ly = n.y > CAP_Y - 44 ? n.y - 14 : n.y + dy;
  return `  <text class="${cl2}" x="${lx}" y="${ly}" text-anchor="middle" font-size="11.5" fill="#dbe2ea" stroke="#0d1117" stroke-width="3.5" paint-order="stroke">${text}</text>\n`;
};
// one traversal segment: the eased curve plus its comet twin on the same path
const trace = (cl2, a, b, bulge, w = 1.2) => {
  const d = arcPath(a, b, bulge);
  return (
    `    <path class="${cl2}" pathLength="100" d="${d}" stroke-width="${w}"/>\n` +
    `    <path class="c${cl2}" pathLength="100" d="${d}" stroke="#fde68a" stroke-width="${(w + 0.6).toFixed(1)}" stroke-dasharray="7 93" stroke-linecap="round"/>\n`
  );
};
const allEdges = [...intra, ...weave, ...highways, ...stragglerEdges, ...nkEdges];
const flash = (cl2, n, k = 0) => {
  // roughly half of this node's real links, shortest first, capped so a
  // hub landing never floods the canvas
  const inc = allEdges
    .filter((e) => e.a === n || e.b === n)
    .sort((e1, e2) => {
      const len = (e) => (e.a.x - e.b.x) ** 2 + (e.a.y - e.b.y) ** 2;
      return len(e1) - len(e2);
    });
  const take = Math.max(1, Math.min(5, Math.ceil(inc.length * 0.45)));
  const picked = inc.filter((_, i) => i % 2 === k % 2).slice(0, take);
  const chosen = picked.length ? picked : inc.slice(0, take);
  let g = `  <g class="${cl2}" stroke="#a78bfa" stroke-width="1.1" stroke-linecap="round" fill="none" opacity="0">\n`;
  for (const e of chosen) g += `    <line x1="${e.a.x}" y1="${e.a.y}" x2="${e.b.x}" y2="${e.b.y}"/>\n`;
  return g + `  </g>\n`;
};

// the five lookups (amber = routed read, violet = wiki-link bridge)
s += `  <g fill="none" stroke="#fbbf24">\n`;
s += `    <circle class="i1" cx="${INDEX.x}" cy="${INDEX.y}" r="8" stroke-width="1.5"/>\n`;
s += trace("l1a", INDEX, l1meta, 26);
s += trace("l1b", l1meta, l1hub, -20);
s += trace("l1c", l1hub, l1doc, 16);
s += `    <circle class="i2" cx="${INDEX.x}" cy="${INDEX.y}" r="8" stroke-width="1.5"/>\n`;
s += trace("l2", INDEX, l2doc, 30);
s += `    <circle class="i3" cx="${INDEX.x}" cy="${INDEX.y}" r="8" stroke-width="1.5"/>\n`;
s += trace("l3a", INDEX, l3a, -24);
s += `    <circle class="i4" cx="${INDEX.x}" cy="${INDEX.y}" r="8" stroke-width="1.5"/>\n`;
s += trace("l4a", INDEX, l4sai, 22);
s += trace("l4b", l4sai, l4doc, -16);
s += `    <circle class="i5" cx="${INDEX.x}" cy="${INDEX.y}" r="8" stroke-width="1.5"/>\n`;
s += trace("l5a", INDEX, nkMeta, -24);
s += trace("l5b", nkMeta, nkDoc, 14);
s += `    <circle class="i6" cx="${INDEX.x}" cy="${INDEX.y}" r="8" stroke-width="1.5"/>\n`;
s += trace("l6a", INDEX, l3b, 20);
s += `  </g>\n`;
s += `  <g fill="none" stroke="#a78bfa">\n`;
s += trace("l3x", l3a, l3b, -36, 1.1).replace('stroke="#fde68a"', 'stroke="#c4b5fd"');
s += trace("l6x", l3b, l6doc, -22, 1.1).replace('stroke="#fde68a"', 'stroke="#c4b5fd"');
s += `  </g>\n`;

s += flash("f1a", l1meta, 0) + flash("f1b", l1hub, 1) + flash("f1c", l1doc, 2);
s += flash("f2", l2doc, 3);
s += flash("f3a", l3a, 4) + flash("f3b", l3b, 5);
s += flash("f4a", l4sai, 6) + flash("f4b", l4doc, 7);
s += flash("f5a", nkMeta, 8) + flash("f5b", nkDoc, 9);
s += flash("f6a", l3b, 10) + flash("f6b", l6doc, 11);

s += label("t1a", l1meta, "Infrastructure - Meta-Analysis");
s += label("t1b", l1hub, "AWS Environments - Section Hub");
s += label("t1c", l1doc, "dev-east Access Runbook");
s += label("t2", l2doc, "Deploy Freeze Checklist");
s += label("t3a", l3a, "Caching Strategy");
s += label("t3b", l3b, "Rate Limiting");
s += label("t4a", l4sai, "Session Archive Index");
s += label("t4b", l4doc, "2026-05-12 Incident Review", 20, "left");
s += label("t5b", nkDoc, "Backpressure Thresholds", -12);

// the new KB grows through the whole demo, then gets looked up
s += `  <g stroke="${NK.c}" stroke-width="0.6" fill="none">\n`;
for (const e of nkEdges) s += `    <line class="ne${e.w}" pathLength="100" x1="${e.a.x}" y1="${e.a.y}" x2="${e.b.x}" y2="${e.b.y}"/>\n`;
for (const e of nkSpokes) s += `    <line class="nsp" pathLength="100" x1="${e.a.x}" y1="${e.a.y}" x2="${e.b.x}" y2="${e.b.y}"/>\n`;
s += `  </g>\n`;
s += `  <g fill="none" stroke="#a78bfa" stroke-width="1">\n`;
welds.forEach((wl, k) => {
  const d = arcPath(wl.a, wl.b, wl.bulge);
  s += `    <path class="wd${k}" pathLength="100" d="${d}"/>\n`;
  s += `    <path class="cwd${k}" pathLength="100" d="${d}" stroke="#c4b5fd" stroke-width="1.6" stroke-dasharray="7 93" stroke-linecap="round"/>\n`;
});
s += `  </g>\n`;
s += `  <g fill="${NK.c}">\n`;
for (const n of nkNodes) s += `    <circle class="nw${n.wave}" cx="${n.x}" cy="${n.y}" r="${n.r}" style="animation-delay:${n.jit}s"/>\n`;
s += `  </g>\n`;
s += `  <circle class="nkh" cx="${NK.x}" cy="${NK.y}" r="10" fill="none" stroke="${NK.c}" stroke-width="1.6"/>\n`;
s += `  <circle class="nkm" cx="${NK.x}" cy="${NK.y}" r="5.5" fill="${NK.c}"/>\n`;
s += label("nkl", { x: NK.x, y: NK.y, r: 5.5 }, "Queue Backpressure - Meta-Analysis", 24);
s += label("t6a", l3b, "Rate Limiting");
s += label("t6b", l6doc, "Load Shedding Policy", 20, "left");
repairs.forEach((n, k) => {
  s += `  <circle class="rp${k}" cx="${n.x}" cy="${n.y}" r="${(Math.max(+n.r, 3) + 6).toFixed(1)}" fill="none" stroke="#f85149" stroke-width="1.8"/>\n`;
});

// the index node: where every lookup starts
s += `  <circle class="idx" cx="${INDEX.x}" cy="${INDEX.y}" r="5.5" fill="#e6edf3"/>\n`;
s += `  <text x="${INDEX.x}" y="${INDEX.y + 22}" text-anchor="middle" font-size="11.5" fill="#dbe2ea" stroke="#0d1117" stroke-width="3.5" paint-order="stroke">00-Index</text>\n`;

s += `  <text x="${W / 2}" y="766" text-anchor="middle" font-size="13" fill="#8b949e">every dot a doc · every line a [[wiki-link]] · every color a KB</text>\n`;
s += `  <text x="${W / 2}" y="786" text-anchor="middle" font-size="11" fill="#6e7681">one day in the vault's life: six lookups, three repairs, and a new KB welded in as it grows</text>\n`;
s += `</svg>\n`;

writeFileSync(new URL("./graph.svg", import.meta.url).pathname, s);
console.log(`graph.svg: ${nodes.length + nkNodes.length} nodes, ${intra.length + weave.length + highways.length + stragglerEdges.length + nkEdges.length + nkSpokes.length + welds.length} edges, 6 lookups, 3 welds, 3 repairs, ${(s.length / 1024).toFixed(0)} KB`);
