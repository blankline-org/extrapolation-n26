// Scored problems for the evolutionary loop.
//
// Different in kind from tasks.mjs. A task is graded pass/fail, which is enough
// to teach a convention but useless for search: evolution needs a gradient to
// climb. Every problem here returns a REAL NUMBER, and the verifier is exact
// arithmetic the candidate program never gets to see or influence.
//
// The verifier is the whole point. It is the only part of the system that does
// not carry a human prior about what good code looks like, which is the only
// reason a result nobody expected can survive being checked.

// ---------------------------------------------------------------------------
// Circle packing: n non-overlapping circles in the unit square, maximise the
// sum of the radii. Chosen as the calibration problem because the record is
// public and contested, so "did we actually find something" is not a matter of
// opinion:
//
//   2.634        Friedman 2012
//   2.63586276   AlphaEvolve (DeepMind, 2025)
//   2.635983283  ShinkaEvolve (Sakana, 2025)  <- current best known
//
// Tolerance note: published pipelines differ (OpenEvolve atol=1e-6, Shinka
// 1e-7, AlphaEvolve zero). We use 1e-9, i.e. effectively zero plus float slop.
// A looser tolerance silently buys you score by letting circles overlap, and a
// record that only exists at atol=1e-6 is not a record.
// ---------------------------------------------------------------------------

const EPS = 1e-9;

/**
 * Pull an optional search trace off the result.
 *
 * A candidate may return either a bare array of circles, or
 * `{ solution, trace }` where trace is a list of `[secondsElapsed, bestScore]`
 * checkpoints. The trace is what makes the INNER search visible: without it the
 * model sees only a final score and cannot tell an optimiser that climbed for
 * 300 seconds from one that finished in 4 and idled for 296.
 */
function unwrap(result) {
  if (result && !Array.isArray(result) && Array.isArray(result.solution)) {
    return { solution: result.solution, trace: Array.isArray(result.trace) ? result.trace : null };
  }
  return { solution: result, trace: null };
}

