// Reproduce the structural claim in §4.1 of the writeup.
//
//   node contact-graph.mjs [tolerance]        # default 1e-7
//
// Two circles are in contact when |d - (ri + rj)| < tol; a circle touches a wall
// when its distance to that wall is within tol. Degree sequences are invariant
// under relabeling, so two packings whose degree sequences differ cannot be
// isomorphic — no relabeling argument can reconcile them.

import { readFileSync } from "node:fs";

const tol = Number(process.argv[2] ?? 1e-7);

const FILES = [
  ["this work (gen3b)", "pack26-discovery/gen3b-best.json"],
  ["memory loop best", "results/best-circle-packing-26.heavy.json"],
  ["Packomania (Haowei Lin)", "pack26-discovery/packomania26.json"],
  ["Hyra full-precision", "pack26-discovery/hyra-n26.json"],
];

function analyse(solution) {
  const n = solution.length;
  const degree = new Array(n).fill(0);
  let edges = 0;
  let wall = 0;

  for (let i = 0; i < n; i++) {
    const [x, y, r] = solution[i];
    for (const gap of [r - x, r - y, x + r - 1, y + r - 1]) {
      if (Math.abs(gap) < tol) wall++;
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const [ax, ay, ar] = solution[i];
      const [bx, by, br] = solution[j];
      if (Math.abs(Math.hypot(ax - bx, ay - by) - (ar + br)) < tol) {
        edges++; degree[i]++; degree[j]++;
      }
    }
  }

  return {
    edges,
    wall,
    degreeSequence: degree.slice().sort((a, b) => a - b).join(""),
    edgeSet: new Set(edgeKeys(solution, tol)),
  };
}

function edgeKeys(solution, t) {
  const keys = [];
  for (let i = 0; i < solution.length; i++) {
    for (let j = i + 1; j < solution.length; j++) {
      const [ax, ay, ar] = solution[i];
      const [bx, by, br] = solution[j];
      if (Math.abs(Math.hypot(ax - bx, ay - by) - (ar + br)) < t) keys.push(`${i}-${j}`);
    }
  }
  return keys;
}

console.log(`contact tolerance ${tol}\n`);
console.log("packing".padEnd(26), "edges".padStart(6), "walls".padStart(6), " degree sequence");

const results = {};
for (const [label, file] of FILES) {
  const { solution } = JSON.parse(readFileSync(file, "utf8"));
  const a = analyse(solution);
  results[label] = a;
  console.log(
    label.padEnd(26),
    String(a.edges).padStart(6),
    String(a.wall).padStart(6),
    ` ${a.degreeSequence}`,
  );
}

const ours = results["this work (gen3b)"];
console.log("\nagainst the record family:");
for (const other of ["Packomania (Haowei Lin)", "Hyra full-precision"]) {
  const them = results[other];
  const shared = [...ours.edgeSet].filter((k) => them.edgeSet.has(k)).length;
  const union = new Set([...ours.edgeSet, ...them.edgeSet]).size;
  const isomorphic = ours.degreeSequence === them.degreeSequence;
  console.log(`  ${other}`);
  console.log(`    index-matched shared edges  ${shared} of ${union}  (Jaccard ${(shared / union).toFixed(3)})`);
  console.log(`    degree sequences equal      ${isomorphic}`);
  console.log(`    -> ${isomorphic ? "may be isomorphic" : "PROVABLY NON-ISOMORPHIC"}`);
}
