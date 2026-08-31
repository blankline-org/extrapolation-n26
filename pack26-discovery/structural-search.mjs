// Structural search for n=26 max-sum-radii packing in the unit square.
//
// The incumbent is an LP-verified local optimum of its basin, so this script
// never polishes it directly. Instead it searches for DIFFERENT contact
// structures:
//
//   Phase A: multi-start from diverse layout families (lattices at random
//            angles and row splits, rings, Poisson sequential placement,
//            corner-anchored, heavy perturbations of the incumbent), each
//            physically relaxed, then scored EXACTLY with the simplex LP.
//   Phase B: basin hopping from the elite set — multi-circle relocation into
//            holes, cluster reflection, cluster rotation — re-knit by physics,
//            then exact LP-gradient ascent (duals give the exact centre
//            gradient, no finite differences).
//   Final:   long LP-gradient polish of the best, independent verification.
//
//   node structural-search.mjs --seconds=600 --seed=1 --out=cand-1.json

import { readFileSync, writeFileSync } from "node:fs";
import { lpRadii, centreGradient } from "./lp-radii.mjs";

const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`));
  return h ? h.slice(k.length + 3) : d;
};
const SECONDS = Number(arg("seconds", "600"));
const OUT = arg("out", "candidate.json");
const RECORD = 2.635983084918;
const N = 26;

let seed = Number(arg("seed", "123456789")) >>> 0;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function rand(a, b) { return a + (b - a) * rnd(); }
function ri(k) { return (rnd() * k) | 0; }
function gauss() {
  let u = 0;
  while (u === 0) u = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307179586 * rnd());
}

const incumbent = JSON.parse(readFileSync("incumbent.json", "utf8"));
const incCentres = incumbent.solution.map((c) => [c[0], c[1]]);
const incRadii = incumbent.solution.map((c) => c[2]);
const incValue = lpRadii(incCentres).value;

// ---------------- physics relaxation ----------------

function evalGrad(X, Y, R, gx, gy, gr, lam, rmin) {
  let F = 0;
  gx.fill(0); gy.fill(0); gr.fill(0);
  for (let i = 0; i < N; i++) {
    const x = X[i], y = Y[i];
    F -= R[i]; gr[i] -= 1;
    let w = x, a = 0;
    if (1 - x < w) { w = 1 - x; a = 1; }
    if (y < w) { w = y; a = 2; }
    if (1 - y < w) { w = 1 - y; a = 3; }
    let v = R[i] - w;
    if (v > 0) {
      F += lam * v; gr[i] += lam;
      if (a === 0) gx[i] -= lam; else if (a === 1) gx[i] += lam;
      else if (a === 2) gy[i] -= lam; else gy[i] += lam;
    }
    v = rmin - R[i];
    if (v > 0) { F += lam * v; gr[i] -= lam; }
  }
  for (let i = 0; i < N; i++) {
    const xi = X[i], yi = Y[i], rI = R[i];
    for (let j = i + 1; j < N; j++) {
      const dx = xi - X[j], dy = yi - Y[j];
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1e-12) d = 1e-12;
      const v = rI + R[j] - d;
      if (v > 0) {
        F += lam * v;
        const s = lam / d;
        gx[i] -= dx * s; gy[i] -= dy * s;
        gx[j] += dx * s; gy[j] += dy * s;
        gr[i] += lam; gr[j] += lam;
      }
    }
  }
  return F;
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
      mx[i] = b1 * mx[i] + (1 - b1) * g;
      vx[i] = b2 * vx[i] + (1 - b2) * g * g;
      X[i] -= lr * (mx[i] * ic1) / (Math.sqrt(vx[i] * ic2) + eps);
      if (X[i] < 0) X[i] = 0; else if (X[i] > 1) X[i] = 1;
      g = gy[i];
      my[i] = b1 * my[i] + (1 - b1) * g;
      vy[i] = b2 * vy[i] + (1 - b2) * g * g;
      Y[i] -= lr * (my[i] * ic1) / (Math.sqrt(vy[i] * ic2) + eps);
      if (Y[i] < 0) Y[i] = 0; else if (Y[i] > 1) Y[i] = 1;
      g = gr[i];
      mr[i] = b1 * mr[i] + (1 - b1) * g;
      vr[i] = b2 * vr[i] + (1 - b2) * g * g;
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
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = X[i] - X[j], dy = Y[i] - Y[j];
        const d = Math.sqrt(dx * dx + dy * dy);
        const s = R[i] + R[j];
        if (s > d - gap) {
          let f = (d - gap) / s;
          if (f < 0) f = 0;
          R[i] *= f; R[j] *= f; changed = true;
        }
      }
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

// Relax a seed point set into a coherent packing; returns centres only.
function relax(centres, steps, initR) {
  const X = new Float64Array(N), Y = new Float64Array(N), R = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    X[i] = Math.min(0.999, Math.max(0.001, centres[i][0]));
    Y[i] = Math.min(0.999, Math.max(0.001, centres[i][1]));
    R[i] = initR ? initR[i] * 0.92 : 0.02;
  }
  adam(X, Y, R, steps, 4e-3, 2e-5, 8, 0.0005);
  repair(X, Y, R, 1e-9);
  grow(X, Y, R, 1e-9, 40);
  repair(X, Y, R, 1e-9);
  const out = [];
  for (let i = 0; i < N; i++) out.push([X[i], Y[i]]);
  return out;
}

// Exact LP-gradient ascent on centres. Duals give the exact gradient of the
// LP value w.r.t. centres, so this climbs the piecewise-linear value surface
// with no finite-difference noise.
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

// ---------------- seed families ----------------

function normalize(pts, m) {
  let mnx = 1, mxx = 0, mny = 1, mxy = 0;
  for (const [x, y] of pts) {
    if (x < mnx) mnx = x; if (x > mxx) mxx = x;
    if (y < mny) mny = y; if (y > mxy) mxy = y;
  }
  const sx = mxx - mnx > 1e-9 ? (1 - 2 * m) / (mxx - mnx) : 1;
  const sy = mxy - mny > 1e-9 ? (1 - 2 * m) / (mxy - mny) : 1;
  return pts.map(([x, y]) => [m + (x - mnx) * sx, m + (y - mny) * sy]);
}

// Lattice: R rows with random count split, hex-style alternating offset,
// random global rotation and jitter. Covers hex grids at any angle.
function genLattice() {
  const R = 4 + ri(4);
  const counts = Array.from({ length: R }, (_, k) => Math.floor(N / R) + (k < N % R ? 1 : 0));
  for (let t = 0; t < 8; t++) {
    const a = ri(R);
    let b = ri(R);
    let guard = 0;
    while ((b === a || counts[b] <= 1) && guard++ < 50) b = ri(R);
    if (b === a || counts[b] <= 1) continue;
    counts[a]++; counts[b]--;
  }
  const th = rand(0, Math.PI / 2);
  const ct = Math.cos(th), st = Math.sin(th);
  const jig = rand(0.002, 0.03);
  const pts = [];
  for (let k = 0; k < R; k++) {
    const c = counts[k];
    const y = (k + 0.5) / R;
    const off = k % 2 ? 0.5 / c : 0;
    for (let j = 0; j < c; j++) {
      let x = (j + 0.5) / c + off;
      if (x > 1) x -= 1;
      const px = x - 0.5, py = y - 0.5;
      pts.push([
        0.5 + ct * px - st * py + gauss() * jig,
        0.5 + st * px + ct * py + gauss() * jig,
      ]);
    }
  }
  return normalize(pts, rand(0.03, 0.09));
}

// Rings: an outer ring, an inner ring, and a centre cluster.
function genRings() {
  const outer = 8 + ri(9);
  const pts = [];
  const a0 = rand(0, 6.283);
  for (let k = 0; k < outer; k++) {
    const a = a0 + (2 * Math.PI * k) / outer + rand(-0.08, 0.08);
    const rr = rand(0.36, 0.44);
    pts.push([0.5 + rr * Math.cos(a), 0.5 + rr * Math.sin(a)]);
  }
  const left = N - outer;
  const inner = Math.max(1, Math.round(left * rand(0.4, 0.85)));
  for (let k = 0; k < inner; k++) {
    const a = a0 + (2 * Math.PI * k) / inner + rand(-0.15, 0.15);
    const rr = rand(0.12, 0.27);
    pts.push([0.5 + rr * Math.cos(a), 0.5 + rr * Math.sin(a)]);
  }
  while (pts.length < N) pts.push([rand(0.35, 0.65), rand(0.35, 0.65)]);
  return pts;
}

// Poisson: sequential max-clearance placement. Varied organic structures.
function genPoisson() {
  const pts = [];
  for (let i = 0; i < N; i++) {
    let bp = null, bc = -1;
    for (let s = 0; s < 150; s++) {
      const x = rand(0.03, 0.97), y = rand(0.03, 0.97);
      let c = Math.min(x, y, 1 - x, 1 - y);
      for (const [px, py] of pts) {
        const d = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py)) * 0.5;
        if (d < c) c = d;
      }
      if (c > bc) { bc = c; bp = [x, y]; }
    }
    pts.push(bp);
  }
  return pts;
}

// Corner-anchored: four big corner circles, Poisson interior.
function genCorner() {
  const m = rand(0.08, 0.14);
  const pts = [[m, m], [1 - m, m], [m, 1 - m], [1 - m, 1 - m]];
  for (let i = 4; i < N; i++) {
    let bp = null, bc = -1;
    for (let s = 0; s < 150; s++) {
      const x = rand(0.03, 0.97), y = rand(0.03, 0.97);
      let c = Math.min(x, y, 1 - x, 1 - y);
      for (const [px, py] of pts) {
        const d = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py)) * 0.5;
        if (d < c) c = d;
      }
      if (c > bc) { bc = c; bp = [x, y]; }
    }
    pts.push(bp);
  }
  return pts;
}

// Heavy perturbation of the incumbent: rip out k circles, re-drop into holes.
function genPerturb() {
  const k = 3 + ri(8);
  const idx = new Set();
  while (idx.size < k) idx.add(ri(N));
  const pts = incCentres.map((c, i) => (idx.has(i) ? null : [...c]));
  const keptR = incRadii.map((r, i) => (idx.has(i) ? null : r));
  for (const i of idx) {
    let bp = null, bc = -1;
    for (let s = 0; s < 150; s++) {
      const x = rand(0.03, 0.97), y = rand(0.03, 0.97);
      let c = Math.min(x, y, 1 - x, 1 - y);
      for (let j = 0; j < N; j++) {
        if (pts[j] === null || j === i) continue;
        const d = Math.sqrt((x - pts[j][0]) * (x - pts[j][0]) + (y - pts[j][1]) * (y - pts[j][1])) - keptR[j];
        if (d < c) c = d;
      }
      if (c > bc) { bc = c; bp = [x, y]; }
    }
    pts[i] = bp;
    keptR[i] = Math.max(0.01, bc * 0.9);
  }
  return { pts, initR: keptR };
}

// ---------------- basin-hopping moves ----------------

// Relocate k small circles into current holes (against LP radii of base).
function mvRelocate(centres, radii, k) {
  const pts = centres.map((c) => [...c]);
  const rs = [...radii];
  const order = rs.map((r, i) => [r, i]).sort((a, b) => a[0] - b[0]);
  for (let t = 0; t < k; t++) {
    const pick = order[Math.floor(Math.pow(rnd(), 1.6) * Math.min(10, N - t))][1];
    // if already moved this round, skip to next
    if (rs[pick] < 0) { t--; continue; }
    let bp = null, bc = -1;
    for (let s = 0; s < 200; s++) {
      const x = rand(0.02, 0.98), y = rand(0.02, 0.98);
      let c = Math.min(x, y, 1 - x, 1 - y);
      for (let j = 0; j < N; j++) {
        if (j === pick || rs[j] < 0) continue;
        const d = Math.sqrt((x - pts[j][0]) * (x - pts[j][0]) + (y - pts[j][1]) * (y - pts[j][1])) - rs[j];
        if (d < c) c = d;
      }
      if (c > bc) { bc = c; bp = [x, y]; }
    }
    pts[pick] = bp;
    rs[pick] = -1; // mark as moved (excluded from later clearance this round)
    // restore a provisional radius for subsequent picks' clearance calc
    rs[pick] = Math.max(0.01, bc * 0.85);
  }
  return { pts, initR: rs };
}

// Reflect the circles on one side of a random vertical/horizontal line.
function mvReflect(centres) {
  const vertical = rnd() < 0.5;
  const at = rand(0.3, 0.7);
  return centres.map(([x, y]) => {
    if (vertical && x > at) return [2 * at - x, y];
    if (!vertical && y > at) return [x, 2 * at - y];
    return [x, y];
  }).map(([x, y]) => [Math.min(0.98, Math.max(0.02, x)), Math.min(0.98, Math.max(0.02, y))]);
}

// Rotate a spatial cluster around a pivot by 60-150 degrees.
function mvRotate(centres) {
  const p = centres[ri(N)];
  const th = rand(1.05, 2.6) * (rnd() < 0.5 ? 1 : -1);
  const ct = Math.cos(th), st = Math.sin(th);
  const rad = rand(0.15, 0.35);
  return centres.map(([x, y]) => {
    const dx = x - p[0], dy = y - p[1];
    if (Math.sqrt(dx * dx + dy * dy) > rad) return [x, y];
    const nx = p[0] + ct * dx - st * dy, ny = p[1] + st * dx + ct * dy;
    return [Math.min(0.98, Math.max(0.02, nx)), Math.min(0.98, Math.max(0.02, ny))];
  });
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

// ---------------- main ----------------

const t0 = Date.now();
const T = SECONDS * 1000;
let best = { centres: incCentres.map((c) => [...c]), value: incValue };
const elites = [];

function keyOf(centres) {
  return centres
    .map((c) => [Math.round(c[0] * 400), Math.round(c[1] * 400)])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .flat()
    .join(",");
}
function addElite(centres, value) {
  const key = keyOf(centres);
  for (const e of elites) if (e.key === key) return false;
  elites.push({ centres: centres.map((c) => [...c]), value, key });
  elites.sort((a, b) => b.value - a.value);
  if (elites.length > 40) elites.pop();
  return true;
}

console.log(`incumbent ${incValue.toFixed(12)}   need +${((RECORD - incValue) * 1e6).toFixed(1)} micro to tie record`);
addElite(best.centres, best.value);

// ---- Phase A: multi-start screening ----
let tried = 0;
while (Date.now() - t0 < T * 0.45) {
  const fam = ri(5);
  let pts, initR = null;
  if (fam === 0) pts = genLattice();
  else if (fam === 1) pts = genRings();
  else if (fam === 2) pts = genPoisson();
  else if (fam === 3) pts = genCorner();
  else { const g = genPerturb(); pts = g.pts; initR = g.initR; }

  const centres = relax(pts, 1400, initR);
  const out = lpRadii(centres);
  tried++;
  if (out.value > incValue - 250e-6) addElite(centres, out.value);
  if (out.value > best.value + 1e-12) {
    best = { centres: centres.map((c) => [...c]), value: out.value };
    console.log(`A  new best ${out.value.toFixed(12)}  fam ${fam}  seed#${tried}  (${((out.value - RECORD) * 1e6).toFixed(2)} micro vs record)`);
  }
  if (tried % 100 === 0) {
    console.log(`  A ${tried} seeds, best ${best.value.toFixed(12)}, elites ${elites.length}, top ${elites[0].value.toFixed(12)}, ${Math.round((Date.now() - t0) / 1000)}s`);
  }
}