function verifyCirclePacking(raw, { n }) {
  const { solution: result, trace } = unwrap(raw);
  if (!Array.isArray(result)) return { valid: false, score: 0, reason: "not an array" };
  if (result.length !== n) return { valid: false, score: 0, reason: `expected ${n} circles, got ${result.length}` };

  const circles = [];
  for (let i = 0; i < result.length; i++) {
    const c = result[i];
    const x = Array.isArray(c) ? c[0] : c?.x;
    const y = Array.isArray(c) ? c[1] : c?.y;
    const r = Array.isArray(c) ? c[2] : c?.r;
    if (![x, y, r].every((v) => typeof v === "number" && Number.isFinite(v)))
      return { valid: false, score: 0, reason: `circle ${i} is not three finite numbers` };
    if (r <= 0) return { valid: false, score: 0, reason: `circle ${i} has radius <= 0` };
    circles.push({ x, y, r });
  }

  // Survey ALL violations before returning, rather than bailing on the first.
  //
  // "circle 25 escapes the unit square" is a symptom; whether that is one stray
  // circle or twenty, and whether it misses by 1e-7 or by 0.05, are completely
  // different bugs with completely different fixes. Returning on the first
  // violation gave the model a single symptom at exactly the moment it needed a
  // diagnosis, which is why so many scratchpad rounds guessed wrong.
  const escapes = [];
  for (let i = 0; i < circles.length; i++) {
    const { x, y, r } = circles[i];
    const worst = Math.min(x - r, 1 - x - r, y - r, 1 - y - r);
    if (worst < -EPS) escapes.push({ i, by: -worst });
  }

  const overlaps = [];
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const gap = Math.hypot(circles[i].x - circles[j].x, circles[i].y - circles[j].y) - circles[i].r - circles[j].r;
      if (gap < -EPS) overlaps.push({ i, j, by: -gap });
    }
  }

  if (escapes.length || overlaps.length) {
    escapes.sort((a, b) => b.by - a.by);
    overlaps.sort((a, b) => b.by - a.by);
    const parts = [];
    if (escapes.length)
      parts.push(
        `${escapes.length} circle(s) escape the square, worst circle ${escapes[0].i} by ${escapes[0].by.toExponential(2)}`
      );
    if (overlaps.length)
      parts.push(
        `${overlaps.length} overlapping pair(s), worst ${overlaps[0].i}+${overlaps[0].j} by ${overlaps[0].by.toExponential(2)}`
      );
    const near = Math.max(...escapes.map((e) => e.by), ...overlaps.map((o) => o.by), 0) < 1e-4;
    return {
      valid: false,
      trace,
      score: 0,
      reason: parts.join("; "),
      // A near-miss and a structural failure need opposite responses: the first
      // wants a slightly larger safety margin, the second wants a different
      // layout. Say which it is rather than making the model infer it.
      hint: near
        ? "All violations are tiny — this is a margin problem, not a layout problem. Shrink the offending radii by ~1e-9 in a final repair pass rather than redesigning."
        : "The violations are large — the layout itself is wrong, not just the margins. A bigger safety margin will not fix this.",
      sumIfValid: circles.reduce((s, c) => s + c.r, 0)
    };
  }

  // Diagnostics from the candidate's OWN output.
  //
  // A verdict alone ("circles 5 and 21 overlap") tells the model its code broke
  // but not what its code actually did, so a scratchpad round becomes guesswork.
  // Slack is the useful signal here: a circle that touches nothing has room to
  // grow, so lots of slack means the optimiser never converged rather than that
  // the layout is wrong.
  const radii = circles.map((c) => c.r);
  let touchingWall = 0;
  let looseCircles = 0;
  let minPairGap = Infinity;
  for (let i = 0; i < circles.length; i++) {
    const { x, y, r } = circles[i];
    const wallGap = Math.min(x - r, 1 - x - r, y - r, 1 - y - r);
    if (wallGap < 1e-6) touchingWall++;
    let nearest = wallGap;
    for (let j = 0; j < circles.length; j++) {
      if (i === j) continue;
      const gap = Math.hypot(circles[i].x - circles[j].x, circles[i].y - circles[j].y) - r - circles[j].r;
      nearest = Math.min(nearest, gap);
      if (j > i) minPairGap = Math.min(minPairGap, gap);
    }
    if (nearest > 1e-4) looseCircles++;
  }

  return {
    valid: true,
    trace,
    score: circles.reduce((s, c) => s + c.r, 0),
    diagnostics: {
      radiusMin: Math.min(...radii),
      radiusMax: Math.max(...radii),
      radiusMean: radii.reduce((a, b) => a + b, 0) / radii.length,
      distinctRadii: new Set(radii.map((r) => r.toFixed(6))).size,
      touchingWall,
      looseCircles,
      minPairGap: minPairGap === Infinity ? null : minPairGap
    },
    // Returned so the search can seed the next candidate from the best packing
    // found so far. Without this every program restarts from its own random
    // seeds and nothing ratchets: measured, a parent scoring 2.5556 produced
    // children at 0.92 / 1.14 / 2.17 purely from reseeding luck.
    solution: circles.map((c) => [c.x, c.y, c.r])
  };
}

