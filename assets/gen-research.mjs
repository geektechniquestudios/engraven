#!/usr/bin/env node
// Generator for assets/research.svg: one /research run, in timelapse.
// A new KB cluster grows in a settled vault graph: sources land in bursts,
// hubs and a meta-analysis form, synthesis links weld it into neighboring
// clusters, and one router row indexes it. Deterministic (seeded PRNG).
// Run from the repo root: node assets/gen-research.mjs
import { writeFileSync } from "node:fs";

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(7);
const R = (lo, hi) => lo + rnd() * (hi - lo);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const f1 = (v) => +v.toFixed(1);
const f2 = (v) => +v.toFixed(2);

const W = 1200, H = 800, CAP_Y = 738;

// ── settled clusters (the vault as it already exists) ──────────────────────
const settled = [
  { x: 185, y: 185, r: 88, n: 56, c: "#4cc9f0" }, // A cyan
  { x: 585, y: 140, r: 76, n: 48, c: "#ffd60a" }, // B yellow
  { x: 1015, y: 185, r: 80, n: 50, c: "#3a86ff" }, // C blue
  { x: 170, y: 545, r: 84, n: 54, c: "#2dd4bf" }, // D teal
  { x: 480, y: 640, r: 78, n: 50, c: "#80ed99" }, // E green
  { x: 1010, y: 640, r: 72, n: 44, c: "#c77dff" }, // F lavender
];
const NEW = { x: 820, y: 330, r: 100, n: 48, c: "#fb7185" }; // G rose, grows live
const INDEX = { x: 480, y: 425 };
const VIOLET = "#a78bfa", AMBER = "#fbbf24";

function blob(cl) {
  const out = [];
  const stretch = R(1.0, 1.3), rot = R(0, Math.PI);
  for (let i = 0; i < cl.n; i++) {
    const a = R(0, Math.PI * 2);
    const d = cl.r * Math.sqrt(rnd()) * R(0.55, 1.0);
    const dx = Math.cos(a) * d * stretch, dy = Math.sin(a) * d;
    const x = clamp(cl.x + dx * Math.cos(rot) - dy * Math.sin(rot), 26, W - 26);
    const y = clamp(cl.y + dx * Math.sin(rot) + dy * Math.cos(rot), 26, CAP_Y - 14);
    const hub = rnd() < 0.08;
    out.push({ x: f1(x), y: f1(y), r: hub ? f1(R(4.0, 6.0)) : f1(R(1.5, 3.0)), hub });
  }
  return out;
}

const settledNodes = settled.map(blob);
const settledHubs = settledNodes.map((ns, i) => {
  const hs = ns.filter((n) => n.hub);
  return hs.length ? hs : [ns[0]];
});

// settled intra edges
const sIntra = [];
settledNodes.forEach((ns, ci) => {
  const hubs = settledHubs[ci];
  ns.forEach((n) => {
    const h = hubs[Math.floor(rnd() * hubs.length)];
    if (h !== n) sIntra.push({ a: n, b: h, o: R(0.09, 0.16) });
    if (rnd() < 0.32) {
      const m = ns[Math.floor(rnd() * ns.length)];
      if (m !== n) sIntra.push({ a: n, b: m, o: R(0.07, 0.12) });
    }
  });
});
// settled weave (never touching the empty region where the new KB will grow)
const sWeave = [];
for (let i = 0; i < 44; i++) {
  const ca = Math.floor(rnd() * settled.length);
  let cb = Math.floor(rnd() * settled.length);
  if (cb === ca) cb = (cb + 1) % settled.length;
  const a = settledNodes[ca][Math.floor(rnd() * settledNodes[ca].length)];
  const b = settledNodes[cb][Math.floor(rnd() * settledNodes[cb].length)];
  sWeave.push({ a, b, o: R(0.08, 0.13) });
}
// ambient strays, kept out of the growth void; each gets a faint edge to
// its nearest settled doc (no orphan nodes, fixed opacity, zero PRNG draws)
const strays = [];
while (strays.length < 52) {
  const p = { x: f1(R(30, W - 30)), y: f1(R(30, CAP_Y - 16)), r: f1(R(1.2, 2.1)) };
  if (dist(p, NEW) < NEW.r + 55) continue;
  strays.push(p);
}
const allSettled = settledNodes.flat();
const strayEdges = strays.map((st) => {
  let best = allSettled[0], bd = Infinity;
  for (const n of allSettled) {
    const d = (n.x - st.x) ** 2 + (n.y - st.y) ** 2;
    if (d < bd) { bd = d; best = n; }
  }
  return { a: st, b: best };
});

