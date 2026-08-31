// Score a candidate program through the project's own harness (read-only import).
//   node score-cand.mjs cand-gen0.mjs
import { readFileSync } from "node:fs";
import { score } from "file:///C:/Drive/Bankline/self-learning-lab/src/scorer.mjs";
import { getProblem } from "file:///C:/Drive/Bankline/self-learning-lab/src/problems.mjs";

const code = readFileSync(process.argv[2], "utf8");
const problem = getProblem("circle-packing-26");
const res = await score(problem, code);
console.log(JSON.stringify(res, null, 1));
