// Hard LP-gradient polish of a seed's centres, then exact radii.
//   node polish-seed.mjs --in=ce-seed.json --out=ce-polished.json --seconds=90
import { readFileSync, writeFileSync } from "node:fs";
import { lpRadii, centreGradient } from "./lp-radii.mjs";

const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`));
  return h ? h.slice(k.length + 3) : d;
};
const IN = arg("in", "ce-seed.json");
const OUT = arg("out", "ce-polished.json");
const SECONDS = Number(arg("seconds", "90"));
const RECORD = 2.635983084918;

let cur = JSON.parse(readFileSync(IN, "utf8")).solution.map((c) => [c[0], c[1]]);
let out = lpRadii(cur);
let val = out.value, duals = out.duals;
console.log(`start ${val.toFixed(12)}  (${((val - RECORD) * 1e6).toFixed(3)} micro vs record)`);

let step = 3e-5;
const t0 = Date.now();
let iters = 0;
while (Date.now() - t0 < SECONDS * 1000 && step > 1e-12) {
  const g = centreGradient(cur, duals);
  const trial = cur.map((c, i) => [
    Math.min(0.9999999, Math.max(1e-7, c[0] + step * g[i][0])),
    Math.min(0.9999999, Math.max(1e-7, c[1] + step * g[i][1])),
  ]);
  const o2 = lpRadii(trial);
  iters++;
  if (o2.value > val + 1e-14) {
    cur = trial; val = o2.value; duals = o2.duals; step *= 1.2;
    if (iters % 25 === 0) console.log(`  ${val.toFixed(12)}  (${((val - RECORD) * 1e6 >= 0 ? "+" : "") + ((val - RECORD) * 1e6).toFixed(3)} micro)  step ${step.toExponential(1)}  ${Math.round((Date.now() - t0) / 1000)}s`);
  } else step *= 0.5;
}

const { radii } = lpRadii(cur);
const solution = cur.map(([x, y], i) => [x, y, radii[i]]);
writeFileSync(OUT, JSON.stringify({ score: val, source: "CE-seed centres + exact LP-gradient polish (ours)", solution }, null, 1));
console.log(`\nfinal ${val.toFixed(12)}  (${((val - RECORD) * 1e6 >= 0 ? "+" : "")}${((val - RECORD) * 1e6).toFixed(3)} micro vs record)`);
console.log(`wrote ${OUT}`);