// ── the new cluster: nodes, waves, hubs, edges ──────────────────────────────
const gNodes = blob({ ...NEW, n: NEW.n }).map((n) => ({ ...n, hub: false }));
// four hub-designates: greedy farthest-point spread, away from the meta's spot
const hubIdx = [];
{
  const cands = gNodes.map((n, i) => ({ n, i })).filter(({ n }) => dist(n, NEW) > 38);
  let cur = cands[0];
  for (const c of cands) if (dist(c.n, NEW) > dist(cur.n, NEW)) cur = c;
  hubIdx.push(cur.i);
  while (hubIdx.length < 4) {
    let best = null, bd = -1;
    for (const c of cands) {
      if (hubIdx.includes(c.i)) continue;
      const d = Math.min(...hubIdx.map((h) => dist(c.n, gNodes[h])));
      if (d > bd) { bd = d; best = c; }
    }
    hubIdx.push(best.i);
  }
}
hubIdx.forEach((i) => { gNodes[i].hub = true; gNodes[i].r = f1(R(2.6, 3.2)); });

// waves: growing burst sizes, accelerating spacing = timelapse momentum
const waveSizes = [2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5]; // = 48
const waveStart = waveSizes.map((_, k) => f2(5 + 19 * (1 - Math.pow(1 - k / 11, 1.8))));
{
  // shuffle node order, then force the four hub-designates into waves 0..3
  for (let i = gNodes.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [gNodes[i], gNodes[j]] = [gNodes[j], gNodes[i]];
  }
  const hubs = gNodes.filter((n) => n.hub);
  const rest = gNodes.filter((n) => !n.hub);
  const order = [];
  let hi = 0, ri = 0;
  waveSizes.forEach((size, w) => {
    for (let s = 0; s < size; s++) {
      const n = w < 4 && s === 0 && hi < hubs.length ? hubs[hi++] : rest[ri++];
      n.wave = w;
      n.jit = f2(R(-0.12, 0.12));
      order.push(n);
    }
  });
  gNodes.length = 0;
  gNodes.push(...order);
}
const gHubs = gNodes.filter((n) => n.hub);

// new-cluster edges: each doc links to its nearest hub, some to an earlier peer
const gEdges = [];
gNodes.forEach((n) => {
  if (!n.hub) {
    let h = gHubs[0];
    for (const c of gHubs) if (dist(n, c) < dist(n, h)) h = c;
    gEdges.push({ a: n, b: h, w: Math.max(n.wave, h.wave) });
  }
  if (rnd() < 0.3) {
    const earlier = gNodes.filter((m) => m !== n && m.wave <= n.wave);
    if (earlier.length) {
      const m = earlier[Math.floor(rnd() * earlier.length)];
      gEdges.push({ a: n, b: m, w: Math.max(n.wave, m.wave) });
    }
  }
});

// rejected sources: gathered, then culled during structuring
const rejected = [];
for (let i = 0; i < 7; i++) {
  const a = R(0, Math.PI * 2), d = NEW.r * R(1.02, 1.22);
  rejected.push({
    x: f1(NEW.x + Math.cos(a) * d * 1.15),
    y: f1(clamp(NEW.y + Math.sin(a) * d, 30, CAP_Y - 16)),
    r: f1(R(1.8, 2.6)),
    cls: i % 2, // rj0 pops early, rj1 pops late
    jit: f2(R(-0.3, 0.3)),
  });
}

