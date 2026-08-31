// Generate the next candidate from a scored result + a template candidate.
//   node gen-next.mjs --from=gen0b.result.json --template=cand-gen0.mjs --out=cand-gen1.mjs --seed=555777 --hopbatch=6
import { readFileSync, writeFileSync } from "node:fs";

const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`));
  return h ? h.slice(k.length + 3) : d;
};
const FROM = arg("from", "gen0b.result.json");
const TEMPLATE = arg("template", "cand-gen0.mjs");
const OUT = arg("out", "cand-gen1.mjs");
const SEED = arg("seed", String(100000 + Math.floor(Math.random() * 900000)));
const HOPBATCH = arg("hopbatch", "6");

const buf = readFileSync(FROM);
const text = buf[0] === 0xff && buf[1] === 0xfe ? buf.subarray(2).toString("utf16le") : buf.toString("utf8");
const res = JSON.parse(text);
if (!res.valid || !Array.isArray(res.solution)) throw new Error(`${FROM} has no valid solution`);
const sol = res.solution;
const bestcfg = JSON.stringify(sol.map((c) => [+c[0].toFixed(12), +c[1].toFixed(12), +c[2].toFixed(12)]));

let code = readFileSync(TEMPLATE, "utf8");
code = code.replace(/const BESTCFG = \[\[.*?\]\];/s, `const BESTCFG = ${bestcfg};`);
code = code.replace(/let seed = \d+;/, `let seed = ${SEED};`);
code = code.replace(/h < 4/, `h < ${HOPBATCH}`);
if (!code.includes(`let seed = ${SEED};`)) throw new Error("seed replace failed");
if (!code.includes(`const BESTCFG = ${bestcfg.slice(0, 40)}`)) throw new Error("BESTCFG replace failed");

writeFileSync(OUT, code);
// also persist the parent solution as standalone json
writeFileSync(OUT.replace(/cand-(gen\w+)\.mjs/, "$1-parent.json"), JSON.stringify({ score: res.score, solution: sol }, null, 1));
console.log(`wrote ${OUT}  (parent ${FROM} score ${res.score}, seed ${SEED}, hopbatch ${HOPBATCH})`);
