// Verify a candidate JSON through the PROJECT's own verifier (imported
// read-only — no project files are written). Usage:
//   node verify-theirs.mjs candidate.json
import { readFileSync } from "node:fs";
import { getProblem } from "file:///C:/Drive/Bankline/self-learning-lab/src/problems.mjs";

const cand = JSON.parse(readFileSync(process.argv[2], "utf8"));
const problem = getProblem("circle-packing-26");
const verdict = problem.verify(cand.solution);
console.log(JSON.stringify({ valid: verdict.valid, score: verdict.score, reason: verdict.reason || null }, null, 1));
