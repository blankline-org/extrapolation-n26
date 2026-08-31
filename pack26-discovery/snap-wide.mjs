// Wide-window snap surgery on the record structure. The record graph has no
// near-contacts within 2e-3, so this scans the closest non-binding pairs up to
// 8e-3 slack: singles, pairs among the closest 12, and collective snaps of the
// closest K (the move that won on the old basin).
import { readFileSync, writeFileSync } from "node:fs";
import { lpRadii, centreGradient } from "./lp-radii.mjs";

const RECORD = 2.635983084918;
const N = 26;
const champ = JSON.parse(readFileSync("pack-polished.json", "utf8"));
const C0 = champ.solution.map((c) => [c[0], c[1]]);
const base = lpRadii(C0);
console.log(`start ${base.value.toFixed(12)}  (${((base.value - RECORD) * 1e6).toFixed(3)} micro vs record)\n`);

function lpPolish(centres, budgetMs) {
  let cur = centres.map((c) => [...c]);
  let out = lpRadii(cur);
  let val = out.value, duals = out.duals;
  let step = 8e-4;
  const t0 = Date.now();
  while (Date.now() - t0 < budgetMs && step > 1e-11) {
    const g = centreGradient(cur, duals);
    const trial = cur.map((c, i) => [
      Math.min(0.999999, Math.max(1e-6, c[0] + step * g[i][0])),
      Math.min(0.999999, Math.max(1e-6, c[1] + step * g[i][1])),
    ]);
    const o2 = lpRadii(trial);
    if (o2.value > val + 1e-13) {
      cur = trial; val = o2.value; duals = o2.duals; step *= 1.25;
    } else step *= 0.5;
  }
  return { centres: cur, value: val };
}

function snap(centres, radii, pairs) {
  const out = centres.map((c) => [...c]);
  for (const [i, j] of pairs) {
    const dx = out[j][0] - out[i][0], dy = out[j][1] - out[i][1];
    const d = Math.hypot(dx, dy);
    const target = (radii[i] + radii[j]) * (1 - 1e-6);
    const move = (d - target) / 2;
    if (move <= 0) continue;
    const ux = dx / d, uy = dy / d;
    out[i][0] += ux * move; out[i][1] += uy * move;
    out[j][0] -= ux * move; out[j][1] -= uy * move;
  }
  return out;
}

// closest non-binding pairs
const R = base.radii;
const nears = [];
for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
  const d = Math.hypot(C0[i][0] - C0[j][0], C0[i][1] - C0[j][1]);
  const gap = d - R[i] - R[j];
  if (gap > 1e-9) nears.push([i, j, gap]);
}
nears.sort((a, b) => a[2] - b[2]);
console.log("closest non-binding pairs:");
for (const [i, j, g] of nears.slice(0, 14)) {
  console.log(`  ${String(i).padStart(2)}-${String(j).padStart(2)}  slack ${(g * 1e6).toFixed(1)}u`);
}
console.log();

const pool = nears.filter(([, , g]) => g < 8e-3).slice(0, 14).map(([i, j]) => [i, j]);
const results = [];
let best = { value: base.value, tag: "start", centres: null };

function trial(tag, pairs) {
  const p = lpPolish(snap(C0, R, pairs), 3000);
  const d = (p.value - base.value) * 1e6;
  results.push({ tag, value: p.value, delta: d });
  const mark = p.value > RECORD ? "  <<< BEATS RECORD" : p.value > base.value + 1e-12 ? "  <<< beats vertex" : "";
  console.log(`${tag.padEnd(30)} ${p.value.toFixed(12)}  ${d >= 0 ? "+" : ""}${d.toFixed(3)} micro${mark}`);
  if (p.value > best.value + 1e-12) best = { value: p.value, tag, centres: p.centres };
}

for (const [i, j] of pool) trial(`snap ${i}-${j}`, [[i, j]]);
for (let a = 0; a < Math.min(12, pool.length); a++)
  for (let b = a + 1; b < Math.min(12, pool.length); b++)
    trial(`snap ${pool[a][0]}-${pool[a][1]} + ${pool[b][0]}-${pool[b][1]}`, [pool[a], pool[b]]);
for (let k = 2; k <= Math.min(5, pool.length); k++) trial(`collective top ${k}`, pool.slice(0, k));

console.log("\n=== top 8 ===");
results.sort((a, b) => b.value - a.value);
for (const r of results.slice(0, 8)) {
  console.log(`${r.tag.padEnd(30)} ${r.value.toFixed(12)}  ${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(3)} micro`);
}
if (best.centres) {
  const { radii } = lpRadii(best.centres);
  const solution = best.centres.map(([x, y], i) => [x, y, radii[i]]);
  writeFileSync("wide-best.json", JSON.stringify({ score: best.value, tag: best.tag, solution }, null, 1));
  console.log(`\nwrote wide-best.json (${best.tag})`);
} else console.log("\nno surgery beat the record vertex");