// ── synthesis targets: weld into A (cyan), C (blue), D (teal) ───────────────
const meta = { x: NEW.x, y: NEW.y, r: 7.5 };
const tA = settledHubs[0][0], tC = settledHubs[2][0], tD = settledHubs[3][0];
const tA2 = settledNodes[0][10], tC2 = settledNodes[2][12], tD2 = settledNodes[3][8];
// bulges chosen so the southbound arcs swing clear of the 00-Index payoff zone
const arcs = [
  { a: meta, b: tA, k: 0, bulge: 75 }, { a: gHubs[0], b: tA2, k: 1, bulge: -55 },
  { a: meta, b: tC, k: 2, bulge: 65 }, { a: gHubs[1], b: tC2, k: 3, bulge: -50 },
  { a: meta, b: tD, k: 4, bulge: -75 }, { a: gHubs[2], b: tD2, k: 5, bulge: -60 },
];
const reverse = [
  { a: tA, b: gNodes[6], bulge: -40 },
  { a: tD, b: gNodes[9], bulge: -50 },
];
const seams = [
  { x: f1((meta.x + tA.x) / 2 + 14), y: f1((meta.y + tA.y) / 2 - 18), to: gHubs[0], from: tA },
  { x: f1((meta.x + tC.x) / 2 - 6), y: f1((meta.y + tC.y) / 2 + 20), to: gHubs[1], from: tC },
];
const arcPath = (a, b, bulge) => {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * bulge, cy = my + (dx / len) * bulge;
  return `M ${a.x} ${a.y} Q ${f1(cx)} ${f1(cy)} ${b.x} ${b.y}`;
};

// ── SVG ─────────────────────────────────────────────────────────────────────
const DUR = 36;
let css = "";
const kf = (name, frames) => { css += `    @keyframes ${name} { ${frames} }\n`; };
const cls = (name, extra = "") => { css += `    .${name} { animation: ${name} ${DUR}s linear infinite; animation-fill-mode: backwards; ${extra}}\n`; };

