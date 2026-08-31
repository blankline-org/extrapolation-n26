// Verify a 26-circle packing under exact floating-point arithmetic.
//
//   node verify.mjs                                   # verifies the published result
//   node verify.mjs pack26-discovery/hyra-n26.json    # verifies any solution file
//
// A solution file is JSON with a `solution` array of 26 [x, y, r] triples in the
// unit square. Constraints: every circle inside [0,1]^2, no two circles overlapping.
// We report the maximum constraint violation. Positive means a violation; negative
// means slack. The candidate program that produced a packing never sees this file.

import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "pack26-discovery/gen3b-best.json";
const doc = JSON.parse(readFileSync(path, "utf8"));
const solution = doc.solution ?? doc;

if (!Array.isArray(solution)) {
  console.error(`${path}: no 'solution' array found`);
  process.exit(1);
}

let sum = 0;
let worst = -Infinity;
let witness = "";

for (const [x, y, r] of solution) {
  sum += r;
  for (const [name, v] of [
    ["left wall", r - x],
    ["bottom wall", r - y],
    ["right wall", x + r - 1],
    ["top wall", y + r - 1],
  ]) {
    if (v > worst) { worst = v; witness = name; }
  }
}

for (let i = 0; i < solution.length; i++) {
  for (let j = i + 1; j < solution.length; j++) {
    const [ax, ay, ar] = solution[i];
    const [bx, by, br] = solution[j];
    const v = ar + br - Math.hypot(ax - bx, ay - by);
    if (v > worst) { worst = v; witness = `overlap ${i}-${j}`; }
  }
}

console.log(`file            ${path}`);
console.log(`circles         ${solution.length}`);
console.log(`sum of radii    ${sum.toFixed(12)}`);
console.log(`max violation   ${worst.toExponential(3)}   (${witness})`);
console.log(`valid @ 1e-9    ${worst < 1e-9 ? "yes" : "NO"}`);
console.log(`valid @ 0       ${worst <= 0 ? "yes" : `no — needs a uniform radius reduction of ~${(worst / 2).toExponential(1)}`}`);

if (doc.score !== undefined) {
  const drift = Math.abs(doc.score - sum);
  console.log(`recorded score  ${doc.score}  (drift ${drift.toExponential(2)})`);
}
