// Autopsy any candidate file: contacts, duals, near-contacts with wide window.
//   node analyze2.mjs ce-polished.json
import { readFileSync } from "node:fs";
import { lpRadii } from "./lp-radii.mjs";

const f = process.argv[2] || "ce-polished.json";
const cand = JSON.parse(readFileSync(f, "utf8"));
const C = cand.solution.map((c) => [c[0], c[1]]);
const N = C.length;
const { radii: R, value, duals } = lpRadii(C);
console.log(`${f}: LP value ${value.toFixed(12)}\n`);

let nWall = 0, nPair = 0, dualZeroPairs = 0, dualZeroWalls = 0;
for (let i = 0; i < N; i++) {
  const [x, y] = C[i];
  const w = Math.min(x, y, 1 - x, 1 - y);
  if (w - R[i] < 1e-6) { nWall++; if (duals[i] < 1e-9) dualZeroWalls++; }
}
const near = [];
let row = N;
for (let i = 0; i < N; i++) {
  for (let j = i + 1; j < N; j++, row++) {
    const d = Math.hypot(C[i][0] - C[j][0], C[i][1] - C[j][1]);
    const gap = d - R[i] - R[j];
    if (gap < 1e-6) { nPair++; if (duals[row] < 1e-9) dualZeroPairs++; }
    else if (gap < 2e-3) near.push([i, j, gap]);
  }
}
near.sort((a, b) => a[2] - b[2]);
console.log(`binding: ${nPair} pair contacts (${dualZeroPairs} with zero dual) + ${nWall} wall contacts (${dualZeroWalls} zero dual) = ${nPair + nWall} constraints on ${2 * N} centre DOF`);
console.log(`\nnear-contacts within 2e-3 (${near.length}):`);
for (const [i, j, g] of near.slice(0, 30)) {
  console.log(`  ${String(i).padStart(2)}-${String(j).padStart(2)}  slack ${(g * 1e6).toFixed(1)}u  r=(${R[i].toFixed(5)},${R[j].toFixed(5)})`);
}
