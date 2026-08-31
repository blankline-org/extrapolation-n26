// Basin hopping from a seed vertex with STRONG re-knit (the earlier walker's
// re-knit was too weak to evaluate moves; this one fully relaxes + LP-polishes
// every candidate). Multi-circle relocation into holes, cluster rotation,
// role swap. Metropolis acceptance. No symmetry assumptions — the record
// structure is asymmetric.
//
//   node hop.mjs --seconds=1500 --seed=21 --start=pack-polished.json --out=hop-21.json

import { readFileSync, writeFileSync } from "node:fs";
import { lpRadii, centreGradient } from "./lp-radii.mjs";

const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`));
  return h ? h.slice(k.length + 3) : d;
};
const SECONDS = Number(arg("seconds", "1500"));
const OUT = arg("out", "hop.json");
const START = arg("start", "pack-polished.json");
const RECORD = 2.635983084918;
const N = 26;

let seed = Number(arg("seed", "21")) >>> 0;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function rand(a, b) { return a + (b - a) * rnd(); }
function ri(k) { return (rnd() * k) | 0; }

const seed0 = JSON.parse(readFileSync(START, "utf8"));
const seedC = seed0.solution.map((c) => [c[0], c[1]]);
const seedV = lpRadii(seedC).value;

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

// relocate k circles into max-clearance holes
function mvRelocate(centres, radii) {
  const k = 1 + ri(4);
  const pts = centres.map((c) => [...c]);
  const rs = [...radii];
  const moved = new Set();
  const order = rs.map((r, i) => [r, i]).sort((a, b) => a[0] - b[0]);
  for (let t = 0; t < k; t++) {
    const pick = order[Math.floor(Math.pow(rnd(), 1.4) * 16)][1];
    if (moved.has(pick)) { t--; continue; }
    let bp = null, bc = -1;
    for (let s = 0; s < 250; s++) {
      const x = rand(0.02, 0.98), y = rand(0.02, 0.98);
      let c = Math.min(x, y, 1 - x, 1 - y);
      for (let j = 0; j < N; j++) {
        if (j === pick || moved.has(j)) continue;
        const d = Math.hypot(x - pts[j][0], y - pts[j][1]) - rs[j];
        if (d < c) c = d;
      }
      if (c > bc) { bc = c; bp = [x, y]; }
    }
    pts[pick] = bp;
    rs[pick] = Math.max(0.01, bc * 0.85);
    moved.add(pick);
  }
  return pts;
}

// rotate a spatial cluster around a pivot circle
function mvRotate(centres) {
  const p = centres[ri(N)];
  const th = rand(0.8, 2.4) * (rnd() < 0.5 ? 1 : -1);
  const ct = Math.cos(th), st = Math.sin(th);
  const rad = rand(0.12, 0.32);
  return centres.map(([x, y]) => {
    const dx = x - p[0], dy = y - p[1];
    if (Math.sqrt(dx * dx + dy * dy) > rad || (x === p[0] && y === p[1])) return [x, y];
    const nx = p[0] + ct * dx - st * dy, ny = p[1] + st * dx + ct * dy;
    return [Math.min(0.98, Math.max(0.02, nx)), Math.min(0.98, Math.max(0.02, ny))];
  });
}

// exchange positions of a small and a large circle (role swap; LP re-decides radii)
function mvRoleSwap(centres, radii) {
  const order = radii.map((r, i) => [r, i]).sort((a, b) => a[0] - b[0]);
  const small = order[ri(6)][1];
  const big = order[N - 1 - ri(6)][1];
  const pts = centres.map((c) => [...c]);
  const t = pts[small]; pts[small] = pts[big]; pts[big] = t;
  return pts;
}

const t0 = Date.now();
const T = SECONDS * 1000;
console.log(`seed ${seedV.toFixed(12)}  gap to record ${((RECORD - seedV) * 1e6).toFixed(3)} micro`);

let cur = { centres: seedC.map((c) => [...c]), value: seedV };
let best = { centres: seedC.map((c) => [...c]), value: seedV };
let steps = 0, acc = 0, accDown = 0;

while (Date.now() - t0 < T * 0.95) {
  steps++;
  const frac = (Date.now() - t0) / T;
  const tau = 25e-6 * Math.pow(0.02, frac) + 0.2e-6;
  const { radii } = lpRadii(cur.centres);
  const mv = ri(3);
  const pts = mv === 0 ? mvRelocate(cur.centres, radii)
    : mv === 1 ? mvRotate(cur.centres)
    : mvRoleSwap(cur.centres, radii);

  const cand = reknit(pts, 2600);
  const d = cand.value - cur.value;
  if (d > 0 || rnd() < Math.exp(d / tau)) {
    cur = cand; acc++;
    if (d <= 0) accDown++;
  } else if (rnd() < 0.04) {
    cur = { centres: best.centres.map((c) => [...c]), value: best.value };
  }
  if (cand.value > best.value + 1e-12) {
    best = { centres: cand.centres.map((c) => [...c]), value: cand.value };
    console.log(`step ${steps} NEW BEST ${cand.value.toFixed(12)} (${((cand.value - RECORD) * 1e6 >= 0 ? "+" : "")}${((cand.value - RECORD) * 1e6).toFixed(3)} micro vs record) mv ${mv}`);
  }
  if (steps % 10 === 0) {
    console.log(`  ${steps} steps, acc ${acc}/${steps} (down ${accDown}), cur ${cur.value.toFixed(9)}, best ${best.value.toFixed(12)}, tau ${(tau * 1e6).toFixed(1)}u, ${Math.round((Date.now() - t0) / 1000)}s`);
  }
}

const { radii } = lpRadii(best.centres);
const solution = best.centres.map(([x, y], i) => [x, y, radii[i]]);
writeFileSync(OUT, JSON.stringify({ score: best.value, solution }, null, 1));
console.log(`\nfinal ${best.value.toFixed(12)}  (${((best.value - RECORD) * 1e6 >= 0 ? "+" : "")}${((best.value - RECORD) * 1e6).toFixed(3)} micro vs record)`);
console.log(`wrote ${OUT}`);
