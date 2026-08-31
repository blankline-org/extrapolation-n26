// Near-contact snap search — autopsy-guided contact-graph flips.
//
// The incumbent sits on an LP vertex: 42 pair contacts bind, and 14 more pairs
// are within 6.1e-5 of touching. The record's graph differs somewhere in those
// 14. For each near-contact (i,j): pull i and j together until they slightly
// overlap, forcing (i,j) into the active set, then run exact LP-gradient
// ascent (duals = exact centre gradient) to climb to the nearest vertex of the
// NEW active set. If that vertex beats the incumbent, the flip was real.
//
// Also tests: mirror-pair snaps (both a contact and its reflection), and the
// full symmetrisation combo.
//
//   node snap.mjs --polish=4000

import { readFileSync, writeFileSync } from "node:fs";
import { lpRadii, centreGradient } from "./lp-radii.mjs";

const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`));
  return h ? h.slice(k.length + 3) : d;
};
const POLISH = Number(arg("polish", "4000"));
const RECORD = 2.635983084918;
const N = 26;

const inc = JSON.parse(readFileSync("incumbent.json", "utf8"));
const C0 = inc.solution.map((c) => [c[0], c[1]]);
const base = lpRadii(C0);
console.log(`incumbent ${base.value.toFixed(12)}   record ${RECORD}   gap ${((RECORD - base.value) * 1e6).toFixed(2)} micro\n`);

// Mirror map under y -> 1-y (nearest neighbour after reflection).
const MIRROR = C0.map(([x, y]) => {
  let best = -1, bd = 1e9;
  C0.forEach(([a, b], k) => {
    const d = (a - x) ** 2 + (1 - b - y) ** 2;
    if (d < bd) { bd = d; best = k; }
  });
  return best;
});

function lpPolish(centres, budgetMs) {
  let cur = centres.map((c) => [...c]);
  let out = lpRadii(cur);
  let val = out.value, duals = out.duals;
  let step = 8e-4;
  const t0 = Date.now();
  while (Date.now() - t0 < budgetMs && step > 1e-11) {
    const g = centreGradient(cur, duals);
    const trial = cur.map((c, i) => [
      Math.min(0.999999, Math.max(1e-6, c[0] + step * g[i][0])),
      Math.min(0.999999, Math.max(1e-6, c[1] + step * g[i][1])),
    ]);
    const o2 = lpRadii(trial);
    if (o2.value > val + 1e-13) {
      cur = trial; val = o2.value; duals = o2.duals; step *= 1.25;
    } else step *= 0.5;
  }
  return { centres: cur, value: val };
}

// Pull pairs in `pairs` together until they slightly overlap.
function snap(centres, radii, pairs) {
  const out = centres.map((c) => [...c]);
  for (const [i, j] of pairs) {
    const dx = out[j][0] - out[i][0], dy = out[j][1] - out[i][1];
    const d = Math.hypot(dx, dy);
    const target = (radii[i] + radii[j]) * (1 - 1e-6);
    const move = (d - target) / 2;
    if (move <= 0) continue;
    const ux = dx / d, uy = dy / d;
    out[i][0] += ux * move; out[i][1] += uy * move;
    out[j][0] -= ux * move; out[j][1] -= uy * move;
  }
  return out;
}

// Near-contacts from the incumbent LP.
const nears = [];
{
  const R = base.radii;
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const d = Math.hypot(C0[i][0] - C0[j][0], C0[i][1] - C0[j][1]);
    const gap = d - R[i] - R[j];
    if (gap > 1e-9 && gap < 1e-4) nears.push([i, j, gap]);
  }
}
nears.sort((a, b) => a[2] - b[2]);
console.log(`near-contacts: ${nears.map(([i, j, g]) => `${i}-${j}(${(g * 1e6).toFixed(1)}u)`).join(" ")}\n`);

const results = [];
let bestEver = { centres: null, value: base.value, tag: "incumbent" };

function trial(tag, centres) {
  const p = lpPolish(centres, POLISH);
  const d = (p.value - base.value) * 1e6;
  results.push({ tag, value: p.value, delta: d });
  const mark = p.value > base.value + 1e-12 ? "  <<< BEATS INCUMBENT" : "";
  console.log(`${tag.padEnd(28)} ${p.value.toFixed(12)}  ${d >= 0 ? "+" : ""}${d.toFixed(3)} micro${mark}`);
  if (p.value > bestEver.value + 1e-12) bestEver = { centres: p.centres, value: p.value, tag };
}

// 1) single snaps
for (const [i, j] of nears) {
  trial(`snap ${i}-${j}`, snap(C0, base.radii, [[i, j]]));
}

// 2) mirror-pair snaps (snap a near-contact and its mirror image together)
for (const [i, j] of nears) {
  const mi = MIRROR[i], mj = MIRROR[j];
  const lo = Math.min(mi, mj), hi = Math.max(mi, mj);
  if (lo === i && hi === j) continue; // self-mirror pair
  trial(`snap ${i}-${j} + ${lo}-${hi}`, snap(C0, base.radii, [[i, j], [lo, hi]]));
}

// 3) the four asymmetric near-contacts at once (symmetrising the graph)
const asym = [[0, 13], [3, 12], [7, 8], [18, 19]];
trial("snap all-four-asymmetric", snap(C0, base.radii, asym));

// 4) everything small at once
trial("snap all < 30u", snap(C0, base.radii, nears.filter(([, , g]) => g < 30e-6).map(([i, j]) => [i, j])));

console.log("\n=== sorted ===");
results.sort((a, b) => b.value - a.value);
for (const r of results.slice(0, 8)) {
  console.log(`${r.tag.padEnd(28)} ${r.value.toFixed(12)}  ${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(3)} micro`);
}

if (bestEver.centres) {
  const { radii } = lpRadii(bestEver.centres);
  const solution = bestEver.centres.map(([x, y], i) => [x, y, radii[i]]);
  writeFileSync("snap-best.json", JSON.stringify({ score: bestEver.value, tag: bestEver.tag, solution }, null, 1));
  console.log(`\nwrote snap-best.json (${bestEver.tag}) — verify with: node verify-theirs.mjs snap-best.json`);
} else {
  console.log("\nno flip beat the incumbent");
}
