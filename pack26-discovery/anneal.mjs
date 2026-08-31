// Basin-crossing search for n=26 max-sum-radii in the unit square.
//
// What the diagnostics established:
//   - Random multi-start lands at 2.49-2.60. The 2.6359 level is unreachable
//     from scratch in feasible time. Only incumbent-anchored search matters.
//   - relocate.mjs was GREEDY: it only accepted strict improvements, so it
//     stopped at the first local optimum (32 moves). The claim "relocation
//     converged" is really "greedy relocation converged".
//
// What this script does differently: a Metropolis walker over contact
// structures. Moves relocate 1-4 circles into holes, reflect or rotate
// clusters, and the walker ACCEPTS DOWNHILL MOVES with probability
// exp(-d/Tau), so it can cross the valleys between basins that stopped the
// greedy loop. Every evaluation is the exact simplex LP; promising survivors
// get exact LP-gradient ascent from the duals.
//
//   node anneal.mjs --seconds=900 --seed=1 --out=walk-1.json

import { readFileSync, writeFileSync } from "node:fs";
import { lpRadii, centreGradient } from "./lp-radii.mjs";

const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`));
  return h ? h.slice(k.length + 3) : d;
};
const SECONDS = Number(arg("seconds", "900"));
const OUT = arg("out", "walk.json");
const RECORD = 2.635983084918;
const N = 26;

let seed = Number(arg("seed", "1")) >>> 0;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function rand(a, b) { return a + (b - a) * rnd(); }
function ri(k) { return (rnd() * k) | 0; }

const incumbent = JSON.parse(readFileSync("incumbent.json", "utf8"));
const incCentres = incumbent.solution.map((c) => [c[0], c[1]]);
const incValue = lpRadii(incCentres).value;

// ---------------- physics re-knit ----------------

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

// Partial re-knit: freeze the untouched circles' centres, relax only the
// moved ones (plus a short joint settle). Much cheaper than full relax, and
// it keeps the move's effect local so the walk explores coherently.
function reknit(centres, movedMask, initR, jointSteps) {
  const X = new Float64Array(N), Y = new Float64Array(N), R = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    X[i] = Math.min(0.999, Math.max(0.001, centres[i][0]));
    Y[i] = Math.min(0.999, Math.max(0.001, centres[i][1]));
    R[i] = initR[i];
  }
  // settle the moved circles against the frozen rest
  const sub = movedMask.filter(Boolean).length;
  if (sub > 0) {
    const idx = [];
    for (let i = 0; i < N; i++) if (movedMask[i]) idx.push(i);
    for (let t = 0; t < 260; t++) {
      const lr = 2e-3 * (1 - t / 260) + 1e-5;
      // simple gradient step on moved subset
      const gx = new Float64Array(N), gy = new Float64Array(N), gr = new Float64Array(N);
      evalGrad(X, Y, R, gx, gy, gr, 8, 0.0005);
      for (const i of idx) {
        X[i] -= lr * Math.tanh(gx[i] / 8);
        Y[i] -= lr * Math.tanh(gy[i] / 8);
        R[i] -= lr * Math.tanh(gr[i] / 8);
        if (X[i] < 0) X[i] = 0; else if (X[i] > 1) X[i] = 1;
        if (Y[i] < 0) Y[i] = 0; else if (Y[i] > 1) Y[i] = 1;
        if (R[i] < 0.0005) R[i] = 0.0005; else if (R[i] > 0.5) R[i] = 0.5;
      }
    }
  }
  adam(X, Y, R, jointSteps, 8e-4, 1e-5, 8, 0.0005);
  repair(X, Y, R, 1e-9); grow(X, Y, R, 1e-9, 30); repair(X, Y, R, 1e-9);
  const out = [];
  for (let i = 0; i < N; i++) out.push([X[i], Y[i]]);
  return out;
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

// ---------------- moves (each returns centres + mask of moved circles) ----------------

// Relocate k circles, biased small, into current holes.
function mvRelocate(centres, radii) {
  const k = 1 + ri(4);
  const pts = centres.map((c) => [...c]);
  const rs = [...radii];
  const mask = new Array(N).fill(false);
  const order = rs.map((r, i) => [r, i]).sort((a, b) => a[0] - b[0]);
  for (let t = 0; t < k; t++) {
    const pick = order[Math.floor(Math.pow(rnd(), 1.5) * Math.min(12, N))][1];
    if (mask[pick]) { t--; continue; }
    let bp = null, bc = -1;
    for (let s = 0; s < 200; s++) {
      const x = rand(0.02, 0.98), y = rand(0.02, 0.98);
      let c = Math.min(x, y, 1 - x, 1 - y);
      for (let j = 0; j < N; j++) {
        if (j === pick || mask[j]) continue;
        const d = Math.sqrt((x - pts[j][0]) * (x - pts[j][0]) + (y - pts[j][1]) * (y - pts[j][1])) - rs[j];
        if (d < c) c = d;
      }
      if (c > bc) { bc = c; bp = [x, y]; }
    }
    pts[pick] = bp;
    rs[pick] = Math.max(0.01, bc * 0.85);
    mask[pick] = true;
  }
  return { pts, mask, initR: rs };
}

// Reflect circles on one side of a random line through a random pivot.
function mvReflect(centres) {
  const vertical = rnd() < 0.5;
  const at = rand(0.25, 0.75);
  const mask = new Array(N).fill(false);
  const pts = centres.map(([x, y], i) => {
    if (vertical && x > at) { mask[i] = true; return [Math.max(0.02, 2 * at - x), y]; }
    if (!vertical && y > at) { mask[i] = true; return [x, Math.max(0.02, 2 * at - y)]; }
    return [x, y];
  });
  return { pts, mask, initR: null };
}

// Rotate a spatial cluster around a random circle's centre.
function mvRotate(centres) {
  const p = centres[ri(N)];
  const th = rand(0.8, 2.4) * (rnd() < 0.5 ? 1 : -1);
  const ct = Math.cos(th), st = Math.sin(th);
  const rad = rand(0.12, 0.32);
  const mask = new Array(N).fill(false);
  const pts = centres.map(([x, y], i) => {
    const dx = x - p[0], dy = y - p[1];
    if (Math.sqrt(dx * dx + dy * dy) > rad || (x === p[0] && y === p[1])) return [x, y];
    mask[i] = true;
    const nx = p[0] + ct * dx - st * dy, ny = p[1] + st * dx + ct * dy;
    return [Math.min(0.98, Math.max(0.02, nx)), Math.min(0.98, Math.max(0.02, ny))];
  });
  return { pts, mask, initR: null };
}

// Squeeze: push two random circles toward each other by a fraction, forcing
// a contact-graph rewrite between them.
function mvSqueeze(centres, radii) {
  const i = ri(N);
  let j = ri(N);
  while (j === i) j = ri(N);
  const pts = centres.map((c) => [...c]);
  const mask = new Array(N).fill(false);
  const f = rand(0.15, 0.45);
  const mx = (pts[i][0] + pts[j][0]) / 2, my = (pts[i][1] + pts[j][1]) / 2;
  for (const k of [i, j]) {
    pts[k][0] += (mx - pts[k][0]) * f;
    pts[k][1] += (my - pts[k][1]) * f;
    mask[k] = true;
  }
  const rs = [...radii];
  rs[i] *= 1 - f * 0.5; rs[j] *= 1 - f * 0.5;
  return { pts, mask, initR: rs };
}

// ---------------- verification ----------------

function verify(centres, radii) {
  let worst = 0;
  for (let i = 0; i < N; i++) {
    const [x, y] = centres[i];
    worst = Math.max(worst, radii[i] - x, radii[i] - y, radii[i] - (1 - x), radii[i] - (1 - y), -radii[i]);
    for (let j = i + 1; j < N; j++) {
      const d = Math.sqrt((x - centres[j][0]) ** 2 + (y - centres[j][1]) ** 2);
      worst = Math.max(worst, radii[i] + radii[j] - d);
    }
  }
  return worst;
}

// ---------------- Metropolis walk ----------------

const t0 = Date.now();
const T = SECONDS * 1000;

console.log(`incumbent ${incValue.toFixed(12)}   need +${((RECORD - incValue) * 1e6).toFixed(1)} micro to tie record`);

let best = { centres: incCentres.map((c) => [...c]), value: incValue };
let cur = { centres: incCentres.map((c) => [...c]), value: incValue };
let accepted = 0, downhill = 0, steps = 0;

// Temperature in value units: start hot enough to accept ~30 micro downhill
// often, cool toward greedy over the run.
const TAU0 = 30e-6;
const TAU1 = 0.3e-6;

while (Date.now() - t0 < T * 0.96) {
  steps++;
  const frac = (Date.now() - t0) / T;
  const tau = TAU0 * Math.pow(TAU1 / TAU0, frac);

  const { radii } = lpRadii(cur.centres);
  const mv = ri(4);
  let g;
  if (mv === 0) g = mvRelocate(cur.centres, radii);
  else if (mv === 1) g = mvReflect(cur.centres);
  else if (mv === 2) g = mvRotate(cur.centres);
  else g = mvSqueeze(cur.centres, radii);

  const initR = g.initR ?? radii.map((r) => r * 0.95);
  const centres = reknit(g.pts, g.mask, initR, 500);
  const out = lpRadii(centres);

  let cand = { centres, value: out.value };
  // polish only candidates that land near the walker's level
  if (out.value > cur.value - 80e-6) {
    const p = lpPolish(centres, 1800);
    if (p.value > cand.value) cand = p;
  }

  const d = cand.value - cur.value;
  if (d > 0 || rnd() < Math.exp(d / tau)) {
    cur = cand;
    accepted++;
    if (d <= 0) downhill++;
  } else {
    // walker stays; small chance to teleport back to best (restart)
    if (rnd() < 0.03) cur = { centres: best.centres.map((c) => [...c]), value: best.value };
  }

  if (cand.value > best.value + 1e-12) {
    best = { centres: cand.centres.map((c) => [...c]), value: cand.value };
    console.log(`step ${steps}  NEW BEST ${cand.value.toFixed(12)}  (${((cand.value - RECORD) * 1e6).toFixed(2)} micro vs record)  mv ${mv} tau ${(tau * 1e6).toFixed(1)}u`);
  }
  if (steps % 100 === 0) {
    console.log(`  ${steps} steps, acc ${accepted} (down ${downhill}), cur ${cur.value.toFixed(9)}, best ${best.value.toFixed(12)}, tau ${(tau * 1e6).toFixed(1)}u, ${Math.round((Date.now() - t0) / 1000)}s`);
  }
}

// Final long polish of the best seen.
const remain = Math.max(5000, T - (Date.now() - t0) - 2000);
const fin = lpPolish(best.centres, Math.min(remain, 90000));
if (fin.value > best.value) best = fin;

const { radii } = lpRadii(best.centres);
const viol = verify(best.centres, radii);
const sum = radii.reduce((a, b) => a + b, 0);

console.log(`\nsteps          ${steps}  accepted ${accepted}  downhill ${downhill}`);
console.log(`final value    ${best.value.toFixed(12)}`);
console.log(`resum check    ${sum.toFixed(12)}`);
console.log(`max violation  ${viol.toExponential(3)}`);
console.log(`vs incumbent   ${((best.value - incValue) * 1e6).toFixed(3)} micro`);
console.log(`vs record      ${((best.value - RECORD) * 1e6).toFixed(3)} micro`);

const solution = best.centres.map(([x, y], i) => [x, y, radii[i]]);
writeFileSync(OUT, JSON.stringify({ score: best.value, violation: viol, steps, solution }, null, 1));
console.log(`wrote ${OUT}`);