// node pop per wave
waveStart.forEach((P, k) => {
  cls(`w${k}`, "transform-box: fill-box; transform-origin: center; ");
  kf(`w${k}`, `0%,${P}%{transform:scale(0);opacity:0} ${f2(P + 0.55)}%{transform:scale(1.3);opacity:1} ${f2(P + 1.0)}%{transform:scale(1)} 95%{transform:scale(1);opacity:1} 98.5%,100%{transform:scale(1);opacity:0}`);
  const Q = f2(P + 0.9);
  cls(`e${k}`);
  kf(`e${k}`, `0%,${Q}%{stroke-dashoffset:100;opacity:0} ${f2(Q + 0.25)}%{opacity:.5} ${f2(Q + 1.6)}%{stroke-dashoffset:0;opacity:.24} 95%{stroke-dashoffset:0;opacity:.2} 98.5%,100%{stroke-dashoffset:0;opacity:0}`);
});
// rejected sources: pop with the rush, culled when structure forms
kf(`rj0`, `0%,11%{transform:scale(0);opacity:0} 11.6%{transform:scale(1.25);opacity:.75} 12.1%{transform:scale(1)} 30%{transform:scale(1);opacity:.75} 33%,100%{transform:scale(1);opacity:0}`);
cls(`rj0`, "transform-box: fill-box; transform-origin: center; ");
kf(`rj1`, `0%,18%{transform:scale(0);opacity:0} 18.6%{transform:scale(1.25);opacity:.75} 19.1%{transform:scale(1)} 30%{transform:scale(1);opacity:.75} 33%,100%{transform:scale(1);opacity:0}`);
cls(`rj1`, "transform-box: fill-box; transform-origin: center; ");
// provisional links for sources under evaluation, culled with their nodes
kf(`rjl0`, `0%,11.2%{opacity:0} 12%{opacity:.3} 30%{opacity:.3} 33%,100%{opacity:0}`);
cls(`rjl0`);
kf(`rjl1`, `0%,18.2%{opacity:0} 19%{opacity:.3} 30%{opacity:.3} 33%,100%{opacity:0}`);
cls(`rjl1`);
// hub promotion: ring + enlarged dot, staggered
[27, 28.3, 29.6, 30.9].forEach((T, k) => {
  cls(`hb${k}`, "transform-box: fill-box; transform-origin: center; ");
  kf(`hb${k}`, `0%,${T}%{transform:scale(.3);opacity:0} ${f2(T + 0.9)}%{transform:scale(1.15);opacity:1} ${f2(T + 1.5)}%{transform:scale(1)} 95%{transform:scale(1);opacity:1} 98.5%,100%{opacity:0}`);
});
// meta-analysis star + one-shot halo + label + trunk lines
cls(`mt`, "transform-box: fill-box; transform-origin: center; ");
kf(`mt`, `0%,33.5%{transform:scale(0);opacity:0} 34.3%{transform:scale(1.35);opacity:1} 35%{transform:scale(1)} 95%{transform:scale(1);opacity:1} 98.5%,100%{opacity:0}`);
cls(`mh`, "transform-box: fill-box; transform-origin: center; ");
kf(`mh`, `0%,33.5%{transform:scale(.4);opacity:0} 34.5%{opacity:.7} 39%{transform:scale(2.8);opacity:0} 100%{transform:scale(2.8);opacity:0}`);
cls(`ml`);
kf(`ml`, `0%,36.5%{opacity:0} 38%{opacity:1} 95%{opacity:1} 97.5%,100%{opacity:0}`);
cls(`tk`);
kf(`tk`, `0%,34.5%{stroke-dashoffset:100;opacity:0} 35%{opacity:.6} 37.5%{stroke-dashoffset:0;opacity:.5} 95%{stroke-dashoffset:0;opacity:.45} 98.5%,100%{opacity:0}`);
// synthesis arcs out, endpoint flashes, reverse arcs, seam docs
arcs.forEach(({ k }) => {
  const S = f2(42 + k * 1.6);
  cls(`a${k}`);
  kf(`a${k}`, `0%,${S}%{stroke-dashoffset:100;opacity:0} ${f2(S + 0.3)}%{opacity:.85} ${f2(S + 3.2)}%{stroke-dashoffset:0;opacity:.8} 62%{stroke-dashoffset:0;opacity:.55} 95%{stroke-dashoffset:0;opacity:.4} 98.5%,100%{opacity:0}`);
  const F = f2(S + 3.0);
  cls(`af${k}`, "transform-box: fill-box; transform-origin: center; ");
  kf(`af${k}`, `0%,${F}%{transform:scale(.4);opacity:0} ${f2(F + 0.7)}%{opacity:.9} ${f2(F + 3.5)}%{transform:scale(2.2);opacity:0} 100%{transform:scale(2.2);opacity:0}`);
});
reverse.forEach((_, k) => {
  const S = f2(52.5 + k * 2);
  cls(`rv${k}`);
  kf(`rv${k}`, `0%,${S}%{stroke-dashoffset:100;opacity:0} ${f2(S + 0.3)}%{opacity:.8} ${f2(S + 2.6)}%{stroke-dashoffset:0;opacity:.7} 95%{stroke-dashoffset:0;opacity:.4} 98.5%,100%{opacity:0}`);
});
cls(`sl`);
kf(`sl`, `0%,55.5%{stroke-dashoffset:100;opacity:0} 56%{opacity:.75} 57.5%{stroke-dashoffset:0;opacity:.65} 95%{stroke-dashoffset:0;opacity:.55} 98.5%,100%{opacity:0}`);
cls(`sn`, "transform-box: fill-box; transform-origin: center; ");
kf(`sn`, `0%,57%{transform:scale(0);opacity:0} 57.8%{transform:scale(1.4);opacity:1} 58.4%{transform:scale(1)} 95%{transform:scale(1);opacity:1} 98.5%,100%{opacity:0}`);
// indexing: line to 00-Index, halo, router-row chip
cls(`il`);
kf(`il`, `0%,63%{stroke-dashoffset:100;opacity:0} 63.5%{opacity:.95} 66.5%{stroke-dashoffset:0;opacity:.9} 95%{stroke-dashoffset:0;opacity:.7} 98.5%,100%{opacity:0}`);
cls(`ih`, "transform-box: fill-box; transform-origin: center; ");
kf(`ih`, `0%,66%{transform:scale(.4);opacity:0} 66.8%{opacity:.85} 71%{transform:scale(2.5);opacity:0} 100%{transform:scale(2.5);opacity:0}`);
cls(`ic`);
kf(`ic`, `0%,68%{opacity:0} 69.5%{opacity:1} 95%{opacity:1} 97%,100%{opacity:0}`);
// command chip + act captions
cls(`cmd`);
kf(`cmd`, `0%,1.5%{opacity:0} 2.5%{opacity:1} 96%{opacity:1} 98%,100%{opacity:0}`);
[[`c1`, 5, 25.5], [`c2`, 27, 41], [`c3`, 42, 61], [`c4`, 63, 92]].forEach(([n, i, o]) => {
  cls(n);
  kf(n, `0%,${i}%{opacity:0} ${f2(i + 1.2)}%{opacity:1} ${f2(o - 1)}%{opacity:1} ${o}%,100%{opacity:0}`);
});
// ambient life on the settled vault (independent gentle loops)
css += `    .halo { transform-box: fill-box; transform-origin: center; animation: halo 7s infinite; }\n`;
kf(`halo`, `0%{transform:scale(.5);opacity:.7} 60%{transform:scale(2.5);opacity:0} 100%{transform:scale(2.5);opacity:0}`);
css += `    .idx { animation: idxb 6s ease-in-out infinite; }\n`;
kf(`idxb`, `0%,100%{opacity:.85} 50%{opacity:1}`);