console.log(`phase A done: ${tried} seeds, ${elites.length} elites, best ${best.value.toFixed(12)}`);

// ---- Phase B: basin hopping from elites ----
let hops = 0;
while (Date.now() - t0 < T * 0.97) {
  const idx = Math.floor(Math.pow(rnd(), 1.7) * Math.min(elites.length, 12));
  const base = elites[idx] || best;
  const { radii } = lpRadii(base.centres);
  const mv = ri(3);
  let pts, initR = radii.map((r) => r * 0.92);
  if (mv === 0) {
    const g = mvRelocate(base.centres, radii, 1 + ri(3));
    pts = g.pts; initR = g.initR;
  } else if (mv === 1) {
    pts = mvReflect(base.centres);
  } else {
    pts = mvRotate(base.centres);
  }
  const centres = relax(pts, 1200, initR);
  const out = lpRadii(centres);
  hops++;
  let final = { centres, value: out.value };
  if (out.value > base.value - 60e-6) {
    final = lpPolish(centres, 2500);
  }
  if (final.value > base.value + 1e-12) addElite(final.centres, final.value);
  if (final.value > best.value + 1e-12) {
    best = { centres: final.centres.map((c) => [...c]), value: final.value };
    console.log(`B  new best ${final.value.toFixed(12)}  mv ${mv} hop#${hops}  (${((final.value - RECORD) * 1e6).toFixed(2)} micro vs record)`);
  }
  if (hops % 40 === 0) {
    console.log(`  B ${hops} hops, best ${best.value.toFixed(12)}, elites ${elites.length}, ${Math.round((Date.now() - t0) / 1000)}s`);
  }
}

// ---- Final: long polish + verify ----
const remain = Math.max(5000, T - (Date.now() - t0) - 2000);
const fin = lpPolish(best.centres, Math.min(remain, 60000));
if (fin.value > best.value) best = fin;

const { radii } = lpRadii(best.centres);
const viol = verify(best.centres, radii);
const sum = radii.reduce((a, b) => a + b, 0);

console.log(`\nfinal value    ${best.value.toFixed(12)}`);
console.log(`resum check    ${sum.toFixed(12)}`);
console.log(`max violation  ${viol.toExponential(3)}`);
console.log(`vs incumbent   ${((best.value - incValue) * 1e6).toFixed(3)} micro`);
console.log(`vs record      ${((best.value - RECORD) * 1e6).toFixed(3)} micro`);

const solution = best.centres.map(([x, y], i) => [x, y, radii[i]]);
writeFileSync(OUT, JSON.stringify({ score: best.value, violation: viol, solution }, null, 1));
console.log(`wrote ${OUT}`);
