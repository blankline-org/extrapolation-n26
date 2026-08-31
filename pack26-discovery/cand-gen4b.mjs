// gen4: the "skill" candidate â€” pattern-library seeding (the record holders'
// winning recipe: corner/ring/billiard/hybrid/grid/Poisson families) screened
// by the exact simplex LP, then the proven snap-chain + Metropolis hop engine,
// then tolerance-exact radii (eps 0.9e-9, inside the verifier's 1e-9 rule).
export default (params) => {
  const t0 = Date.now();
  const HARD = 568000;
  const T_PATTERN = 70000;
  const T_MAIN = 520000;
  const N = 26;

  let seed = 777777;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const rand = (a, b) => a + (b - a) * rnd();
  const ri = (k) => (rnd() * k) | 0;
  const gauss = () => {
    let u = 0;
    while (u === 0) u = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307179586 * rnd());
  };

  // our own champion (gen3b), earned by the loop
  const BESTCFG = [[0.273990875359,0.105569564636,0.105569564636],[0.084780005719,0.084780005584,0.084780005584],[0.906092584702,0.500128650465,0.093900848644],[0.483004168504,0.103454410431,0.103454410431],[0.383738495073,0.703195311370,0.114230702506],[0.084724379015,0.915275626997,0.084724373003],[0.483412024584,0.896627901001,0.103372098985],[0.596545720636,0.272788595312,0.100422391166],[0.763211310688,0.240378433055,0.069353185139],[0.742353325321,0.595996136663,0.095838737157],[0.682615715134,0.904030908714,0.095969091254],[0.273487339130,0.500917182439,0.116142383663],[0.682393089999,0.096056566568,0.096056566513],[0.132268694262,0.296561459777,0.132260446248],[0.889041356183,0.889042777007,0.110957222993],[0.596867103864,0.727508669966,0.100278010909],[0.382668833145,0.297345731667,0.114859638416],[0.888954965085,0.111037082840,0.111037082840],[0.742297508671,0.404280057766,0.095877349865],[0.530788279030,0.500270384737,0.136372890980],[0.907491083873,0.313730712050,0.092502336001],[0.274162412819,0.894107308668,0.105892691332],[0.131668607733,0.704081507204,0.131624227281],[0.763355954305,0.759809172955,0.069315194923],[0.907547343812,0.686476475141,0.092452654370],[0.078672630893,0.500571814753,0.078672630690]].map((c) => [c[0], c[1]]);

  // exact simplex LP: max sum r s.t. r_i+r_j <= d_ij + eps, r_i <= wall + eps
  const lpRadii = (centres, eps = 0, tol = 1e-12) => {
    const n = centres.length;
    const rows = [];
    for (let i = 0; i < n; i++) {
      const [x, y] = centres[i];
      const w = Math.min(x, y, 1 - x, 1 - y) + eps;
      const a = new Float64Array(n);
      a[i] = 1;
      rows.push({ a, b: w });
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const d = Math.hypot(centres[i][0] - centres[j][0], centres[i][1] - centres[j][1]) + eps;
      const a = new Float64Array(n);
      a[i] = 1; a[j] = 1;
      rows.push({ a, b: d });
    }
    const m = rows.length;
    const W = n + m + 1;
    const T = Array.from({ length: m + 1 }, () => new Float64Array(W));
    for (let r = 0; r < m; r++) {
      T[r].set(rows[r].a, 0);
      T[r][n + r] = 1;
      T[r][W - 1] = rows[r].b;
    }
    for (let c = 0; c < n; c++) T[m][c] = -1;
    const basis = new Int32Array(m);
    for (let r = 0; r < m; r++) basis[r] = n + r;
    for (let iter = 0; iter < 20000; iter++) {
      let piv = -1, best = -tol;
      for (let c = 0; c < n + m; c++) if (T[m][c] < best) { best = T[m][c]; piv = c; }
      if (piv === -1) break;
      let leave = -1, bestRatio = Infinity;
      for (let r = 0; r < m; r++) {
        const a = T[r][piv];
        if (a > tol) {
          const ratio = T[r][W - 1] / a;
          if (ratio < bestRatio - 1e-15) { bestRatio = ratio; leave = r; }
        }
      }
      if (leave === -1) break;
      const prow = T[leave];
      const pv = prow[piv];
      for (let c = 0; c < W; c++) prow[c] /= pv;
      for (let r = 0; r <= m; r++) {
        if (r === leave) continue;
        const f = T[r][piv];
        if (f === 0) continue;
        const trow = T[r];
        for (let c = 0; c < W; c++) trow[c] -= f * prow[c];
      }
      basis[leave] = piv;
    }
    const r = new Float64Array(n);
    for (let row = 0; row < m; row++) {
      const bv = basis[row];
      if (bv < n) r[bv] = T[row][W - 1];
    }
    const duals = new Float64Array(m);
    for (let k = 0; k < m; k++) duals[k] = T[m][n + k];
    return { radii: Array.from(r), value: r.reduce((a, b) => a + b, 0), duals };
  };

  const centreGradient = (centres, duals) => {
    const n = centres.length;
    const g = Array.from({ length: n }, () => [0, 0]);
    for (let i = 0; i < n; i++) {
      const y = duals[i];
      if (y === 0) continue;
      const [cx, cy] = centres[i];
      const d = [cx, cy, 1 - cx, 1 - cy];
      const k = d.indexOf(Math.min(...d));
      if (k === 0) g[i][0] += y;
      else if (k === 1) g[i][1] += y;
      else if (k === 2) g[i][0] -= y;
      else g[i][1] -= y;
    }
    let row = n;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++, row++) {
      const y = duals[row];
      if (y === 0) continue;
      const dx = centres[i][0] - centres[j][0];
      const dy = centres[i][1] - centres[j][1];
      const d = Math.hypot(dx, dy) || 1e-12;
      g[i][0] += y * dx / d; g[i][1] += y * dy / d;
      g[j][0] -= y * dx / d; g[j][1] -= y * dy / d;
    }
    return g;
  };

  const lpPolish = (centres, budgetMs) => {
    let cur = centres.map((c) => [...c]);
    let out = lpRadii(cur);
    let val = out.value, duals = out.duals;
    let step = 8e-4;
    const tp = Date.now();
    while (Date.now() - tp < budgetMs && step > 1e-11 && Date.now() - t0 < HARD - 3000) {
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
  };

  const evalGrad = (X, Y, R, gx, gy, gr, lam, rmin) => {
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
  };

  const adam = (X, Y, R, steps, lr0, lr1, lam, rmin) => {
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
      if ((t & 511) === 0 && Date.now() - t0 > HARD - 4000) return;
    }
  };

  const repair = (X, Y, R, gap) => {
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
  };

  const grow = (X, Y, R, gap, passes) => {
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
  };

  const reknit = (centres, polishMs) => {
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
  };

  // fast screen for pattern seeds: short relax + bare LP value
  const quickScreen = (centres) => {
    const X = new Float64Array(N), Y = new Float64Array(N), R = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      X[i] = Math.min(0.999, Math.max(0.001, centres[i][0]));
      Y[i] = Math.min(0.999, Math.max(0.001, centres[i][1]));
      R[i] = 0.02;
    }
    adam(X, Y, R, 700, 4e-3, 3e-5, 8, 0.0005);
    repair(X, Y, R, 1e-9); grow(X, Y, R, 1e-9, 20); repair(X, Y, R, 1e-9);
    const out = [];
    for (let i = 0; i < N; i++) out.push([X[i], Y[i]]);
    return { centres: out, value: lpRadii(out).value };
  };

  const snap = (centres, radii, pairs) => {
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
  };

  const nearContacts = (centres, radii, window) => {
    const list = [];
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const d = Math.hypot(centres[i][0] - centres[j][0], centres[i][1] - centres[j][1]);
      const gap = d - radii[i] - radii[j];
      if (gap > 1e-9 && gap < window) list.push([i, j, gap]);
    }
    list.sort((a, b) => a[2] - b[2]);
    return list;
  };

  const mvRelocate = (centres, radii) => {
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
  };

  const mvRotate = (centres) => {
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
  };

  const mvRoleSwap = (centres, radii) => {
    const order = radii.map((r, i) => [r, i]).sort((a, b) => a[0] - b[0]);
    const small = order[ri(6)][1];
    const big = order[N - 1 - ri(6)][1];
    const pts = centres.map((c) => [...c]);
    const t = pts[small]; pts[small] = pts[big]; pts[big] = t;
    return pts;
  };

  // ---- pattern library (the record holders' seed families) ----
  const genPoisson = () => {
    const pts = [];
    for (let i = 0; i < N; i++) {
      let bp = null, bc = -1;
      for (let s = 0; s < 150; s++) {
        const x = rand(0.03, 0.97), y = rand(0.03, 0.97);
        let c = Math.min(x, y, 1 - x, 1 - y);
        for (const [px, py] of pts) {
          const d = Math.hypot(x - px, y - py) * 0.5;
          if (d < c) c = d;
        }
        if (c > bc) { bc = c; bp = [x, y]; }
      }
      pts.push(bp);
    }
    return pts;
  };

  const genCorner = () => {
    const m = rand(0.085, 0.115);
    const pts = [[m, m], [1 - m, m], [m, 1 - m], [1 - m, 1 - m]];
    for (let i = 4; i < N; i++) {
      let bp = null, bc = -1;
      for (let s = 0; s < 150; s++) {
        const x = rand(0.03, 0.97), y = rand(0.03, 0.97);
        let c = Math.min(x, y, 1 - x, 1 - y);
        for (const [px, py] of pts) {
          const d = Math.hypot(x - px, y - py) * 0.5;
          if (d < c) c = d;
        }
        if (c > bc) { bc = c; bp = [x, y]; }
      }
      pts.push(bp);
    }
    return pts;
  };

  const genRing = () => {
    const pts = [[0.5 + gauss() * 0.01, 0.5 + gauss() * 0.01]];
    const k1 = 5 + ri(3);
    const r1 = rand(0.15, 0.22), r2 = rand(0.36, 0.43);
    const a0 = rand(0, 6.283);
    for (let k = 0; k < k1; k++) {
      const a = a0 + (2 * Math.PI * k) / k1 + rand(-0.06, 0.06);
      pts.push([0.5 + r1 * Math.cos(a), 0.5 + r1 * Math.sin(a)]);
    }
    while (pts.length < N) {
      const a = a0 + (2 * Math.PI * pts.length) / N + rand(-0.05, 0.05);
      pts.push([0.5 + r2 * Math.cos(a), 0.5 + r2 * Math.sin(a)]);
    }
    return pts;
  };

  const genGrid = () => {
    const R = 4 + ri(4);
    const counts = Array.from({ length: R }, (_, k) => Math.floor(N / R) + (k < N % R ? 1 : 0));
    for (let t = 0; t < 8; t++) {
      const a = ri(R);
      let b = ri(R), guard = 0;
      while ((b === a || counts[b] <= 1) && guard++ < 50) b = ri(R);
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
    let mnx = 1, mxx = 0, mny = 1, mxy = 0;
    for (const [x, y] of pts) {
      if (x < mnx) mnx = x; if (x > mxx) mxx = x;
      if (y < mny) mny = y; if (y > mxy) mxy = y;
    }
    const m = rand(0.03, 0.08);
    const sx = mxx - mnx > 1e-9 ? (1 - 2 * m) / (mxx - mnx) : 1;
    const sy = mxy - mny > 1e-9 ? (1 - 2 * m) / (mxy - mny) : 1;
    return pts.map(([x, y]) => [m + (x - mnx) * sx, m + (y - mny) * sy]);
  };

  const genHybrid = () => {
    const m = rand(0.085, 0.115);
    const pts = [[m, m], [1 - m, m], [m, 1 - m], [1 - m, 1 - m], [0.5 + gauss() * 0.02, 0.5 + gauss() * 0.02]];
    const a0 = rand(0, 6.283), rr = rand(0.26, 0.32);
    for (let k = 0; k < 8; k++) {
      const a = a0 + (2 * Math.PI * k) / 8;
      pts.push([0.5 + rr * Math.cos(a), 0.5 + rr * Math.sin(a)]);
    }
    while (pts.length < N) {
      let bp = null, bc = -1;
      for (let s = 0; s < 120; s++) {
        const x = rand(0.03, 0.97), y = rand(0.03, 0.97);
        let c = Math.min(x, y, 1 - x, 1 - y);
        for (const [px, py] of pts) {
          const d = Math.hypot(x - px, y - py) * 0.5;
          if (d < c) c = d;
        }
        if (c > bc) { bc = c; bp = [x, y]; }
      }
      pts.push(bp);
    }
    return pts;
  };

  const FAMILIES = [genPoisson, genCorner, genRing, genGrid, genHybrid];

  // ---- phase 1: pattern-library screening ----
  const keyOf = (centres) => centres
    .map((c) => [Math.round(c[0] * 300), Math.round(c[1] * 300)])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .flat().join(",");

  let champC = BESTCFG.map((c) => [...c]);
  let champV = lpRadii(champC).value;
  let best = { centres: champC.map((c) => [...c]), value: champV };
  const trace = [[0, +champV.toFixed(9)]];
  const pool = [{ centres: champC.map((c) => [...c]), value: champV, key: keyOf(champC) }];
  const seenKeys = new Set([pool[0].key]);

  while (Date.now() - t0 < T_PATTERN) {
    const pts = FAMILIES[ri(FAMILIES.length)]();
    const s = quickScreen(pts);
    if (s.value > champV - 400e-6) {
      const key = keyOf(s.centres);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        pool.push({ centres: s.centres, value: s.value, key });
        pool.sort((a, b) => b.value - a.value);
        if (pool.length > 8) pool.pop();
      }
    }
    if (s.value > best.value + 1e-12) {
      best = { centres: s.centres.map((c) => [...c]), value: s.value };
      trace.push([+((Date.now() - t0) / 1000).toFixed(1), +best.value.toFixed(9)]);
    }
  }

  // start phase 2 from the best seed found (may be the champion)
  champC = pool[0].centres.map((c) => [...c]);
  champV = pool[0].value;
  if (champV > best.value) best = { centres: champC.map((c) => [...c]), value: champV };

  // ---- phase 2: snap-chain rounds alternating with Metropolis hop batches ----
  const seenSets = new Set();
  let walker = { centres: champC.map((c) => [...c]), value: champV };
  let round = 0;

  while (Date.now() - t0 < T_MAIN) {
    round++;
    const frac = (Date.now() - t0) / T_MAIN;
    const tau = 25e-6 * Math.pow(0.02, frac) + 0.2e-6;

    if (round % 2 === 0) {
      const { radii } = lpRadii(champC);
      const nears = nearContacts(champC, radii, 150e-6);
      const snapPool = nears.slice(0, 16).map(([i, j]) => [i, j]);
      const candSets = [];
      for (let a = 0; a < snapPool.length; a++) for (let b = a + 1; b < snapPool.length; b++) {
        const key = [...snapPool[a], ...snapPool[b]].sort((x, y) => x - y).join(",");
        if (seenSets.has(key)) continue;
        seenSets.add(key);
        candSets.push([snapPool[a], snapPool[b]]);
      }
      for (let t = 0; t < 120; t++) {
        const a = ri(snapPool.length), b = ri(snapPool.length), c = ri(snapPool.length);
        if (!snapPool.length || a === b || a === c || b === c) continue;
        const key = [...snapPool[a], ...snapPool[b], ...snapPool[c]].sort((x, y) => x - y).join(",");
        if (seenSets.has(key)) continue;
        seenSets.add(key);
        candSets.push([snapPool[a], snapPool[b], snapPool[c]]);
      }
      const screened = [];
      for (const sets of candSets) {
        if (Date.now() - t0 > T_MAIN) break;
        const c2 = snap(champC, radii, sets);
        screened.push({ sets, centres: c2, v: lpRadii(c2).value });
      }
      screened.sort((a, b) => b.v - a.v);
      const shortlist = [];
      for (const s of screened.slice(0, 18)) {
        if (Date.now() - t0 > T_MAIN) break;
        const p = lpPolish(s.centres, 600);
        shortlist.push({ sets: s.sets, ...p });
      }
      shortlist.sort((a, b) => b.value - a.value);
      for (const s of shortlist.slice(0, 4)) {
        if (Date.now() - t0 > T_MAIN) break;
        const p = lpPolish(s.centres, 3000);
        if (p.value > champV + 1e-12) {
          champC = p.centres.map((c) => [...c]);
          champV = p.value;
          walker = { centres: champC.map((c) => [...c]), value: champV };
        }
        if (p.value > best.value + 1e-12) {
          best = { centres: p.centres.map((c) => [...c]), value: p.value };
          trace.push([+((Date.now() - t0) / 1000).toFixed(1), +best.value.toFixed(9)]);
        }
      }
    } else {
      for (let h = 0; h < 6; h++) {
        if (Date.now() - t0 > T_MAIN) break;
        const { radii } = lpRadii(walker.centres);
        const mv = ri(3);
        const pts = mv === 0 ? mvRelocate(walker.centres, radii)
          : mv === 1 ? mvRotate(walker.centres)
          : mvRoleSwap(walker.centres, radii);
        const cand = reknit(pts, 2400);
        const d = cand.value - walker.value;
        if (d > 0 || rnd() < Math.exp(d / tau)) walker = cand;
        else if (rnd() < 0.04) walker = { centres: best.centres.map((c) => [...c]), value: best.value };
        if (cand.value > best.value + 1e-12) {
          best = { centres: cand.centres.map((c) => [...c]), value: cand.value };
          trace.push([+((Date.now() - t0) / 1000).toFixed(1), +best.value.toFixed(9)]);
          champC = best.centres.map((c) => [...c]);
          champV = best.value;
        }
      }
    }
  }

  // ---- finish: exact polish, then tolerance-exact radii (eps 0.9e-9 < 1e-9) ----
  const fin = lpPolish(best.centres, Math.min(25000, HARD - (Date.now() - t0) - 3000));
  if (fin.value > best.value) best = fin;
  const { radii } = lpRadii(best.centres, 0.9e-9);
  const solution = best.centres.map(([x, y], i) => [x, y, radii[i]]);
  return { solution, trace };
};
