// Rewrite a candidate's BESTCFG from a champion json, tolerating a .map suffix.
//   node fix-seed.mjs --cand=cand-gen4.mjs --from=gen3b-champion.json --out=cand-gen5.mjs --seed=5150
import { readFileSync, writeFileSync } from "node:fs";

const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`));
  return h ? h.slice(k.length + 3) : d;
};
const cand = readFileSync(arg("cand", "cand-gen4.mjs"), "utf8");
const champ = JSON.parse(readFileSync(arg("from", "gen3b-champion.json"), "utf8"));
const bestcfg = JSON.stringify(champ.solution.map((c) => [+c[0].toFixed(12), +c[1].toFixed(12), +c[2].toFixed(12)]));
const out = cand
  .replace(/const BESTCFG = \[\[[\s\S]*?\]\](\.map\(\(c\) => \[c\[0\], c\[1\]\]\))?;/, `const BESTCFG = ${bestcfg}.map((c) => [c[0], c[1]]);`)
  .replace(/let seed = \d+;/, `let seed = ${arg("seed", "5150")};`);
if (!out.includes(bestcfg.slice(0, 60))) throw new Error("BESTCFG replace failed");
writeFileSync(arg("out", "cand-gen5.mjs"), out);
console.log(`wrote ${arg("out", "cand-gen5.mjs")} seeded from ${arg("from")} (${champ.score})`);
