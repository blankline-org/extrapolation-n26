// Region grafting: replace a spatial region of the target structure with the
// donor's circles from the same region, then strong re-knit + LP polish.
// Single-circle relocation can't import a region's local contact pattern;
// grafting can. Donor = our symmetric basin (combo-best), target = record
// vertex (pack-polished), and vice versa.
//
//   node graft.mjs --seconds=1200 --seed=5 --out=graft-5.json

import { readFileSync, writeFileSync } from "node:fs";
import { lpRadii, centreGradient } from "./lp-radii.mjs";

const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`));
  return h ? h.slice(k.length + 3) : d;
};
const SECONDS = Number(arg("seconds", "1200"));
const OUT = arg("out", "graft.json");
const RECORD = 2.635983084918;
const N = 26;

let seed = Number(arg("seed", "5")) >>> 0;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function rand(a, b) { return a + (b - a) * rnd(); }

const recordC = JSON.parse(readFileSync("pack-polished.json", "utf8")).solution.map((c) => [c[0], c[1]]);
const symC = JSON.parse(readFileSync("combo-best.json", "utf8")).solution.map((c) => [c[0], c[1]]);
const recordV = lpRadii(recordC).value;

function evalGrad(X, Y, R, gx, gy, gr, lam, rmin) {
  gx.fill(0); gy.fill(0); gr.fill(0);
  for (let i = 0; i < N; i++) {
    const x = X[i], y = Y[i];
    gr[i] -= 1;
    let w = x, a = 0;
    if (1 - x < w) { w = 1 - x; a = 1; }
    if (y < w) { w = y; a = 2; }
    if (1 - y < w) { w = 1 - y; a = 3; }
    let v = R[i] - w;
    if (v > 0) {
      gr[i] += lam;
      if (a === 0) gx[i] -= lam; else if (a === 1) gx[i] += lam;
      else if (a === 2) gy[i] -= lam; else gy[i] += lam;
    }
    v = rmin - R[i];
    if (v > 0) gr[i] -= lam;
  }
  for (let i = 0; i < N; i++) {
    const xi = X[i], yi = Y[i], rI = R[i];
    for (let j = i + 1; j < N; j++) {
      const dx = xi - X[j], dy = yi - Y[j];
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1e-12) d = 1e-12;
      const v = rI + R[j] - d;
      if (v > 0) {
        const s = lam / d;
        gx[i] -= dx * s; gy[i] -= dy * s;
        gx[j] += dx * s; gy[j] += dy * s;
        gr[i] += lam; gr[j] += lam;
      }
    }
  }
}

function adam(X, Y, R, steps, lr0, lr1, lam, rmin) {
  const gx = new Float64Array(N), gy = new Float64Array(N), gr = new Float64Array(N);
  const mx = new Float64Array(N), vx = new Float64Array(N), my = new Float64Array(N), vy = new Float64Array(N);
  const mr = new Float64Array(N), vr = new Float64Array(N);
  const b1 = 0.9, b2 = 0.99, eps = 1e-8;
  let c1 = 1, c2 = 1;
  const ratio = Math.log(lr1 / lr0);
  for (let t = 1; t <= steps; t++) {
    const lr = lr0 * Math.exp(ratio * (t / steps));
    evalGrad(X, Y, R, gx, gy, gr, lam, rmin);
    c1 *= b1; c2 *= b2;
    const ic1 = 1 / (1 - c1), ic2 = 1 / (1 - c2);
    for (let i = 0; i < N; i++) {
      let g = gx[i];
      mx[i] = b1 * mx[i] + (1 - b1) * g; vx[i] = b2 * vx[i] + (1 - b2) * g * g;
      X[i] -= lr * (mx[i] * ic1) / (Math.sqrt(vx[i] * ic2) + eps);
      if (X[i] < 0) X[i] = 0; else if (X[i] > 1) X[i] = 1;
      g = gy[i];
      my[i] = b1 * my[i] + (1 - b1) * g; vy[i] = b2 * vy[i] + (1 - b2) * g * g;
      Y[i] -= lr * (my[i] * ic1) / (Math.sqrt(vy[i] * ic2) + eps);
      if (Y[i] < 0) Y[i] = 0; else if (Y[i] > 1) Y[i] = 1;
      g = gr[i];
      mr[i] = b1 * mr[i] + (1 - b1) * g; vr[i] = b2 * vr[i] + (1 - b2) * g * g;
      R[i] -= lr * (mr[i] * ic1) / (Math.sqrt(vr[i] * ic2) + eps);
      if (R[i] < 0.0005) R[i] = 0.0005; else if (R[i] > 0.5) R[i] = 0.5;
    }
  }
}

function repair(X, Y, R, gap) {
  for (let p = 0; p < 80; p++) {
    let changed = false;
    for (let i = 0; i < N; i++) {
      const w = Math.min(X[i], 1 - X[i], Y[i], 1 - Y[i]) - gap;
      if (R[i] > w) { R[i] = w > 1e-6 ? w : 1e-6; changed = true; }
    }
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const dx = X[i] - X[j], dy = Y[i] - Y[j];
      const d = Math.sqrt(dx * dx + dy * dy);
      const s = R[i] + R[j];
      if (s > d - gap) { let f = (d - gap) / s; if (f < 0) f = 0; R[i] *= f; R[j] *= f; changed = true; }
    }
    if (!changed) break;
  }
}

function grow(X, Y, R, gap, passes) {
  for (let p = 0; p < passes; p++) {
    let moved = false;
    for (let i = 0; i < N; i++) {
      let lim = Math.min(X[i], 1 - X[i], Y[i], 1 - Y[i]) - gap;
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        const dx = X[i] - X[j], dy = Y[i] - Y[j];
        const a = Math.sqrt(dx * dx + dy * dy) - R[j] - gap;
        if (a < lim) lim = a;
      }
      if (lim > R[i]) { R[i] = lim; moved = true; }
    }
    if (!moved) break;
  }
}

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

function reknit(centres, polishMs) {
  const X = new Float64Array(N), Y = new Float64Array(N), R = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    X[i] = Math.min(0.999, Math.max(0.001, centres[i][0]));
    Y[i] = Math.min(0.999, Math.max(0.001, centres[i][1]));
    R[i] = 0.03;
  }
  adam(X, Y, R, 2600, 3e-3, 1e-5, 8, 0.0005);
  repair(X, Y, R, 1e-9); grow(X, Y, R, 1e-9, 30); repair(X, Y, R, 1e-9);
  const out = [];
  for (let i = 0; i < N; i++) out.push([X[i], Y[i]]);
  return lpPolish(out, polishMs);
}

// graft: target gets donor's circles within radius rho of pivot p
function graft(target, donor) {
  const px = rand(0.25, 0.75), py = rand(0.25, 0.75);
  const rho = rand(0.15, 0.3);
  const inT = target.map(([x, y]) => Math.hypot(x - px, y - py) < rho);
  const inD = donor.map(([x, y]) => Math.hypot(x - px, y - py) < rho);
  const nT = inT.filter(Boolean).length, nD = inD.filter(Boolean).length;
  if (nT === 0 || nD === 0) return null;
  const out = [];
  const donorIn = donor.filter((_, i) => inD[i]);
  const targetOut = target.filter((_, i) => !inT[i]);
  // keep circle count at N: take as many donor circles as target had, then fill
  for (const c of targetOut) out.push([...c]);
  for (let k = 0; k < Math.min(nT, nD); k++) out.push([...donorIn[k]]);
  // if donor had fewer, fill from target's removed ones jittered into the region
  while (out.length < N) {
    out.push([px + rand(-rho, rho) * 0.5, py + rand(-rho, rho) * 0.5]);
  }
  return out.slice(0, N);
}

const t0 = Date.now();
const T = SECONDS * 1000;
console.log(`record vertex ${recordV.toFixed(12)}`);

let best = { centres: recordC.map((c) => [...c]), value: recordV };
let tries = 0;
while (Date.now() - t0 < T * 0.95) {
  tries++;
  // half the grafts record<-sym, half sym<-record (the latter explores other basins)
  const dir = rnd() < 0.6;
  const target = dir ? recordC : symC;
  const donor = dir ? symC : recordC;
  const g = graft(target, donor);
  if (!g) continue;
  const cand = reknit(g, 2600);
  if (cand.value > best.value + 1e-12) {
    best = { centres: cand.centres.map((c) => [...c]), value: cand.value };
    console.log(`graft ${tries} NEW BEST ${cand.value.toFixed(12)} (${((cand.value - RECORD) * 1e6 >= 0 ? "+" : "")}${((cand.value - RECORD) * 1e6).toFixed(3)} micro vs record) dir ${dir ? "rec<-sym" : "sym<-rec"}`);
  }
  if (tries % 10 === 0) {
    console.log(`  ${tries} grafts, best ${best.value.toFixed(12)}, ${Math.round((Date.now() - t0) / 1000)}s`);
  }
}

const { radii } = lpRadii(best.centres);
const solution = best.centres.map(([x, y], i) => [x, y, radii[i]]);
writeFileSync(OUT, JSON.stringify({ score: best.value, solution }, null, 1));
console.log(`\nfinal ${best.value.toFixed(12)}  (${((best.value - RECORD) * 1e6 >= 0 ? "+" : "")}${((best.value - RECORD) * 1e6).toFixed(3)} micro vs record)`);
console.log(`wrote ${OUT}`);
