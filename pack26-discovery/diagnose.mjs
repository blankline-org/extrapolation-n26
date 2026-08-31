// Diagnostic: what LP values do the seed families actually reach after relax?
import { lpRadii } from "./lp-radii.mjs";

const N = 26;
let seed = Number(process.argv.find(a => a.startsWith("--seed="))?.slice(7) ?? "42") >>> 0;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function rand(a, b) { return a + (b - a) * rnd(); }
function ri(k) { return (rnd() * k) | 0; }
function gauss() { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307179586 * rnd()); }

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

function relax(centres, steps) {
  const X = new Float64Array(N), Y = new Float64Array(N), R = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    X[i] = Math.min(0.999, Math.max(0.001, centres[i][0]));
    Y[i] = Math.min(0.999, Math.max(0.001, centres[i][1]));
    R[i] = 0.02;
  }
  adam(X, Y, R, steps, 4e-3, 2e-5, 8, 0.0005);
  repair(X, Y, R, 1e-9); grow(X, Y, R, 1e-9, 40); repair(X, Y, R, 1e-9);
  const out = [];
  for (let i = 0; i < N; i++) out.push([X[i], Y[i]]);
  return out;
}

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

function genLattice() {
  const R = 4 + ri(4);
  const counts = Array.from({ length: R }, (_, k) => Math.floor(N / R) + (k < N % R ? 1 : 0));
  for (let t = 0; t < 8; t++) {
    const a = ri(R); let b = ri(R); let g = 0;
    while ((b === a || counts[b] <= 1) && g++ < 50) b = ri(R);
    if (b === a || counts[b] <= 1) continue;
    counts[a]++; counts[b]--;
  }
  const th = rand(0, Math.PI / 2), ct = Math.cos(th), st = Math.sin(th), jig = rand(0.002, 0.03);
  const pts = [];
  for (let k = 0; k < R; k++) {
    const c = counts[k], y = (k + 0.5) / R, off = k % 2 ? 0.5 / c : 0;
    for (let j = 0; j < c; j++) {
      let x = (j + 0.5) / c + off;
      if (x > 1) x -= 1;
      const px = x - 0.5, py = y - 0.5;
      pts.push([0.5 + ct * px - st * py + gauss() * jig, 0.5 + st * px + ct * py + gauss() * jig]);
    }
  }
  return normalize(pts, rand(0.03, 0.09));
}

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

const fams = { lattice: genLattice, poisson: genPoisson };
for (const [name, gen] of Object.entries(fams)) {
  const vals = [];
  for (let k = 0; k < 12; k++) {
    const c1400 = relax(gen(), 1400);
    vals.push(lpRadii(c1400).value);
  }
  vals.sort((a, b) => b - a);
  console.log(`${name.padEnd(9)} max ${vals[0].toFixed(9)}  med ${vals[6].toFixed(9)}  min ${vals[11].toFixed(9)}`);
}

// And: does a longer relax lift a lattice seed much?
const c = relax(genLattice(), 6000);
console.log(`lattice 6000-step relax: ${lpRadii(c).value.toFixed(9)}`);