// Provided knowledge, kept in its own channel.
//
// This is published domain knowledge about THIS problem: how other systems
// reached the frontier. It is handed over, not discovered, so it must never be
// distilled into the cross-problem tactic store — otherwise the transfer
// experiment measures what we injected rather than what the loop learned.
// MemoryDistiller is told explicitly to ignore anything traceable here.
const CIRCLE_PACKING_SKILLS = [
  {
    source: "AlphaEvolve (DeepMind, 2025) — reached 2.63586276",
    lesson:
      "Purely geometric constructions plateau. Their evolution went concentric rings (1.87) -> " +
      "hexagonal arrangement (2.18) -> staggered grid (2.32) and stalled there. The jump to 2.635 " +
      "came from ABANDONING hand-built geometry and reformulating the whole thing as a constrained " +
      "optimisation problem solved numerically: variables are the 3n coordinates, constraints are " +
      "the containment and pairwise-overlap inequalities, objective is the sum of radii. " +
      "Their final program combined a golden-angle spiral initialisation with deliberate corner and " +
      "edge placement, SLSQP gradient refinement for local polish, simulated annealing for global " +
      "escape, and perturbation that alternated between moving individual circles and ROTATING " +
      "WHOLE RINGS of circles."
  },
  {
    source: "ShinkaEvolve (Sakana, 2025) — reached 2.635983283 in ~150 attempts",
    lesson:
      "They changed the search, not the geometry. Their decisive ablation was novelty rejection: " +
      "refusing to evaluate a candidate that is only a minor variation of something already tried. " +
      "The practical lesson for a single attempt is the same — if your program is structurally the " +
      "same as one already in the log, it will score the same. Make it different or do not bother."
  },
  {
    source: "Independent result (2025) — reached 2.63592717",
    lesson:
      "Beat AlphaEvolve with an arrangement described as 'completely different' from both Google's " +
      "and FICO's solutions. The configuration space is NOT exhausted: a structurally novel layout " +
      "still beat the best tuned version of the conventional one. Do not assume the known family of " +
      "packings is the only one."
  },
  {
    source: "Constraint of this harness",
    lesson:
      "You have no scipy, no numpy, no imports — pure JavaScript. The SLSQP that carried AlphaEvolve " +
      "past the plateau is not available to you, so you must implement the equivalent yourself: " +
      "projected gradient ascent on the radii with active-set handling, or an augmented-Lagrangian " +
      "penalty method, or repeated 'grow every radius until something touches, then nudge centres " +
      "apart' sweeps. This is the single biggest lever you have."
  }
];

const circlePacking = (n, records) => ({
  id: `circle-packing-${n}`,
  label: `Circle packing n=${n} (maximise sum of radii in the unit square)`,
  // Higher is better. Everything in the loop assumes maximisation.
  direction: "max",
  records,
  best: Math.max(...Object.values(records)),
  params: { n },
  skills: CIRCLE_PACKING_SKILLS,
  // 600s. Twice OpenEvolve's default, and deliberately so.
  //
  // Was 30s originally, which was the single biggest self-inflicted handicap:
  // circle packing at the frontier is won by grinding a numerical optimiser
  // from many starting points, not by writing clever code. Raising it to 300s
  // took the best from 2.589 to 2.626, and candidates then started using
  // essentially the whole budget — one ran 228 of its 300 seconds. A program
  // still improving when it is killed is being cut off, not finishing, so the
  // ceiling goes up again.
  runTimeoutMs: 600000,
  brief:
    `Write a JavaScript function that packs ${n} non-overlapping circles into the unit square [0,1]x[0,1] ` +
    `and MAXIMISES the sum of their radii.\n\n` +
    `Return an array of exactly ${n} entries, each \`[x, y, r]\`, where (x,y) is the centre and r the radius.\n` +
    `Hard constraints, checked exactly (tolerance 1e-9):\n` +
    `  - every circle lies fully inside the unit square: x-r >= 0, x+r <= 1, y-r >= 0, y+r <= 1\n` +
    `  - no two circles overlap: dist(c_i, c_j) >= r_i + r_j\n` +
    `  - every radius is strictly positive\n` +
    `Any violation scores ZERO, so leave a safety margin of ~1e-9 rather than sitting exactly on a bound.\n` +
    // Observed first failure mode: a good layout rejected for a hairline
    // overlap. An optimiser that ends on a repair pass converts those near
    // misses into scores instead of zeros, which matters more than layout
    // quality when most candidates die on validity.
    `END WITH A REPAIR PASS: before returning, verify every constraint yourself and shrink the ` +
    `offending radii until all of them hold. A slightly smaller valid packing scores; an ` +
    `optimal invalid one scores nothing.\n\n` +
    // Advertise well under the real 30s ceiling. At "~25 seconds" the model
    // wrote optimisers that used the whole budget and overran: three rounds in
    // a row were killed, scoring zero each time. A margin is cheaper than a
    // retry.
    `TIME BUDGET: you have 600 seconds — use them. Target 540 seconds of real optimisation. ` +
    `A program that finishes in 2 seconds is wasting 99% of its budget, and this problem is ` +
    `won by grinding, not by cleverness.\n` +
    `You are killed at 600s and a killed run scores ZERO, so guard it: record ` +
    `\`const t0 = Date.now()\` at the top, keep the best valid configuration in a variable, ` +
    `check \`Date.now() - t0 > 540000\` inside every loop — including inner ones — and return ` +
    `the best-so-far the moment it trips.\n` +
    `Spend that budget on MANY restarts of a real optimiser (multi-start, projection, ` +
    `physical relaxation, simulated annealing) and keep the best across all of them. ` +
    `Hundreds of restarts beats one careful attempt.\n\n` +
    // Make the inner search observable. Without a trace the model sees only a
    // final score and cannot distinguish an optimiser that climbed for the full
    // budget from one that peaked in four seconds and idled for the rest — two
    // situations needing opposite fixes.
    `REPORT YOUR SEARCH so it can be analysed. Instead of returning a bare array, return:\n` +
    `    { solution: [[x,y,r], ...], trace: [[secondsElapsed, bestScoreSoFar], ...] }\n` +
    `Push a checkpoint into trace every time your best improves, and at least once every ` +
    `10 seconds even when it does not. The trace is how you find out whether your schedule ` +
    `is actually using the time budget — it will be shown back to you.\n` +
    `A bare array still works, but then you learn nothing about your own search.\n\n` +
    `If you are given a starting packing, HARD-CODE IT as the initial configuration and ` +
    `refine it — never discard a good start to begin from random positions. Returning the ` +
    `start unchanged is acceptable; returning something worse is not.\n` +
    `Pure JavaScript only. No imports, no require, no I/O.\n\n` +
    // Generation is the bottleneck, not evaluation: one candidate streams for
    // ~5 minutes on this route, and a search needs hundreds of them. A tight
    // 100-line optimiser that actually runs beats a sprawling one that gets
    // clipped mid-function and scores zero.
    // No length cap any more. The old "under 100 lines" instruction dated from
    // when max_tokens was 2,500 and code really was being truncated; at 16,000
    // with typical output around 2,000 that risk is gone, and the cap actively
    // contradicted the instruction above to run a serious multi-start optimiser
    // — which does not fit in 100 lines.
    `Write as much code as the optimiser genuinely needs. There is no length limit worth ` +
    `worrying about, so do not sacrifice the quality of the search to keep the program short. ` +
    `Skip comments and prose; spend every line on the optimisation itself.`,
  verify: (result) => verifyCirclePacking(result, { n })
});

