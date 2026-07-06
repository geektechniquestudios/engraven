#!/usr/bin/env node
// Generator for assets/graph.svg: a synthetic Obsidian-style vault graph.
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
  { x: 520, y: 685, r: 58, n: 36, c: "#ff99c8" },
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

// the meta-analysis star: violet node raying across the whole graph
const star = { x: 795, y: 330, r: 7.5 };
const rayTargets = [];
for (let i = 0; i < 34; i++) {
  const n = nodes[Math.floor(rnd() * nodes.length)];
  if (n.cluster === -1) { i--; continue; }
  rayTargets.push(n);
}

// pulsing hubs (staggered halos)
const haloPicks = [0, 3, 7, 10, 13, 4].map((ci) => hubsOf[ci][0] || byCluster[ci][0]);

// lookup cascades: 00-Index → cluster meta → hub → doc, one every 6s, clockwise
const INDEX = { x: 598, y: 428 };
const lookupClusters = [0, 4, 13, 10]; // top-left, top-right, bottom-right, bottom-left
const lookups = lookupClusters.map((ci, k) => {
  const ns = byCluster[ci];
  const meta = hubsOf[ci][0] || ns[0];
  let doc = ns[0], best = -1;
  for (const n of ns) {
    if (n === meta) continue;
    const d = (n.x - meta.x) ** 2 + (n.y - meta.y) ** 2;
    if (d > best) { best = d; doc = n; }
  }
  const mx = (meta.x + doc.x) / 2, my = (meta.y + doc.y) / 2;
  let hub = null, bd = Infinity;
  for (const n of ns) {
    if (n === meta || n === doc) continue;
    const d = ((n.x - mx) ** 2 + (n.y - my) ** 2) * (n.hub ? 0.55 : 1); // prefer hub nodes near the midpoint
    if (d < bd) { bd = d; hub = n; }
  }
  return { k, meta, hub, doc };
});

let s = "";
s += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">\n`;
s += `  <title>A mature Engraven vault rendered as a graph: every dot a doc, every line a wiki-link, every color a knowledge base. Lookups pulse from the index node down into their subject clusters, and a meta-analysis hub rays out across all of them.</title>\n`;
s += `  <style>\n`;
s += `    .ray { stroke-dasharray:100; animation: ray 14s infinite; }\n`;
s += `    @keyframes ray { 0%{stroke-dashoffset:100;opacity:0} 8%{opacity:.55} 26%{stroke-dashoffset:0;opacity:.5} 58%{stroke-dashoffset:0;opacity:.4} 74%,100%{stroke-dashoffset:0;opacity:0} }\n`;
s += `    .halo { transform-box: fill-box; transform-origin: center; animation: halo 7s infinite; }\n`;
s += `    @keyframes halo { 0%{transform:scale(.5);opacity:.8} 60%{transform:scale(2.6);opacity:0} 100%{transform:scale(2.6);opacity:0} }\n`;
s += `    .star { animation: star 14s infinite; }\n`;
s += `    @keyframes star { 0%,100%{opacity:.75} 30%{opacity:1} 74%{opacity:.75} }\n`;
s += `    .idx { animation: idx 6s ease-in-out infinite; }\n`;
s += `    @keyframes idx { 0%,100%{opacity:.85} 50%{opacity:1} }\n`;
s += `    .lkI { transform-box: fill-box; transform-origin: center; animation: lkI 24s infinite; }\n`;
s += `    @keyframes lkI { 0%{transform:scale(.4);opacity:.9} 5%{transform:scale(2.4);opacity:0} 100%{transform:scale(2.4);opacity:0} }\n`;
s += `    .lkA { stroke-dasharray:100; animation: lkA 24s infinite; }\n`;
s += `    @keyframes lkA { 0%{stroke-dashoffset:100;opacity:0} 0.8%{opacity:.9} 4.5%{stroke-dashoffset:0;opacity:.9} 15%{stroke-dashoffset:0;opacity:.65} 20%,100%{stroke-dashoffset:0;opacity:0} }\n`;
s += `    .lkB { stroke-dasharray:100; animation: lkB 24s infinite; }\n`;
s += `    @keyframes lkB { 0%,4.5%{stroke-dashoffset:100;opacity:0} 5%{opacity:.9} 7.5%{stroke-dashoffset:0;opacity:.9} 15%{stroke-dashoffset:0;opacity:.65} 20%,100%{stroke-dashoffset:0;opacity:0} }\n`;
s += `    .lkC { stroke-dasharray:100; animation: lkC 24s infinite; }\n`;
s += `    @keyframes lkC { 0%,7.5%{stroke-dashoffset:100;opacity:0} 8%{opacity:.9} 10.5%{stroke-dashoffset:0;opacity:.9} 15%{stroke-dashoffset:0;opacity:.65} 20%,100%{stroke-dashoffset:0;opacity:0} }\n`;
s += `    .lkM { animation: lkM 24s infinite; }\n`;
s += `    @keyframes lkM { 0%,4%{opacity:0} 5.5%{opacity:1} 15%{opacity:.8} 20%,100%{opacity:0} }\n`;
s += `    .lkH { animation: lkH 24s infinite; }\n`;
s += `    @keyframes lkH { 0%,7%{opacity:0} 8.5%{opacity:1} 15%{opacity:.8} 20%,100%{opacity:0} }\n`;
s += `    .lkD { animation: lkD 24s infinite; }\n`;
s += `    @keyframes lkD { 0%,10%{opacity:0} 11.5%{opacity:1} 16%{opacity:1} 21%,100%{opacity:0} }\n`;
s += `    /* hide delayed cascades until their turn: apply the 0% frame during the delay */\n`;
s += `    .lkI, .lkA, .lkB, .lkC, .lkM, .lkH, .lkD { animation-fill-mode: backwards; }\n`;
s += `  </style>\n`;
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

