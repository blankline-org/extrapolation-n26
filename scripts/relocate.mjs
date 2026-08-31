// Structural moves: relocate a circle, then re-solve exactly.
//
// Gradient ascent proved the incumbent is a true local optimum — the analytic
// gradient matches the finite difference exactly along -g, and no direction
// improves. The objective is piecewise linear in the centres and we sit on a
// vertex of it, so no continuous move escapes.
//
// What is left is combinatorial: change WHICH circles touch which. The cheapest
// such move is to pull one circle out and drop it somewhere else, which
// rewrites the contact graph in one step. With an exact 33ms LP for the radii,
// thousands of these can be tried and scored properly rather than guessed at.
//
//   node scripts/relocate.mjs --seconds=300

import { readFileSync, writeFileSync } from "node:fs";
import { lpRadii } from "./lp-radii.mjs";

const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`));
  return h ? h.slice(k.length + 3) : d;
};
const SECONDS = Number(arg("seconds", "300"));
const RECORD = 2.635983084918;

const best = JSON.parse(readFileSync("results/best-circle-packing-26.heavy.json", "utf8"));
const n = best.solution.length;
let bestCentres = best.solution.map((c) => [c[0], c[1]]);
let bestValue = lpRadii(bestCentres).value;

console.log(`start   ${bestValue.toFixed(12)}`);
console.log(`record  ${RECORD.toFixed(12)}`);
console.log(`need    ${((RECORD - bestValue) * 1e6).toFixed(2)} micro-units\n`);

// Local polish after a structural move: coordinate-wise nudges, kept only when
// the exact LP value improves. Deliberately simple — the LP is the expensive
// and the accurate part, so the search around it can be crude.
function polish(centres, rounds = 60) {
  let cur = centres.map((c) => [...c]);
  let val = lpRadii(cur).value;
  let step = 3e-3;
  for (let r = 0; r < rounds && step > 1e-9; r++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const trial = cur.map((c) => [...c]);
        trial[i][0] = Math.min(0.999999, Math.max(1e-6, trial[i][0] + dx * step));
        trial[i][1] = Math.min(0.999999, Math.max(1e-6, trial[i][1] + dy * step));
        const v = lpRadii(trial).value;
        if (v > val + 1e-14) { cur = trial; val = v; moved = true; }
      }
    }
    if (!moved) step *= 0.5;
  }
  return { centres: cur, value: val };
}

function violation(centres, radii) {
  let worst = 0;
  for (let i = 0; i < n; i++) {
    const [x, y] = centres[i];
    worst = Math.max(worst, radii[i] - x, radii[i] - y, radii[i] - (1 - x), radii[i] - (1 - y));
    for (let j = i + 1; j < n; j++) {
      worst = Math.max(worst, radii[i] + radii[j] - Math.hypot(x - centres[j][0], y - centres[j][1]));
    }
  }
  return worst;
}

const t0 = Date.now();
let tried = 0;
let improvements = 0;

while (Date.now() - t0 < SECONDS * 1000) {
  const { radii } = lpRadii(bestCentres);

  // Move the circle with the least to lose. Weighted toward the smallest radii:
  // a large circle is load-bearing and displacing it usually collapses the
  // packing, while a small one is often wedged in a gap that a different gap
  // would suit better.
  const order = radii.map((r, i) => [r, i]).sort((a, b) => a[0] - b[0]);
  const pick = order[Math.floor(Math.random() ** 2 * Math.min(8, n))][1];

  // Land it somewhere with real clearance rather than at random: sample points
  // and keep the one furthest from every other circle's surface.
  let target = null;
  let bestClear = -1;
  for (let s = 0; s < 400; s++) {
    const x = 0.02 + Math.random() * 0.96;
    const y = 0.02 + Math.random() * 0.96;
    let clear = Math.min(x, y, 1 - x, 1 - y);
    for (let j = 0; j < n; j++) {
      if (j === pick) continue;
      clear = Math.min(clear, Math.hypot(x - bestCentres[j][0], y - bestCentres[j][1]) - radii[j]);
    }
    if (clear > bestClear) { bestClear = clear; target = [x, y]; }
  }

  const moved = bestCentres.map((c) => [...c]);
  moved[pick] = target;

  const out = polish(moved);
  tried++;

  if (out.value > bestValue + 1e-13) {
    const { radii: rr } = lpRadii(out.centres);
    const viol = violation(out.centres, rr);
    if (viol <= 1e-9) {
      improvements++;
      console.log(
        `move ${String(tried).padStart(4)}  circle ${String(pick).padStart(2)} -> gap  ` +
          `${out.value.toFixed(12)}  (+${((out.value - bestValue) * 1e6).toFixed(3)} micro)  viol ${viol.toExponential(1)}`
      );
      bestValue = out.value;
      bestCentres = out.centres;
    }
  }
  if (tried % 25 === 0) {
    console.log(`  ...${tried} moves, ${improvements} improvements, best ${bestValue.toFixed(12)}, ${Math.round((Date.now() - t0) / 1000)}s`);
  }
}

console.log(`\ntried          ${tried} structural moves`);
console.log(`best           ${bestValue.toFixed(12)}`);
console.log(`vs start       ${((bestValue - best.score) * 1e6).toFixed(3)} micro-units`);
console.log(`vs record      ${((bestValue - RECORD) * 1e6).toFixed(3)} micro-units`);

if (bestValue > best.score + 1e-12) {
  const { radii } = lpRadii(bestCentres);
  const solution = bestCentres.map(([x, y], i) => [x, y, radii[i]]);
  writeFileSync("results/relocate-candidate.json", JSON.stringify({ score: bestValue, solution }, null, 1));
  console.log(`\nwrote results/relocate-candidate.json — verify before believing`);
}