let s = "";
s += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">\n`;
s += `  <title>One /research run in timelapse: findings land as a new wiki-linked cluster, hubs and a meta-analysis form, synthesis links weld it into neighboring knowledge bases, and one router row indexes it at 00-Index.</title>\n`;
// accessibility + performance: reduced-motion viewers get the finished KB
// as a static poster — the grown cluster, hubs, meta, synthesis links, and
// the index registration — with arc-heads, culled sources, decorative
// halos, and the overlapping cycling captions hidden.
css += `    @media (prefers-reduced-motion: reduce) { * { animation: none !important; }\n`;
css += `      [class^="af"], [class^="rj"], [class^="rv"], .ih, .halo, .c1, .c2, .c3, .c4 { opacity: 0 !important; } }\n`;
s += `  <style>\n${css}  </style>\n`;
s += `  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="#0d1117" stroke="#30363d"/>\n`;

// settled edges, weave, strays, nodes (dim: this knowledge is already earned)
s += `  <g stroke="#8b949e" stroke-width="0.5">\n`;
for (const e of sIntra) s += `    <line x1="${e.a.x}" y1="${e.a.y}" x2="${e.b.x}" y2="${e.b.y}" opacity="${e.o.toFixed(3)}"/>\n`;
s += `  </g>\n`;
s += `  <g stroke="#9aa5b1" stroke-width="0.6">\n`;
for (const e of sWeave) s += `    <line x1="${e.a.x}" y1="${e.a.y}" x2="${e.b.x}" y2="${e.b.y}" opacity="${e.o.toFixed(3)}"/>\n`;
s += `  </g>\n`;
s += `  <g stroke="#8b949e" stroke-width="0.5">\n`;
for (const e of strayEdges) s += `    <line x1="${e.a.x}" y1="${e.a.y}" x2="${e.b.x}" y2="${e.b.y}" opacity="0.12"/>\n`;
s += `  </g>\n`;
s += `  <g fill="#6e7681" opacity="0.75">\n`;
for (const p of strays) s += `    <circle cx="${p.x}" cy="${p.y}" r="${p.r}"/>\n`;
s += `  </g>\n`;
settledNodes.forEach((ns, ci) => {
  s += `  <g fill="${settled[ci].c}" opacity="0.78">\n`;
  for (const n of ns) s += `    <circle cx="${n.x}" cy="${n.y}" r="${n.r}"/>\n`;
  s += `  </g>\n`;
});
// ambient halos on two settled hubs
[[0, 0], [5, 3.6]].forEach(([ci, delay]) => {
  const h = settledHubs[ci][0];
  s += `  <circle class="halo" cx="${h.x}" cy="${h.y}" r="9" fill="none" stroke="${settled[ci].c}" stroke-width="1.4" style="animation-delay:${delay}s"/>\n`;
});