s += `  <g stroke="#a78bfa" stroke-width="0.7" fill="none">\n`;
rayTargets.forEach((t, i) => {
  s += `    <line class="ray" pathLength="100" x1="${star.x}" y1="${star.y}" x2="${t.x}" y2="${t.y}" style="animation-delay:${(i * 0.11).toFixed(2)}s"/>\n`;
});
s += `  </g>\n`;

s += `  <g>\n`;
for (const n of nodes) s += `    <circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${n.c}"${n.hub ? "" : ` opacity="0.92"`}/>\n`;
s += `  </g>\n`;

haloPicks.forEach((h, i) => {
  s += `  <circle class="halo" cx="${h.x}" cy="${h.y}" r="9" fill="none" stroke="${clusters[[0,3,7,10,13,4][i]].c}" stroke-width="1.6" style="animation-delay:${(i * 1.15).toFixed(2)}s"/>\n`;
});

// lookup cascades painted above the dots so the trail reads as the active read
lookups.forEach(({ k, meta, hub, doc }) => {
  const d = `style="animation-delay:${k * 6}s"`;
  s += `  <g fill="none" stroke="#fbbf24">\n`;
  s += `    <circle class="lkI" cx="${INDEX.x}" cy="${INDEX.y}" r="8" stroke-width="1.5" ${d}/>\n`;
  s += `    <line class="lkA" pathLength="100" x1="${INDEX.x}" y1="${INDEX.y}" x2="${meta.x}" y2="${meta.y}" stroke-width="1.2" ${d}/>\n`;
  s += `    <line class="lkB" pathLength="100" x1="${meta.x}" y1="${meta.y}" x2="${hub.x}" y2="${hub.y}" stroke-width="1.2" ${d}/>\n`;
  s += `    <line class="lkC" pathLength="100" x1="${hub.x}" y1="${hub.y}" x2="${doc.x}" y2="${doc.y}" stroke-width="1.2" ${d}/>\n`;
  s += `    <circle class="lkM" cx="${meta.x}" cy="${meta.y}" r="${(+meta.r + 3.2).toFixed(1)}" stroke-width="1.4" opacity="0" ${d}/>\n`;
  s += `    <circle class="lkH" cx="${hub.x}" cy="${hub.y}" r="${(+hub.r + 2.8).toFixed(1)}" stroke-width="1.4" opacity="0" ${d}/>\n`;
  s += `    <circle class="lkD" cx="${doc.x}" cy="${doc.y}" r="${(+doc.r + 3).toFixed(1)}" stroke-width="1.6" opacity="0" ${d}/>\n`;
  s += `  </g>\n`;
  s += `  <circle class="lkD" cx="${doc.x}" cy="${doc.y}" r="${Math.max(+doc.r, 2.2).toFixed(1)}" fill="#fbbf24" opacity="0" ${d}/>\n`;
});

// the index node: where every lookup starts
s += `  <circle class="idx" cx="${INDEX.x}" cy="${INDEX.y}" r="5.5" fill="#e6edf3"/>\n`;
s += `  <text x="${INDEX.x}" y="${INDEX.y + 22}" text-anchor="middle" font-size="11.5" fill="#dbe2ea" stroke="#0d1117" stroke-width="3.5" paint-order="stroke">00-Index</text>\n`;

s += `  <circle class="star" cx="${star.x}" cy="${star.y}" r="${star.r}" fill="#a78bfa"/>\n`;
s += `  <text x="${star.x}" y="${star.y + 24}" text-anchor="middle" font-size="11.5" fill="#dbe2ea" stroke="#0d1117" stroke-width="3.5" paint-order="stroke">Architecture - Meta-Analysis</text>\n`;

s += `  <text x="${W / 2}" y="766" text-anchor="middle" font-size="13" fill="#8b949e">every dot a doc · every line a [[wiki-link]] · every color a KB</text>\n`;
s += `  <text x="${W / 2}" y="786" text-anchor="middle" font-size="11" fill="#6e7681">clusters emerge from links, not folders. open your vault in Obsidian and this is your agent's brain</text>\n`;
s += `</svg>\n`;

writeFileSync(new URL("./graph.svg", import.meta.url).pathname, s);
console.log(`graph.svg: ${nodes.length} nodes, ${intra.length + weave.length + highways.length} edges, ${rayTargets.length} rays, ${lookups.length} lookups, ${(s.length / 1024).toFixed(0)} KB`);