// ---------------------------------------------------------------------------
// Low Autocorrelation Binary Sequences (LABS).
//
// Find s in {-1,+1}^n minimising the sidelobe energy
//     E(s) = sum_{k=1..n-1} C_k^2,   C_k = sum_i s_i * s_{i+k}
// reported as the merit factor F = n^2 / (2E), which we maximise.
//
// A second problem is not decoration: the cross-problem memory thesis is that
// tactics learned on one objective cut the cost of the next one, and that is
// unmeasurable with a single problem. LABS is deliberately unlike circle
// packing — discrete rather than continuous, combinatorial rather than
// geometric — so any tactic that transfers has to be about *search* rather than
// about the domain.
//
// It also has a property circle packing lacks: for small n we can compute the
// true optimum ourselves by exhaustive search (scripts/labs-optimum.mjs), so
// "did it find the best possible answer" needs no citation and cannot be
// contested. Exhaustive results in the literature stop at n=66; past that the
// best known values are heuristic and genuinely improvable.
// ---------------------------------------------------------------------------

export function labsEnergy(seq) {
  const n = seq.length;
  let energy = 0;
  for (let k = 1; k < n; k++) {
    let c = 0;
    for (let i = 0; i + k < n; i++) c += seq[i] * seq[i + k];
    energy += c * c;
  }
  return energy;
}