// ── the new cluster (everything below animates on the 36s story clock) ──────
// edges first (under nodes), then culled sources, then docs
s += `  <g stroke="${NEW.c}" stroke-width="0.6" fill="none">\n`;
for (const e of gEdges) s += `    <line class="e${e.w}" pathLength="100" x1="${e.a.x}" y1="${e.a.y}" x2="${e.b.x}" y2="${e.b.y}"/>\n`;
s += `  </g>\n`;
for (const p of rejected) {
  const early = gNodes.filter((n) => n.wave <= 2);
  let best = early[0], bd = Infinity;
  for (const n of early) {
    const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2;
    if (d < bd) { bd = d; best = n; }
  }
  s += `  <line class="rjl${p.cls}" x1="${p.x}" y1="${p.y}" x2="${best.x}" y2="${best.y}" stroke="#9aa5b1" stroke-width="0.5"/>\n`;
  s += `  <circle class="rj${p.cls}" cx="${p.x}" cy="${p.y}" r="${p.r}" fill="#9aa5b1" style="animation-delay:${p.jit}s"/>\n`;
}
s += `  <g fill="${NEW.c}">\n`;
for (const n of gNodes) s += `    <circle class="w${n.wave}" cx="${n.x}" cy="${n.y}" r="${n.r}" style="animation-delay:${n.jit}s"/>\n`;
s += `  </g>\n`;
// hub promotion rings + enlarged dots
gHubs.forEach((h, k) => {
  s += `  <g class="hb${k}">\n`;
  s += `    <circle cx="${h.x}" cy="${h.y}" r="5.2" fill="${NEW.c}"/>\n`;
  s += `    <circle cx="${h.x}" cy="${h.y}" r="8.6" fill="none" stroke="${NEW.c}" stroke-width="1.2" opacity="0.55"/>\n`;
  s += `  </g>\n`;
});
// trunk lines hub → meta, then the meta star itself
s += `  <g stroke="${NEW.c}" stroke-width="0.9" fill="none">\n`;
gHubs.forEach((h, k) => {
  s += `    <line class="tk" pathLength="100" x1="${meta.x}" y1="${meta.y}" x2="${h.x}" y2="${h.y}" style="animation-delay:${(k * 0.18).toFixed(2)}s"/>\n`;
});
s += `  </g>\n`;
s += `  <circle class="mh" cx="${meta.x}" cy="${meta.y}" r="11" fill="none" stroke="${NEW.c}" stroke-width="1.6"/>\n`;
s += `  <g class="mt">\n`;
s += `    <circle cx="${meta.x}" cy="${meta.y}" r="8.5" fill="${NEW.c}"/>\n`;
s += `    <circle cx="${meta.x}" cy="${meta.y}" r="12.5" fill="none" stroke="${NEW.c}" stroke-width="1" opacity="0.55"/>\n`;
s += `  </g>\n`;
s += `  <text class="ml" x="${meta.x}" y="${meta.y + 34}" text-anchor="middle" font-size="11" fill="#dbe2ea" stroke="#0d1117" stroke-width="3.5" paint-order="stroke">Postgres Replication - Meta-Analysis</text>\n`;

