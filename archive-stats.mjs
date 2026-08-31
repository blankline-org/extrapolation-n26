// Reproduce §5 of the writeup: what the 91-attempt archive shows.
//
//   node archive-stats.mjs
//
// Each archived attempt carries the model's own structured analysis
// (DIAGNOSIS / TECHNIQUE / PLAN / AVOID / SELF-CHECK) alongside the verified
// score, the failure reason, and a timestamp. The AVOID blocks let us check a
// claim the model makes about its own history against the record of that history.

import { readFileSync } from "node:fs";

const { attempts } = JSON.parse(
  readFileSync("results/archive-circle-packing-26.heavy.json", "utf8"),
);

const valid = attempts.filter((a) => a.valid);
const invalid = attempts.filter((a) => !a.valid);
const hours = (attempts.at(-1).ts - attempts[0].ts) / 3_600_000;

console.log("=== the run ===");
console.log(`attempts        ${attempts.length}`);
console.log(`wall clock      ${hours.toFixed(1)} h`);
console.log(`valid           ${valid.length}`);
console.log(`invalid         ${invalid.length}  (all scoring zero: ${invalid.every((a) => a.score === 0)})`);

let best = 0;
const curve = [];
attempts.forEach((a, i) => {
  if (a.score > best) { best = a.score; curve.push([i + 1, a.score]); }
});
console.log(`improvements    ${curve.length} to best-so-far`);
console.log(`final best      ${best.toFixed(12)}`);

const largestAfter = (start) => curve.reduce((m, p, i) => {
  if (i === 0 || p[0] < start) return m;
  const d = p[1] - curve[i - 1][1];
  return d > m.d ? { d, at: p[0], from: curve[i - 1][1], to: p[1] } : m;
}, { d: 0 });

const early = largestAfter(0);
const late = largestAfter(50);
console.log(`largest step    +${early.d.toExponential(3)} at #${early.at}  (${early.from.toFixed(6)} -> ${early.to.toFixed(6)})`);
console.log(`largest late    +${late.d.toExponential(3)} at #${late.at}  (${late.from.toFixed(6)} -> ${late.to.toFixed(6)})   <- leaves the basin`);

// --- AVOID blocks -----------------------------------------------------------
const avoid = attempts
  .map((a, i) => [i + 1, String(a.analysis ?? "")])
  .filter(([, t]) => /AVOID/i.test(t))
  .map(([i, t]) => {
    const m = t.match(/AVOID:?([\s\S]*?)(?=\n[A-Z][A-Z -]{3,}:|$)/);
    return [i, m ? m[1].trim() : ""];
  });

console.log("\n=== self-report (§5.1) ===");
console.log(`attempts with an AVOID block   ${avoid.length}`);
console.log(`block length, first five       ${avoid.slice(0, 5).map(([, t]) => t.length).join(", ")}`);
console.log(`block length, last five        ${avoid.slice(-5).map(([, t]) => t.length).join(", ")}`);

// Cross-check the four failure classes cited in the final AVOID block.
const reasonOf = (a) => String(a.reason ?? "");
const where = (pred) => attempts.map((a, i) => [i + 1, a]).filter(([, a]) => pred(a)).map(([i]) => i);

const syntax = where((a) => /import:Unexpected|syntax error/i.test(reasonOf(a)));
const importStage = where((a) => /^import:/i.test(reasonOf(a)));
const constThrow = where((a) => /constant variable/i.test(reasonOf(a)));
const overrun = where((a) => /past the .* limit|timeout/i.test(reasonOf(a)));
const lattice = attempts.map((a, i) => [i + 1, a]).filter(([, a]) => (a.tags ?? []).includes("lattice-init"));

console.log("\nclaims in the final AVOID block, checked against the archive:");
const parseStage = [...new Set([...syntax, ...importStage])].sort((a, b) => a - b);
console.log(`  "the 7 syntax-error cutoffs"      -> ${syntax.length} at #${syntax.join(", #")}`);
console.log(`     ${parseStage.length} attempts failed before execution; the model's count of ${syntax.length} correctly`);
console.log(`     excludes #${parseStage.filter((i) => !syntax.includes(i)).join(", #")} (a ReferenceError, not a syntax error)`);
console.log(`  "const-reassignment throws"       -> ${constThrow.length} at #${constThrow.join(", #")}`);
console.log(`  "lattice-init's invalid finals"   -> ${lattice.length} tagged, ${lattice.filter(([, a]) => !a.valid).length} invalid, at #${lattice.map(([i]) => i).join(", #")}`);
console.log(`  "running past the limit"          -> ${overrun.length} at #${overrun.join(", #")}`);

// --- failure modes over time ------------------------------------------------
console.log("\n=== failures do not monotonically decrease (§5.2) ===");
console.log(`invalid attempts at   #${invalid.map((a) => attempts.indexOf(a) + 1).join(", #")}`);
const lastBad = attempts.indexOf(invalid.at(-1)) + 1;
console.log(`last invalid at       #${lastBad} of ${attempts.length}  -> clean tail of ${attempts.length - lastBad}`);
console.log("\nfailure reasons in order:");
for (const a of invalid) {
  console.log(`  #${String(attempts.indexOf(a) + 1).padStart(2)}  ${reasonOf(a).slice(0, 60)}`);
}
