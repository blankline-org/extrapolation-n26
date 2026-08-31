// Combinatorial near-contact snap search.
//
// Round 1 finding: single-contact snaps yield <= +0.03 micro, but snapping a
// SET of near-contacts at once yielded +1.1 micro — the value is in collective
// active-set changes. So: enumerate snap PAIRS and sampled TRIPLES of
// near-contacts, screen all of them with a bare LP (33ms each), short-polish
// the top screeners, long-polish the best, and chain rounds from each new
// champion until convergence or time-out.
//
//   node snap-combo.mjs --seconds=540 --start=snap-best.json --out=combo-best.json

import { readFileSync, writeFileSync } from "node:fs";
import { lpRadii, centreGradient } from "./lp-radii.mjs";

const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`));
  return h ? h.slice(k.length + 3) : d;
};
const SECONDS = Number(arg("seconds", "540"));
const START = arg("start", "snap-best.json");
const OUT = arg("out", "combo-best.json");
const RECORD = 2.635983084918;
const N = 26;

let seed = 1357911;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function ri(k) { return (rnd() * k) | 0; }

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

function nearContacts(centres, radii, window) {
  const list = [];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const d = Math.hypot(centres[i][0] - centres[j][0], centres[i][1] - centres[j][1]);
    const gap = d - radii[i] - radii[j];
    if (gap > 1e-9 && gap < window) list.push([i, j, gap]);
  }
  list.sort((a, b) => a[2] - b[2]);
  return list;
}

const t0 = Date.now();
const T = SECONDS * 1000;

let champ = JSON.parse(readFileSync(START, "utf8"));
let champC = champ.solution.map((c) => [c[0], c[1]]);
let champV = lpRadii(champC).value;
console.log(`start ${champV.toFixed(12)}  (${((champV - RECORD) * 1e6).toFixed(2)} micro vs record)`);

let globalBest = { centres: champC.map((c) => [...c]), value: champV, tag: "start" };
const seenSets = new Set();
let round = 0;

while (Date.now() - t0 < T * 0.92) {
  round++;
  const { radii } = lpRadii(champC);
  const nears = nearContacts(champC, radii, 90e-6);
  const pool = nears.slice(0, 18).map(([i, j]) => [i, j]);

  // candidate snap-sets: all pairs of pool + sampled triples of top 12
  const candSets = [];
  for (let a = 0; a < pool.length; a++) {
    for (let b = a + 1; b < pool.length; b++) {
      const key = [...pool[a], ...pool[b]].sort((x, y) => x - y).join(",");
      if (seenSets.has(key)) continue;
      seenSets.add(key);
      candSets.push([pool[a], pool[b]]);
    }
  }
  const top12 = pool.slice(0, 12);
  for (let t = 0; t < 240; t++) {
    const a = ri(top12.length); let b = ri(top12.length), c = ri(top12.length);
    if (a === b || a === c || b === c) continue;
    const key = [...top12[a], ...top12[b], ...top12[c]].sort((x, y) => x - y).join(",");
    if (seenSets.has(key)) continue;
    seenSets.add(key);
    candSets.push([top12[a], top12[b], top12[c]]);
  }

  // screen with bare LP
  const screened = [];
  for (const sets of candSets) {
    const c2 = snap(champC, radii, sets);
    const v = lpRadii(c2).value;
    screened.push({ sets, centres: c2, v });
  }
  screened.sort((a, b) => b.v - a.v);

  // short-polish top screeners
  const shortlist = [];
  for (const s of screened.slice(0, 36)) {
    const p = lpPolish(s.centres, 700);
    shortlist.push({ sets: s.sets, ...p });
  }
  shortlist.sort((a, b) => b.value - a.value);

  // long-polish the best few
  let roundBest = null;
  for (const s of shortlist.slice(0, 6)) {
    const p = lpPolish(s.centres, 4000);
    if (!roundBest || p.value > roundBest.value) roundBest = { sets: s.sets, ...p };
  }

  const d = roundBest ? (roundBest.value - champV) * 1e6 : -Infinity;
  console.log(`round ${round}: ${candSets.length} sets screened, best ${roundBest ? roundBest.value.toFixed(12) : "-"} (${d >= 0 ? "+" : ""}${d.toFixed(3)} micro)  ${Math.round((Date.now() - t0) / 1000)}s`);

  if (roundBest && roundBest.value > champV + 1e-12) {
    champC = roundBest.centres.map((c) => [...c]);
    champV = roundBest.value;
    const tag = roundBest.sets.map(([i, j]) => `${i}-${j}`).join("+");
    console.log(`  NEW CHAMPION ${champV.toFixed(12)} via ${tag}  (${((champV - RECORD) * 1e6).toFixed(2)} micro vs record)`);
    if (champV > globalBest.value) {
      globalBest = { centres: champC.map((c) => [...c]), value: champV, tag };
    }
  } else {
    console.log("  converged — no snap-set beats the champion");
    break;
  }
}

const { radii } = lpRadii(globalBest.centres);
const solution = globalBest.centres.map(([x, y], i) => [x, y, radii[i]]);
writeFileSync(OUT, JSON.stringify({ score: globalBest.value, tag: globalBest.tag, solution }, null, 1));
console.log(`\nfinal ${globalBest.value.toFixed(12)}  (${((globalBest.value - RECORD) * 1e6).toFixed(2)} micro vs record)`);
console.log(`wrote ${OUT} — verify with: node verify-theirs.mjs ${OUT}`);