// synthesis arcs + endpoint flashes + reverse arcs + seam docs
s += `  <g stroke="${VIOLET}" stroke-width="1.1" fill="none">\n`;
arcs.forEach(({ a, b, k, bulge }) => {
  s += `    <path class="a${k}" pathLength="100" d="${arcPath(a, b, bulge)}"/>\n`;
});
reverse.forEach(({ a, b, bulge }, k) => {
  s += `    <path class="rv${k}" pathLength="100" d="${arcPath(a, b, bulge)}" stroke-width="0.9"/>\n`;
});
s += `  </g>\n`;
arcs.forEach(({ b, k }, i) => {
  const c = [settled[0].c, settled[0].c, settled[2].c, settled[2].c, settled[3].c, settled[3].c][i];
  s += `  <circle class="af${k}" cx="${b.x}" cy="${b.y}" r="7" fill="none" stroke="${c}" stroke-width="1.5"/>\n`;
});
seams.forEach((sm, k) => {
  s += `  <g stroke="${VIOLET}" stroke-width="1" fill="none">\n`;
  s += `    <line class="sl" pathLength="100" x1="${sm.x}" y1="${sm.y}" x2="${sm.to.x}" y2="${sm.to.y}" style="animation-delay:${(k * 0.4).toFixed(1)}s"/>\n`;
  s += `    <line class="sl" pathLength="100" x1="${sm.x}" y1="${sm.y}" x2="${sm.from.x}" y2="${sm.from.y}" style="animation-delay:${(k * 0.4 + 0.2).toFixed(1)}s"/>\n`;
  s += `  </g>\n`;
  s += `  <circle class="sn" cx="${sm.x}" cy="${sm.y}" r="4.2" fill="${VIOLET}" style="animation-delay:${(k * 0.5).toFixed(1)}s"/>\n`;
});

// indexing: the run ends routable
s += `  <line class="il" pathLength="100" x1="${meta.x}" y1="${meta.y}" x2="${INDEX.x}" y2="${INDEX.y}" stroke="${AMBER}" stroke-width="1.5"/>\n`;
s += `  <circle class="ih" cx="${INDEX.x}" cy="${INDEX.y}" r="9" fill="none" stroke="${AMBER}" stroke-width="1.6"/>\n`;
s += `  <circle class="idx" cx="${INDEX.x}" cy="${INDEX.y}" r="5.5" fill="#e6edf3"/>\n`;
s += `  <text x="${INDEX.x}" y="${INDEX.y + 22}" text-anchor="middle" font-size="11.5" fill="#dbe2ea" stroke="#0d1117" stroke-width="3.5" paint-order="stroke">00-Index</text>\n`;
s += `  <text class="ic" x="${INDEX.x}" y="${INDEX.y + 44}" text-anchor="middle" font-size="11" fill="${AMBER}" stroke="#0d1117" stroke-width="3.5" paint-order="stroke">Research Library +1 · MEMORY.md +1 row</text>\n`;

// the command that caused all of it
s += `  <g class="cmd">\n`;
s += `    <rect x="40" y="30" width="286" height="32" rx="8" fill="#161b22" stroke="#30363d"/>\n`;
s += `    <text x="54" y="51" font-size="12.5" fill="${AMBER}">&gt;<tspan fill="#e6edf3" dx="6">/research "postgres replication"</tspan></text>\n`;
s += `  </g>\n`;

// captions: cycling act line + static summary
s += `  <g font-size="13" text-anchor="middle">\n`;
s += `    <text class="c1" x="${W / 2}" y="764" fill="${NEW.c}">① gather: /research fans out, findings land as wiki-linked docs</text>\n`;
s += `    <text class="c2" x="${W / 2}" y="764" fill="${NEW.c}">② structure: hubs form, a meta-analysis becomes the front door</text>\n`;
s += `    <text class="c3" x="${W / 2}" y="764" fill="${VIOLET}">③ synthesis: the new KB welds into every cluster it touches</text>\n`;
s += `    <text class="c4" x="${W / 2}" y="764" fill="${AMBER}">④ index: one router row, and the next session routes straight in</text>\n`;
s += `  </g>\n`;
s += `  <text x="${W / 2}" y="786" text-anchor="middle" font-size="11" fill="#6e7681">new knowledge lands wired in, not filed away: linked, synthesized, and routable next session</text>\n`;
s += `</svg>\n`;

writeFileSync(new URL("./research.svg", import.meta.url).pathname, s);
console.log(`research.svg: ${settledNodes.flat().length + gNodes.length} nodes, ${sIntra.length + sWeave.length + gEdges.length} edges, ${arcs.length + reverse.length} synthesis arcs, ${(s.length / 1024).toFixed(0)} KB`);
