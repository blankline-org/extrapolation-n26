// Structural autopsy of the incumbent: contact graph, dual prices, slack map.
import { readFileSync } from "node:fs";
import { lpRadii } from "./lp-radii.mjs";

const inc = JSON.parse(readFileSync("incumbent.json", "utf8"));
const C = inc.solution.map((c) => [c[0], c[1]]);
const N = C.length;
const { radii: R, value, duals } = lpRadii(C);

console.log(`value ${value.toFixed(12)}\n`);

// Wall contacts and pair contacts
const wallName = ["left(x=0)", "bottom(y=0)", "right(x=1)", "top(y=1)"];
const deg = new Array(N).fill(0);
const contacts = [];
console.log("WALL CONTACTS (r_i vs clearance, slack < 1e-6 = binding):");
for (let i = 0; i < N; i++) {
  const [x, y] = C[i];
  const w = [x, y, 1 - x, 1 - y];
  const k = w.indexOf(Math.min(...w));
  const slack = w[k] - R[i];
  const dual = duals[i];
  if (slack < 1e-6) {
    console.log(`  c${String(i).padStart(2)} touches ${wallName[k].padEnd(12)} r=${R[i].toFixed(6)} dual=${dual.toFixed(6)}`);
    deg[i]++;
  }
}

console.log("\nPAIR CONTACTS sorted by dual price (gap < 1e-6 = binding):");
let row = N;
for (let i = 0; i < N; i++) {
  for (let j = i + 1; j < N; j++, row++) {
    const d = Math.hypot(C[i][0] - C[j][0], C[i][1] - C[j][1]);
    const gap = d - R[i] - R[j];
    if (gap < 1e-6) {
      contacts.push({ i, j, gap, dual: duals[row] });
      deg[i]++; deg[j]++;
    }
  }
}
contacts.sort((a, b) => b.dual - a.dual);
for (const c of contacts) {
  console.log(`  c${String(c.i).padStart(2)}-c${String(c.j).padStart(2)}  r=(${R[c.i].toFixed(5)},${R[c.j].toFixed(5)})  dual=${c.dual.toFixed(6)}`);
}

console.log("\nNEAR-CONTACTS (slack 1e-6..0.012 — flippable edges):");
const nears = [];
row = N;
for (let i = 0; i < N; i++) {
  for (let j = i + 1; j < N; j++, row++) {
    const d = Math.hypot(C[i][0] - C[j][0], C[i][1] - C[j][1]);
    const gap = d - R[i] - R[j];
    if (gap >= 1e-6 && gap < 0.012) nears.push({ i, j, gap });
  }
}
nears.sort((a, b) => a.gap - b.gap);
for (const c of nears.slice(0, 20)) {
  console.log(`  c${String(c.i).padStart(2)}-c${String(c.j).padStart(2)}  slack=${(c.gap * 1000).toFixed(3)}e-3  r=(${R[c.i].toFixed(5)},${R[c.j].toFixed(5)})`);
}

console.log("\nDEGREES (contact count per circle):");
for (let i = 0; i < N; i++) {
  console.log(`  c${String(i).padStart(2)}  r=${R[i].toFixed(6)}  deg=${deg[i]}  pos=(${C[i][0].toFixed(4)},${C[i][1].toFixed(4)})`);
}

// Contact-graph rigidity: a rigid packing of N circles needs ~2N+1 contacts
// (counting wall contacts). Print summary.
const totalContacts = contacts.length;
const wallContacts = deg.reduce((a, b) => a, 0) - 2 * totalContacts;
console.log(`\nsummary: ${totalContacts} pair contacts + ${wallContacts} wall contacts = ${totalContacts * 2 + wallContacts} constraints on ${2 * N} centre DOF`);
