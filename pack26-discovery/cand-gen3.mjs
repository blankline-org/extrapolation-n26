// gen0: exact-LP snap-chain + relocation hopping, seeded from our own 2.6359157.
// Self-contained: simplex LP radii + dual-gradient polish + physics re-knit.
export default (params) => {
  const t0 = Date.now();
  const HARD = 568000;
  const T_MAIN = 522000;
  const N = 26;

  let seed = 999983;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const rand = (a, b) => a + (b - a) * rnd();
  const ri = (k) => (rnd() * k) | 0;

  const BESTCFG = [[0.273991112483,0.105569646311,0.105569646209],[0.084780081576,0.084780077737,0.084780077737],[0.906092102592,0.500129151831,0.093899764913],[0.483004633858,0.103454570203,0.103454570203],[0.383739167917,0.703194847992,0.11423124222],[0.084724452453,0.915275548349,0.084724450103],[0.483412038778,0.896628128104,0.103371871362],[0.596546462026,0.272789083885,0.100422658215],[0.763211265255,0.240378235387,0.069353893761],[0.7423540942,0.59599635732,0.095838604212],[0.682615469606,0.904030938091,0.095969061865],[0.27348692322,0.500917120863,0.116142012203],[0.682392269991,0.096056298086,0.096056298086],[0.132268755212,0.296561566912,0.132260409916],[0.889041907946,0.889042651257,0.110957348743],[0.59686667145,0.727508186422,0.100278583323],[0.382669114281,0.297346223355,0.114859851766],[0.888955364611,0.111036772182,0.111036772182],[0.742298412854,0.404280552907,0.095877208287],[0.530788507664,0.500270058175,0.136371983248],[0.907492829988,0.313731142526,0.09250350735],[0.274162611932,0.894107251483,0.105892739728],[0.131668828938,0.704081406205,0.131624204064],[0.76335597467,0.759809369314,0.069315208586],[0.907547192991,0.686476024263,0.092452788472],[0.078672603509,0.500571831779,0.078672602314]];

  const lpRadii = (centres, tol = 1e-12) => {
    const n = centres.length;
    const rows = [];
    for (let i = 0; i < n; i++) {
      const [x, y] = centres[i];
      const w = Math.min(x, y, 1 - x, 1 - y);
      const a = new Float64Array(n);
      a[i] = 1;
      rows.push({ a, b: w });
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const d = Math.hypot(centres[i][0] - centres[j][0], centres[i][1] - centres[j][1]);
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

  // push an interior circle onto its nearest wall, creating a new wall contact
  // (record topology has 16 boundary contacts; ours has 13)
  const mvWallSeed = (centres, radii) => {
    const pts = centres.map((c) => [...c]);
    const cands = [];
    for (let i = 0; i < N; i++) {
      const [x, y] = pts[i];
      const w = Math.min(x, y, 1 - x, 1 - y);
      if (w - radii[i] > 1e-6) cands.push([w - radii[i], i]);
    }
    if (!cands.length) return pts;
    cands.sort((a, b) => a[0] - b[0]);
    const idx = cands[ri(Math.min(6, cands.length))][1];
    const [x, y] = pts[idx];
    const d = [x, y, 1 - x, 1 - y];
    const k = d.indexOf(Math.min(...d));
    const r = radii[idx];
    if (k === 0) pts[idx][0] = r; else if (k === 1) pts[idx][1] = r;
    else if (k === 2) pts[idx][0] = 1 - r; else pts[idx][1] = 1 - r;
    return pts;
  };

  // ---- evolve: snap-chain rounds alternating with Metropolis hop batches ----
  let champC = BESTCFG.map((c) => [c[0], c[1]]);
  let champV = lpRadii(champC).value;
  let best = { centres: champC.map((c) => [...c]), value: champV };
  const trace = [[0, +champV.toFixed(9)]];
  const seenSets = new Set();
  let walker = { centres: champC.map((c) => [...c]), value: champV };
  let round = 0;

  while (Date.now() - t0 < T_MAIN) {
    round++;
    const frac = (Date.now() - t0) / T_MAIN;
    const tau = 25e-6 * Math.pow(0.02, frac) + 0.2e-6;

    if (round % 2 === 0) {
      // snap-chain round from champion
      const { radii } = lpRadii(champC);
      const nears = nearContacts(champC, radii, 150e-6);
      const pool = nears.slice(0, 16).map(([i, j]) => [i, j]);
      const candSets = [];
      for (let a = 0; a < pool.length; a++) for (let b = a + 1; b < pool.length; b++) {
        const key = [...pool[a], ...pool[b]].sort((x, y) => x - y).join(",");
        if (seenSets.has(key)) continue;
        seenSets.add(key);
        candSets.push([pool[a], pool[b]]);
      }
      for (let t = 0; t < 120; t++) {
        const a = ri(pool.length), b = ri(pool.length), c = ri(pool.length);
        if (!pool.length || a === b || a === c || b === c) continue;
        const key = [...pool[a], ...pool[b], ...pool[c]].sort((x, y) => x - y).join(",");
        if (seenSets.has(key)) continue;
        seenSets.add(key);
        candSets.push([pool[a], pool[b], pool[c]]);
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
      // Metropolis hop batch from walker
      for (let h = 0; h < 6; h++) {
        if (Date.now() - t0 > T_MAIN) break;
        const { radii } = lpRadii(walker.centres);
        const mv = ri(4);
        const pts = mv === 0 ? mvRelocate(walker.centres, radii)
          : mv === 1 ? mvRotate(walker.centres)
          : mv === 2 ? mvRoleSwap(walker.centres, radii)
          : mvWallSeed(walker.centres, radii);
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

  const fin = lpPolish(best.centres, Math.min(25000, HARD - (Date.now() - t0) - 2000));
  if (fin.value > best.value) best = fin;

  const { radii } = lpRadii(best.centres);
  const solution = best.centres.map(([x, y], i) => [x, y, radii[i]]);
  return { solution, trace };
};
