// Exact radii for fixed centres, by linear programming.
//
// The model kept circling this and never implemented it: with the centres held
// fixed, maximising the sum of radii is a LINEAR PROGRAM.
//
//   maximise  sum r_i
//   subject to  r_i + r_j <= d_ij   for every pair
//               r_i <= wall distance
//               r_i >= 0
//
// That matters because the usual "grow every circle to its maximum given the
// others" pass converges to a fixed point that is NOT the LP optimum. The LP is
// allowed to shrink one circle so two others can grow — a trade a greedy pass
// can never make. Every program this project produced used the greedy pass.
//
// Standard-form simplex is enough here: all constraints are <=, all right-hand
// sides are positive (distances and wall clearances), so the origin is feasible
// and we can start from the slack basis with no phase one.

export function lpRadii(centres, { tol = 1e-12 } = {}) {
  const n = centres.length;

  // Build A r <= b.
  const rows = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = centres[i];
    // Four walls, kept as one binding row: r_i <= min(x, y, 1-x, 1-y).
    const w = Math.min(x, y, 1 - x, 1 - y);
    const a = new Float64Array(n);
    a[i] = 1;
    rows.push({ a, b: w });
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = Math.hypot(centres[i][0] - centres[j][0], centres[i][1] - centres[j][1]);
      const a = new Float64Array(n);
      a[i] = 1;
      a[j] = 1;
      rows.push({ a, b: d });
    }
  }

  const m = rows.length;
  // Tableau: m rows x (n + m slacks + 1 rhs), plus an objective row.
  const W = n + m + 1;
  const T = Array.from({ length: m + 1 }, () => new Float64Array(W));
  for (let r = 0; r < m; r++) {
    T[r].set(rows[r].a, 0);
    T[r][n + r] = 1;
    T[r][W - 1] = rows[r].b;
  }
  // Objective: maximise sum r  ->  minimise -sum r. Row holds reduced costs.
  for (let c = 0; c < n; c++) T[m][c] = -1;

  const basis = new Int32Array(m);
  for (let r = 0; r < m; r++) basis[r] = n + r;

  for (let iter = 0; iter < 20000; iter++) {
    // Entering: most negative reduced cost (Dantzig).
    let piv = -1;
    let best = -tol;
    for (let c = 0; c < n + m; c++) {
      if (T[m][c] < best) { best = T[m][c]; piv = c; }
    }
    if (piv === -1) break; // optimal

    // Leaving: min ratio.
    let leave = -1;
    let bestRatio = Infinity;
    for (let r = 0; r < m; r++) {
      const a = T[r][piv];
      if (a > tol) {
        const ratio = T[r][W - 1] / a;
        if (ratio < bestRatio - 1e-15) { bestRatio = ratio; leave = r; }
      }
    }
    if (leave === -1) throw new Error("unbounded — should be impossible here");

    // Pivot.
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

  // Duals, read straight off the objective row.
  //
  // After a standard-form simplex terminates, the reduced cost sitting in the
  // slack column of constraint k IS that constraint's dual price — how much the
  // objective would rise per unit of slack granted. For a pair constraint
  // r_i + r_j <= d_ij that is exactly dF/d(d_ij), and d_ij is a function of the
  // centres. So one LP yields both the value and an EXACT gradient on the
  // centres, with no finite differences: the expensive part of a constrained
  // optimiser, for free.
  const duals = new Float64Array(m);
  for (let k = 0; k < m; k++) duals[k] = T[m][n + k];

  return { radii: Array.from(r), value: r.reduce((a, b) => a + b, 0), duals, meta: { n, m } };
}

/**
 * Exact gradient of the LP value with respect to the centres.
 *
 * Row layout matches lpRadii: the first n rows are wall constraints, the rest
 * are pairs in (i<j) order.
 */
export function centreGradient(centres, duals) {
  const n = centres.length;
  const g = Array.from({ length: n }, () => [0, 0]);

  // Wall rows. r_i <= min(x, y, 1-x, 1-y): only the nearest wall binds, and
  // moving away from it raises the cap one-for-one.
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

  // Pair rows. d(d_ij)/dx_i = (x_i - x_j) / d_ij, and the reverse for j.
  let row = n;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++, row++) {
      const y = duals[row];
      if (y === 0) continue;
      const dx = centres[i][0] - centres[j][0];
      const dy = centres[i][1] - centres[j][1];
      const d = Math.hypot(dx, dy) || 1e-12;
      const ux = dx / d;
      const uy = dy / d;
      g[i][0] += y * ux;
      g[i][1] += y * uy;
      g[j][0] -= y * ux;
      g[j][1] -= y * uy;
    }
  }
  return g;
}
