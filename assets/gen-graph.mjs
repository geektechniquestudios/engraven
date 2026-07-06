#!/usr/bin/env node
// Generator for assets/graph.svg: a synthetic Obsidian-style vault graph.
// The still image is a mature vault; the animation layer is a day in its
// life: four lookups land four different ways (3-hop drill-down, 1-hop deep
// link, cross-KB wiki-link, episodic archive read) with node names appearing
// at each hop, then a new KB forms while stale docs elsewhere are repaired.
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
const far = (ns, from, skip = []) => {
  let best = null, bd = -1;
  for (const n of ns) {
    if (n === from || skip.includes(n)) continue;
    const d = (n.x - from.x) ** 2 + (n.y - from.y) ** 2;
    if (d > bd) { bd = d; best = n; }
  }
  return best;
};
const nearMid = (ns, a, b, skip = []) => {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  let best = null, bd = Infinity;
  for (const n of ns) {
    if (n === a || n === b || skip.includes(n)) continue;
    const d = ((n.x - mx) ** 2 + (n.y - my) ** 2) * (n.hub ? 0.55 : 1);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
};

// L1 · drill-down, 3 hops (the dev-east read)
const l1meta = hubsOf[0][0] || byCluster[0][0];
const l1doc = far(byCluster[0], l1meta);
const l1hub = nearMid(byCluster[0], l1meta, l1doc);
// L2 · deep link, 1 hop
const l2doc = hubsOf[9][0] || byCluster[9][0];
// L3 · cross-KB: hop to one doc, wiki-link arc to its neighbor KB
const l3a = hubsOf[6][0] || byCluster[6][0];
const l3b = hubsOf[7][0] || byCluster[7][0];
// L4 · episodic: two hops into the session archive
const l4sai = hubsOf[15][0] || byCluster[15][0];
const l4doc = far(byCluster[15], l4sai);
// stale repairs while the vault grows
const repairs = [byCluster[2][7], byCluster[8][11], byCluster[12][9]];

// new KB forming (all PRNG below runs after the existing layout draws)
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

const arcPath = (a, b, bulge) => {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  return `M ${a.x} ${a.y} Q ${(mx + (-dy / len) * bulge).toFixed(1)} ${(my + (dx / len) * bulge).toFixed(1)} ${b.x} ${b.y}`;
};

// ── SVG ─────────────────────────────────────────────────────────────────────
const DUR = 32;
let css = "";
const kf = (name, frames) => { css += `    @keyframes ${name} { ${frames} }\n`; };
const cls = (name, extra = "") => { css += `    .${name} { animation: ${name} ${DUR}s linear infinite; animation-fill-mode: backwards; ${extra}}\n`; };
const f2 = (v) => +v.toFixed(2);

// a routed read: line draws S→E, holds, fades by F
const lineKF = (name, S, E, F) => {
  cls(name);
  kf(name, `0%,${S}%{stroke-dashoffset:100;opacity:0} ${f2(S + 0.3)}%{opacity:.95} ${E}%{stroke-dashoffset:0;opacity:.9} ${f2(F - 2)}%{stroke-dashoffset:0;opacity:.7} ${F}%,100%{stroke-dashoffset:0;opacity:0}`);
};
// a node name label: in at S, out by F
const textKF = (name, S, F) => {
  cls(name);
  kf(name, `0%,${S}%{opacity:0} ${f2(S + 0.8)}%{opacity:1} ${f2(F - 1.2)}%{opacity:1} ${F}%,100%{opacity:0}`);
};
// a violet potentiation pulse: some of the landed node's own links glow
// exactly as its name shows (never all of them, and never the index's)
const burstKF = (name, S) => {
  cls(name);
  kf(name, `0%,${S}%{opacity:0} ${f2(S + 0.5)}%{opacity:.85} ${f2(S + 1.8)}%{opacity:.7} ${f2(S + 3.2)}%{opacity:0} 100%{opacity:0}`);
};
const flashKF = burstKF;
// the index pings when a lookup starts
const pingKF = (name, S) => {
  cls(name, "transform-box: fill-box; transform-origin: center; ");
  kf(name, `0%,${S}%{transform:scale(.4);opacity:.9} ${f2(S + 3.5)}%{transform:scale(2.4);opacity:0} 100%{transform:scale(2.4);opacity:0}`);
};

// L1 drill-down: index → meta → hub → doc (1.5%..23%)
pingKF("i1", 1);
lineKF("l1a", 1.5, 4.5, 23); flashKF("f1a", 4.2); textKF("t1a", 4.5, 22);
lineKF("l1b", 5, 8, 23); flashKF("f1b", 7.7); textKF("t1b", 8, 22);
lineKF("l1c", 8.5, 11.5, 23); flashKF("f1c", 11.2); textKF("t1c", 11.5, 22);
// L2 deep link: one hop, done (26%..38%)
pingKF("i2", 25.5);
lineKF("l2", 26, 29.5, 38); flashKF("f2", 29.2); textKF("t2", 29.5, 37);
// L3 cross-KB: hop, then the wiki-link bridge (41%..57%)
pingKF("i3", 40.5);
lineKF("l3a", 41, 44, 57); flashKF("f3a", 43.7); textKF("t3a", 44, 55);
lineKF("l3x", 44.5, 47.5, 57); flashKF("f3b", 47.2); textKF("t3b", 47.5, 55);
// L4 episodic: two hops into the archive (60%..76%)
pingKF("i4", 59.5);
lineKF("l4a", 60, 63, 76); flashKF("f4a", 62.7); textKF("t4a", 63, 74);
lineKF("l4b", 63.5, 66.5, 76); flashKF("f4b", 66.2); textKF("t4b", 66.5, 74);
// a new KB forms... (78%..98%)
[78, 80.5, 83, 85.5].forEach((S, k) => {
  cls(`nw${k}`, "transform-box: fill-box; transform-origin: center; ");
  kf(`nw${k}`, `0%,${S}%{transform:scale(0);opacity:0} ${f2(S + 0.6)}%{transform:scale(1.3);opacity:1} ${f2(S + 1.1)}%{transform:scale(1)} 96%{transform:scale(1);opacity:1} 98.5%,100%{transform:scale(1);opacity:0}`);
  cls(`ne${k}`);
  kf(`ne${k}`, `0%,${f2(S + 0.8)}%{stroke-dashoffset:100;opacity:0} ${f2(S + 1)}%{opacity:.5} ${f2(S + 2.2)}%{stroke-dashoffset:0;opacity:.3} 96%{stroke-dashoffset:0;opacity:.25} 98.5%,100%{opacity:0}`);
});
cls("nkm", "transform-box: fill-box; transform-origin: center; ");
kf("nkm", `0%,88%{transform:scale(0);opacity:0} 88.8%{transform:scale(1.35);opacity:1} 89.5%{transform:scale(1)} 96%{transform:scale(1);opacity:1} 98.5%,100%{opacity:0}`);
flashKF("nkh", 88);
textKF("nkl", 89, 96);
// ...while stale docs get repaired: red pulse → green pulse → healthy
[78, 82, 86].forEach((S, k) => {
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
s += `  <title>A mature Engraven vault as a graph: every dot a doc, every line a wiki-link, every color a knowledge base. Four lookups land four different ways (a three-hop drill-down to the dev-east runbook, a one-hop deep link, a cross-KB wiki-link read, and an episodic archive read), each hop naming the doc it lands on. Then a new KB forms while stale docs elsewhere are repaired.</title>\n`;
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
const trace = (cl2, a, b, w = 1.2) =>
  `    <line class="${cl2}" pathLength="100" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke-width="${w}"/>\n`;
const allEdges = [...intra, ...weave, ...highways, ...stragglerEdges];
const flash = (cl2, n, _color = "#a78bfa", k = 0) => {
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

// the four lookups (amber = routed read, violet = wiki-link bridge)
s += `  <g fill="none" stroke="#fbbf24">\n`;
s += `    <circle class="i1" cx="${INDEX.x}" cy="${INDEX.y}" r="8" stroke-width="1.5"/>\n`;
s += trace("l1a", INDEX, l1meta);
s += trace("l1b", l1meta, l1hub);
s += trace("l1c", l1hub, l1doc);
s += `    <circle class="i2" cx="${INDEX.x}" cy="${INDEX.y}" r="8" stroke-width="1.5"/>\n`;
s += trace("l2", INDEX, l2doc);
s += `    <circle class="i3" cx="${INDEX.x}" cy="${INDEX.y}" r="8" stroke-width="1.5"/>\n`;
s += trace("l3a", INDEX, l3a);
s += `    <circle class="i4" cx="${INDEX.x}" cy="${INDEX.y}" r="8" stroke-width="1.5"/>\n`;
s += trace("l4a", INDEX, l4sai);
s += trace("l4b", l4sai, l4doc);
s += `  </g>\n`;
s += `  <path class="l3x" pathLength="100" d="${arcPath(l3a, l3b, -36)}" fill="none" stroke="#a78bfa" stroke-width="1.2"/>\n`;

s += flash("f1a", l1meta, "#a78bfa", 0) + flash("f1b", l1hub, "#a78bfa", 1) + flash("f1c", l1doc, "#a78bfa", 2);
s += flash("f2", l2doc, "#a78bfa", 3);
s += flash("f3a", l3a, "#a78bfa", 4) + flash("f3b", l3b, "#a78bfa", 5);
s += flash("f4a", l4sai, "#a78bfa", 6) + flash("f4b", l4doc, "#a78bfa", 7);

s += label("t1a", l1meta, "Infrastructure - Meta-Analysis");
s += label("t1b", l1hub, "AWS Environments - Section Hub");
s += label("t1c", l1doc, "dev-east Access Runbook");
s += label("t2", l2doc, "Deploy Freeze Checklist");
s += label("t3a", l3a, "Caching Strategy");
s += label("t3b", l3b, "Rate Limiting");
s += label("t4a", l4sai, "Session Archive Index");
s += label("t4b", l4doc, "2026-05-12 Incident Review", 20, "left");

// a new KB grows in while three stale docs get repaired
s += `  <g stroke="${NK.c}" stroke-width="0.6" fill="none">\n`;
for (const e of nkEdges) s += `    <line class="ne${e.w}" pathLength="100" x1="${e.a.x}" y1="${e.a.y}" x2="${e.b.x}" y2="${e.b.y}"/>\n`;
s += `  </g>\n`;
s += `  <g fill="${NK.c}">\n`;
for (const n of nkNodes) s += `    <circle class="nw${n.wave}" cx="${n.x}" cy="${n.y}" r="${n.r}" style="animation-delay:${n.jit}s"/>\n`;
s += `  </g>\n`;
s += `  <circle class="nkh" cx="${NK.x}" cy="${NK.y}" r="10" fill="none" stroke="${NK.c}" stroke-width="1.6"/>\n`;
s += `  <circle class="nkm" cx="${NK.x}" cy="${NK.y}" r="5.5" fill="${NK.c}"/>\n`;
s += label("nkl", { x: NK.x, y: NK.y, r: 5.5 }, "Queue Backpressure - Meta-Analysis", 24);
repairs.forEach((n, k) => {
  s += `  <circle class="rp${k}" cx="${n.x}" cy="${n.y}" r="${(Math.max(+n.r, 3) + 6).toFixed(1)}" fill="none" stroke="#f85149" stroke-width="1.8"/>\n`;
});

// the index node: where every lookup starts
s += `  <circle class="idx" cx="${INDEX.x}" cy="${INDEX.y}" r="5.5" fill="#e6edf3"/>\n`;
s += `  <text x="${INDEX.x}" y="${INDEX.y + 22}" text-anchor="middle" font-size="11.5" fill="#dbe2ea" stroke="#0d1117" stroke-width="3.5" paint-order="stroke">00-Index</text>\n`;

s += `  <text x="${W / 2}" y="766" text-anchor="middle" font-size="13" fill="#8b949e">every dot a doc · every line a [[wiki-link]] · every color a KB</text>\n`;
s += `  <text x="${W / 2}" y="786" text-anchor="middle" font-size="11" fill="#6e7681">clusters emerge from links, not folders. open your vault in Obsidian and this is your agent's brain</text>\n`;
s += `</svg>\n`;

writeFileSync(new URL("./graph.svg", import.meta.url).pathname, s);
console.log(`graph.svg: ${nodes.length + nkNodes.length} nodes, ${intra.length + weave.length + highways.length + nkEdges.length} edges, 4 lookups, 3 repairs, ${(s.length / 1024).toFixed(0)} KB`);