function verifyLabs(result, { n }) {
  if (!Array.isArray(result)) return { valid: false, score: 0, reason: "not an array" };
  if (result.length !== n)
    return { valid: false, score: 0, reason: `expected ${n} values, got ${result.length}` };
  const seq = [];
  for (let i = 0; i < n; i++) {
    const v = result[i];
    // Accept the two common encodings, but nothing sloppier: a stray 0 or a
    // float would silently change the objective.
    if (v === 1 || v === -1) seq.push(v);
    else if (v === 0) seq.push(-1);
    else return { valid: false, score: 0, reason: `entry ${i} is ${JSON.stringify(v)}, expected +1/-1 (or 0/1)` };
  }
  const energy = labsEnergy(seq);
  if (energy <= 0) return { valid: false, score: 0, reason: "degenerate zero energy" };
  return { valid: true, score: (n * n) / (2 * energy), energy, solution: seq };
}

const labs = (n, records) => ({
  id: `labs-${n}`,
  label: `LABS n=${n} (maximise merit factor F = n²/2E)`,
  direction: "max",
  records,
  best: Math.max(...Object.values(records)),
  params: { n },
  runTimeoutMs: 30000,
  brief:
    `Find a binary sequence of length ${n} with entries +1 or -1 that MINIMISES the ` +
    `aperiodic autocorrelation sidelobe energy\n` +
    `    E = sum over k=1..${n - 1} of C_k^2,   where C_k = sum over i of s[i]*s[i+k]\n` +
    `equivalently MAXIMISES the merit factor F = ${n}^2 / (2E).\n\n` +
    `Return an array of exactly ${n} numbers, each +1 or -1.\n\n` +
    `This is a hard combinatorial problem with a famously rugged landscape, so a plain ` +
    `hill climber stalls immediately. The function may compute for up to ~25 seconds: ` +
    `use restarts, tabu search, or self-avoiding walks, and exploit the fact that a single ` +
    `sign flip can be evaluated incrementally rather than recomputing E from scratch.\n\n` +
    `Write as much code as the search genuinely needs — there is no length limit worth ` +
    `worrying about. Skip comments and prose; spend every line on the search itself. ` +
    `Pure JavaScript only, no imports, no I/O.`,
  verify: (result) => verifyLabs(result, { n })
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const PROBLEMS = {
  // Values from Packomania's variable-radius table, which is the reference for
  // this exact quantity (sum of radii, unit square) and is complete to N=100.
  //
  // Two things worth keeping straight:
  //
  // 1. ShinkaEvolve reports 2.635983283, which is ~2e-7 ABOVE Packomania's
  //    strict 2.635983084918. The difference is tolerance: Shinka checks at
  //    atol=1e-7 while AlphaEvolve uses zero. We verify at 1e-9, so the strict
  //    figure is our bar and the looser one is not comparable.
  //
  // 2. N=27 best known is 2.685978684198. Since adding a circle can only
  //    increase the sum, the optimum for 26 is bounded above by the optimum for
  //    27 — so anything at or beyond ~2.686 is unreachable here. An earlier
  //    stretch target of 2.70 was therefore not merely unverified but
  //    impossible, and the model duly began reasoning about "0.08 of wasted
  //    space" that does not exist.
  "circle-packing-26": circlePacking(26, {
    "Friedman 2012": 2.634,
    AlphaEvolve: 2.63586276,
    "Packomania (strict, our bar)": 2.635983084918,
    "ShinkaEvolve (atol 1e-7, not comparable)": 2.635983283
  }),
  // Same family, different n. Useful once the loop is trusted: it is the same
  // tactics against a different instance, which is what cross-problem memory is
  // supposed to exploit.
  "circle-packing-32": circlePacking(32, {
    AlphaEvolve: 2.937
  }),

  // Calibration targets. Both optima were derived here by exhaustive search
  // (scripts/labs-optimum.mjs, 0.2s and 2.7s respectively) and match the
  // published values E=26 and E=36 — so "did it find the optimum" is a settled
  // question rather than a cited one. These are the honest first test: a loop
  // that cannot reach a proven optimum on a small instance has no business
  // being pointed at an open problem.
  "labs-20": labs(20, { "exhaustive (proven optimal)": 7.692308 }),
  "labs-24": labs(24, { "exhaustive (proven optimal)": 8.0 })
};

export function getProblem(id) {
  const p = PROBLEMS[id];
  if (!p) {
    throw new Error(`unknown problem "${id}". Known: ${Object.keys(PROBLEMS).join(", ")}`);
  }
  return p;
}
