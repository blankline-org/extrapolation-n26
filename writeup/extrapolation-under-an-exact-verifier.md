# Extrapolation Under an Exact Verifier

*A frozen language model with an external memory loop produced a 26-circle packing provably non-isomorphic to
the published record: not retrieved, not interpolated, not reachable by local descent. The reasoning trace and
all 91 attempts are published.*

<!--
meta description (159 chars):
A frozen LLM with external memory found a 26-circle packing provably distinct from the record — verified at
2.78e-17. Full reasoning trace and 91-attempt archive.

suggested slug: extrapolation-under-an-exact-verifier
primary keywords: circle packing n=26, AlphaEvolve, test-time learning, external memory, frozen model,
LLM extrapolation, exact verifier, contact graph, non-isomorphic
-->

We report a single, fully verified instance in which a frozen language model, coupled to an external memory
that accumulates distilled records of its own prior attempts, produced a configuration we can show was not
retrieved from its weights, not an interpolation of published solutions, and not reachable by local descent
from the search's own incumbent. We publish the reasoning trace of the attempt that produced it, together
with the 91-attempt archive that preceded it.

This is an existence result, not a causal one. We do not claim that memory produces extrapolation in general.
We claim that here is one machine-graded instance of it, documented from the inside, and that the grader is
arithmetic rather than human judgment.

---

## 1. What we claim, operationally

"Extrapolation" is contested, so we fix the term before using it. We claim the result satisfies three
conditions, each independently checkable by a reader with the repository:

1. **Not retrieved.** The configuration is not reproduced from published coordinates in the model's training
   data.
2. **Not interpolated.** It is not a perturbation or convex combination of published solutions.
3. **Not reachable by descent.** From the search's own incumbent, no local step improved toward it; the value
   lives in a different contact graph with no descent path from where the search stood.

Plus a fourth, which is what makes the other three checkable at all:

4. **Verified.** The configuration satisfies the constraints under exact arithmetic.

Conditions 2, 3 and 4 are established below by measurement. Condition 1 is supported by a self-report in the
model's trace, which is corroborating evidence and not proof; we treat it as the weakest of the four and say
so wherever it appears.

**What would falsify this.** A memory-free random-restart run at matched inner budget that lands in the same
contact graph. We have not run this at the scale it deserves (§9.3). If it recovers our structure at any
meaningful rate, condition 3 fails and the result reduces to a demonstration that circle packing is
multimodal, which is already known.

---

## 2. The result

We publish `pack26-discovery/gen3b-best.json`: 26 circles in the unit square, sum of radii
**2.635917599028**, worst constraint violation **2.78e-17**.

The problem is to pack *n* disjoint circles in a unit square maximizing the sum of their radii. It is a
standard benchmark for program-synthesis and global-optimization systems, with a contested public record.

| system | value | tolerance | our margin |
|---|---|---|---|
| Friedman (2012) | 2.634000000 | — | +1.92e-3 |
| AlphaEvolve (DeepMind, 2025) | 2.63586276 | atol = 0 | +5.48e-5 |
| FICO Xpress (Berthold et al., 2026) | 2.63591551 | ε = 1e-8 | +2.09e-6 |
| **this work (gen3b)** | **2.635917599028** | violation 2.78e-17 | — |
| "Alex", independent (Jul 2025) | 2.63592717 | atol = 0, self-reported | −9.57e-6 |
| Hybrid SA + Lévy flights (no LLM) | 2.6359372 | not stated | −1.96e-5 |
| OpenEvolve (2025) | 2.635977 | atol = 1e-6 | −5.94e-5 |
| ThetaEvolve (2026, 8B model) | 2.63598308 | atol = 1e-6 | −6.55e-5 |
| Packomania record (Haowei Lin) | 2.635983084919 | strict | −6.55e-5 |
| ShinkaEvolve (Sakana, 2025) | 2.635983283 | atol = 1e-7 | −6.57e-5 |

**The value is not the contribution and we place it here only to calibrate the instrument.** Six published
results exceed it, one of them a simulated-annealing heuristic with no model in the loop, and one an
independent individual working alone in July 2025. We discuss all of them in §10.

**On tolerance.** Tolerance conventions differ across this literature and the figures above are not directly
comparable without adjustment. AlphaEvolve validates at atol = 0; ShinkaEvolve reports at atol = 1e-7 and also
at atol = 0; OpenEvolve and ThetaEvolve use atol = 1e-6. Rather than assign our result to a tolerance class,
we report the measured maximum constraint violation directly: **2.78e-17**. Under a literal atol = 0
requirement this would need a uniform radius reduction of order 1e-16, costing approximately 2.6e-15 of score.
Ours is therefore not the strictest bar in the table — AlphaEvolve's is — and we report the measured quantity
because it is what a reader can independently check.

Converting the looser-tolerance figures to atol = 0 costs approximately 26·(t/2) — an upper bound, since
typically only a few pairs sit at the tolerance boundary. Under that conversion none of the results above
falls below ours. **The tolerance argument does not improve our position and we do not use it as one.**

---

## 3. The trace

`results/reasoning-live.heavy.log` is 214,223 bytes of verbatim model reasoning. At line 3018, partway
through the final attempt and before the result existed, the model attempts to retrieve a published answer:

> *"But wait — the log says local polish of the incumbent is already maxed out. So just squeezing the
> incumbent won't help unless… I have access to a KNOWN BETTER configuration. The Packomania value is
> 2.635983085 with a 'strict' bar. **Do I know the Packomania coordinates for n=26?**"*
>
> *"Hmm, do I remember actual coordinates? **Not precisely. I don't have memorized coordinates for the n=26
> optimal solution.** But maybe I can reconstruct something close."*
>
> *"Actually, let me think about this differently. The best-known structure: for maximizing sum of radii with
> 26 circles, the known good solutions typically have a certain structure. Let me try to recall what's
> known."*
>
> — `results/reasoning-live.heavy.log`, L3018–3024

We quote this in full, including the two continuations that weaken it. The sequence is not *attempted
retrieval → derivation*. It is *attempted retrieval → reported failure → further attempted retrieval →
strategy change*. The model does not cleanly abandon lookup; it keeps reaching, and then pivots.

**The retrieval cue was supplied by the harness, by design.** `src/problems.mjs:19-20` and `:382-384` pass
the model the published target values, including AlphaEvolve's 2.63586276 and ShinkaEvolve's 2.635983283.
The passage above is the model responding to a number it was given. We consider this a feature of the setup
rather than a contaminant: telling the system that a better value exists is, in effect, a retrieval probe,
and what the trace records is the system following that probe into its own weights, reporting that the
lookup failed, and changing strategy. We disclose it here rather than in a limitations section because it is
part of the experimental design and a reader needs it to interpret the quote.

**Self-reports about model knowledge are not evidence of non-contamination.** Models are unreliable narrators
of what they contain. This passage corroborates §4; it does not substitute for it. We do, however, report in
§5 one case where the model's self-report about its own history is checkable, and checks out.

---

## 4. Testing the three conditions

### 4.1 Not interpolated

The multiset of 26 radii matches no published packing we hold. Sorted against Packomania's radii, the largest
single-radius difference is 2.15e-3, roughly 2% of a typical radius — too large to be a perturbation of a
known answer, and no convex combination of the solutions we hold lands here.

The stronger form of this argument is structural. Computing contact graphs at 1e-7:

| | contact edges | wall contacts | degree sequence |
|---|---|---|---|
| **this work (gen3b)** | **48** | **14** | `22222333334444444444555556` |
| Packomania (Haowei Lin) | 58 | 20 | `22333444444444455556666667` |
| Hyra full-precision coordinates | 58 | 20 | `22333444444444455556666667` |

Index-matched, our packing shares 10 of 96 contact edges with the record family (Jaccard 0.104). Index
matching is attackable, so we rely on the label-invariant form: **degree sequences are invariant under
relabeling; ours differs from the record family's; the graphs are therefore non-isomorphic.** This is a proof,
not an estimate, and it holds at both 1e-7 and 1e-6 contact tolerances.

Our configuration reaches essentially the same sum with ten fewer contacts and six fewer wall contacts. The
record family is densely coordinated, with six degree-6 circles; ours has one. It is a sparser solution to the
same problem.

**Structural difference alone is not the claim.** Circle packing at this scale is multimodal; independent
restarts land in different basins, and finding *a* different contact graph is inexpensive. We report this to
establish the mechanism — basin escape rather than local polish — and because non-isomorphism is the one
structural claim in this literature we can prove rather than assert (§10).

### 4.2 Not reachable by descent

The loop's incumbent was an LP-verified exact local optimum: all 26 circles in contact, and 500 seconds of
kicks and simulated annealing recovered +3e-7. Every local step toward the winning configuration scored worse.

This is the condition that carries the result. It is the regime in which AlphaEvolve's SLSQP polish and a
global NLP solver are structurally unable to follow: the value lives in a different contact graph and there is
no descent path to it from where the search stood.

### 4.3 Verified

2.635917599028, worst violation 2.78e-17, computed under exact arithmetic by `src/problems.mjs`. The candidate
program never observes the verifier. For reference, we measured the published record coordinates at a worst
violation of 1.04e-12 and the full-precision Hyra coordinates at 9.80e-10.

We also hold a variant at 2.635917611449 which gains 1.24e-8 by sitting at 9.00e-10 overlap. **We do not use
it.** The consistency of our tolerance position is worth more than 1.24e-8.

---

## 5. From the inside: what 91 attempts show

`results/archive-circle-packing-26.heavy.json` records **91 attempts over 32.4 hours**: 73 valid, 18 invalid
(all 18 scoring zero). Each entry carries the model's own structured analysis — `DIAGNOSIS`, `TECHNIQUE`,
`PLAN`, `AVOID`, `SELF-CHECK` — alongside the verified score, the failure reason, and a timestamp. This is
the record that lets us examine the search from the inside rather than from its output alone.

**Best-so-far improved 33 times**, unevenly:

```
2.080 (#2) → 2.229 (#3) → 2.498 (#4) → 2.617 (#11) → 2.620 (#18) → 2.622 (#36)
→ 2.624 (#39) → 2.625 (#44) → 2.626 (#45) → 2.6265 (#58) → 2.6278 (#73)
→ 2.635871 (#77) → 2.635903 (#79) → 2.635907 (#84)
```

The step at attempt 77, from 2.627796 to 2.635871, is where the search leaves the basin it had occupied for
roughly forty attempts.

### 5.1 Self-report fidelity

46 of the 91 attempts contain an `AVOID` block in which the model enumerates its own prior failures. These
blocks lengthen over the run — the first five are 118, 0, 232, 492 and 433 characters; the last five are 467,
464, 1526, 1475 and 1998 — and they become more specific, moving from generic caution to itemized failure
classes paired with countermeasures.

The final block cites four failure classes. We checked each against the archive:

| model's claim | archive | match |
|---|---|---|
| "the 7 syntax-error cutoffs" | 7 syntax/parse failures (#25, 26, 27, 28, 30, 40, 75) | ✓ |
| "const-reassignment throws" | 2 (#42, #46) | ✓ |
| "lattice-init's invalid finals" | 4 attempts tagged `lattice-init`, all 4 invalid (#1, 14, 15, 78) | ✓ |
| "running past the limit" | #52, plus timeouts #13–15 | ✓ |

The count of seven is exact and non-trivial: there are eight import-stage failures in the archive, but the
eighth (#43, `best is not defined`) is a ReferenceError rather than a syntax error, and the model's count
correctly excludes it.

We report this because self-report fidelity is usually unmeasurable. Here the archive is auditable, so a
claim the model makes about its own history can be checked against the record — and in this instance the
model is an accurate narrator of its own failures at the level of individual counts. This does not license
trusting the §3 self-report about training-data contents, which is a different and much harder claim. It
does establish that the system's introspective reports are not uniformly confabulated.

One cited quantity we could **not** verify: the "Adam-ℓ1 oscillation that left 1.1e-4 unclaimed." We have no
independent measurement of that figure and do not vouch for it.

### 5.2 Failures do not monotonically decrease

The honest counterpart: invalid attempts persist late. They occur at #1, 9, 10, 13, 14, 15, 25–28, 30, 40, 42,
43, 46, 52, 75 and 78, leaving a clean tail of only 13 attempts. What changes across the run is not the
failure rate but the **failure mode** — early attempts fail on geometry and runtime (escapes, timeouts), the
middle on syntax and language semantics, the last on tolerance (#78: nine overlapping pairs, worst 2.00e-9).

We take this as a moderate result rather than a strong one. The AVOID blocks demonstrably accumulate accurate
content, and the failure distribution shifts, but the loop does not stop failing. A claim that memory
monotonically reduces error is not supported by this run.

---

## 6. Why n = 26 is the instrument

**The result cannot be faked.** Verification is exact arithmetic: every circle inside the square, no two
overlapping. The candidate program never observes the verifier. Either the packing is valid or it scores zero.

**The record is contested and public.** Friedman → AlphaEvolve → FICO → OpenEvolve → ShinkaEvolve →
Packomania → ThetaEvolve. Whether a configuration is better is arithmetic, not opinion.

**It is contaminated by design, and that is the point.** The published solutions are on the open internet. A
model that memorizes reproduces a known contact graph. Ours does not. **The contamination is the control:**
we did not need to construct a held-out problem, because the answer being available is what makes failure to
match it informative.

---

## 7. The system

Two nested search loops. The outer loop is over programs: the model writes a JavaScript program that searches
for a packing. The inner loop is over packings: that program runs for up to ten minutes performing its own
numerical search and returns 26 `(x, y, r)` triples, which the verifier scores.

Memory enters between attempts. A consolidation step converts each outcome into a short distilled experience
record — what moved the score, what failed, why — which is written to an external store. On the next attempt
the model receives the records most relevant to what it is about to try.

**No model parameters change. Only the store accumulates.** This places the system in the test-time learning
category alongside Dynamic Cheatsheet, Agentic Context Engineering, and the systems benchmarked by
Evo-Memory (§10).

### 7.1 Compositional generalization

The final search program combined ring rotation, hole relocation, an SLSQP-equivalent penalty optimizer,
novelty rejection, and batch screening of roughly 20 structural perturbations before committing to one.

The model did not begin with this combination and no single zero-shot prompt in our runs produced it; the
loop assembled it across attempts, retaining what moved the verified score. We note one qualification the
trace makes visible: the model reasons from *published* evidence that novelty rejection was ShinkaEvolve's
decisive ablation. **The strategy was retrieved; the configuration was not.** That is the precise claim.

### 7.2 Scope and safety position

This is an internal research system. It is not shipped, not available to customers, and not integrated into
any production model. It is a **bounded, memory-level recursive loop**: it improves its future performance by
writing to an external store that shapes its next inputs. It does not modify its own weights, its own code,
the consolidation step, the retrieval function, or the harness. The store evolves; the machinery that evolves
the store does not.

The loop is objective-agnostic — its behaviour is determined by the verifier attached to it. Before any
production path our gate includes misuse evaluation against offensive-security-shaped objectives on targets we
own, memory provenance and integrity controls, and tenant isolation of the store.

Memory integrity is the risk we weight highest, because we have already observed a failure of it. Running with
six parallel workers, all six read the archive as it stood at launch; five subsequently wrote records of the
form *"the log shows previous attempts failed due to…"* citing failures that had not occurred. Parallelism did
not dilute the learning signal; it introduced a false one. A store that can be written to can be poisoned, and
that is the first property a production version must survive. We will publish these evaluations, including
negative results, before shipping.

---

## 8. Provenance: which component produced what

The repository is public and a reader will reconstruct this quickly, so we state it directly. **Three
components produced the published number, and only the first contains a model.**

**Phase 1 — the memory loop (`src/evolve.mjs`).** The loop wrote the search programs across 91 attempts. Its
best archived score is **2.635907462261**. This exceeds AlphaEvolve by 4.47e-5 and Friedman 2012 by 1.91e-3.
It does not exceed FICO Xpress, falling short by 8.05e-6.

**Phase 2 — LP radii and structural relocation (`scripts/relocate.mjs`).** With circle centres held fixed,
maximizing the sum of radii is a linear program. This step solves that LP and applies structural relocation,
lifting the result to **2.635912195016** (`results/best-circle-packing-26.heavy.json`), a gain of +4.73e-6.
It contains no model call.

**We attribute this step to a human author, not to the loop.** The LP formulation was written by us after
observing that the model repeatedly identified the opportunity and never implemented it — every program the
loop produced used a greedy grow-to-fit pass, which converges to a fixed point that is not the LP optimum,
because the LP is permitted to shrink one circle so that two others can grow. That reasoning is recorded in
the header of `scripts/lp-radii.mjs`. It is a human algorithmic contribution to the final number.

**Phase 3 — a seed and parent sweep (`pack26-discovery/gen-next.mjs`).** This takes the best solution so far,
substitutes it into the program as `BESTCFG`, changes the RNG seed and the hop-batch count, and writes the
next candidate. There is no model call anywhere in `pack26-discovery/`. Run gen0 → gen3b, it added a further
+5.40e-6 to reach **2.635917599028**. The lineage is monotone and fully persisted: gen2 2.635917359067 → gen3
2.635917574561 → gen3b 2.635917599028.

| stage | value | gain | contains a model |
|---|---|---|---|
| memory loop, best of 91 attempts | 2.635907462261 | — | yes |
| + LP radii and relocation (human-authored) | 2.635912195016 | +4.73e-6 | no |
| + seed and parent sweep | 2.635917599028 | +5.40e-6 | no |

Three consequences we accept:

- **The margins over AlphaEvolve and Friedman 2012 are attributable to the memory loop.** They survive
  without either post-processing stage.
- **The margin over FICO Xpress is not.** It requires both model-free stages, one of which is a human
  algorithmic contribution. Any characterization of this work as "the memory loop beat FICO Xpress" would be
  wrong.
- **Together the two model-free stages contributed +1.01e-5, roughly a fifth of the loop's own margin over
  AlphaEvolve.** This is evidence against the strongest version of our own thesis. We report it rather than
  leave it to be found.

---

## 9. Controls and ablations

### 9.1 What we have: memory-gated coding tasks

On a separate suite in which a frozen model must infer hidden repository conventions from failing tests and
apply them to unseen problems:

| benchmark | treatment (memory on) | control (memory off) | verdict |
|---|---|---|---|
| convention (shared structure), n = 12 train / 6 transfer | 75% (50%→100%), transfer 100% | 0% (0%→0%), transfer 0% | supported |
| convention (earlier run) | 58%, transfer 100% | 0%, transfer 0% | supported, weak trend |
| independent (no shared structure) | 100% | 90% | **not supported** |

The third row carries more weight than the first two. On tasks with no recurring structure to learn, the loop
showed no separation from control, and the harness reported that.

**A caveat on the first two rows:** the convention benchmark's hidden convention is not inferable without
feedback, so a memory-off control is close to 0% by construction. The
comparison demonstrates that the loop extracts and applies a convention; it does not establish a general
learning advantage, and the n is small (12 training tasks).

### 9.2 The zero-shot baseline

The no-memory circle-packing runs are **five single-evaluation attempts**, scoring 0, 0, 1.246529, 0, and
2.616693. Three were invalid. The memory-conditioned runs had up to 20 evaluations and an inherited archive.
This compares one attempt against twenty, not memory-on against memory-off, and our own analysis script
declines to conclude from it:

```
REFUSED TO CONCLUDE:
  - circle-packing-26: runs used 4 different configurations — not comparable
```

The most adverse number in our data is the best zero-shot single-shot score: **2.616693**, from one attempt
with no memory. What the no-memory arm would do with twenty evaluations is unanswered.

### 9.3 The ablations that would settle it

We list these as specified experiments rather than intentions. The first requires no model calls and no
budget — `pack26-discovery/structural-search.mjs` accepts `--seed` and `--seconds` and contains no model in
the loop:

1. **Matched-budget memory-free restarts.** N restarts at identical inner budget; report how many reach
   2.63586276 and how many land in degree sequence `22222333334444444444555556`. **Not yet run.**
2. **A shuffled-memory arm.** Records retrieved for a different problem. If this helps equally, the effect is
   prompt bulk rather than memory content. **Not yet run.**
3. **Full stated-intent fidelity.** §5.1 measures self-report accuracy on failure counts. The stronger version
   diffs each attempt's stated `PLAN` against the program actually written and against the verified score
   delta, classifying as *intent honored, score moved* / *intent honored, score flat* / *intent absent from
   code*. The third ratio is a confabulation rate under a verifier. **Partially run (§5.1).**

---

## 10. Related work and prior claims

We list the work that constrains our contribution, including results that exceed ours.

**Prior verified LLM discovery is three years old.** FunSearch (DeepMind, *Nature*, 2023) produced new cap set
constructions — the largest improvement to the asymptotic lower bound in twenty years. AlphaTensor preceded
it; AlphaEvolve followed. **We are not claiming the first LLM discovery.**

**On this specific problem, six published results exceed ours.** Most consequentially:

- An independent individual working under the handle "Alex" reported **2.63592717** in July 2025 — above
  AlphaEvolve and FICO — using a self-built multi-agent framework, validating with AlphaEvolve's own Colab
  validator (atol = 0), and describing the resulting arrangement as structurally different from both. We could
  not locate published coordinates, so we cannot compare contact graphs. **This result precedes ours, exceeds
  it, and was produced under comparable resource constraints.** Any framing of our work as the first
  low-budget independent result on this benchmark would be wrong.
- A **hybrid simulated-annealing** method with cosine cooling and Lévy flights reports **2.6359372** with no
  model in the loop at all.

**Test-time learning with external memory over a frozen model is an established category**, not a novel
architecture. Dynamic Cheatsheet (Suzgun et al., 2025) describes persistent evolving memory for black-box
models with no gradient updates; Agentic Context Engineering, Memento and MemoPilot are adjacent; Evo-Memory
benchmarks the category directly. **Our loop is an instance of a known design.**

**The complementary-learning-systems framing is likewise established.** HippoRAG explicitly orchestrates
retrieval to mirror neocortical and hippocampal roles; HEMA, AHA, CodaRAG and CraniMem occupy the same space.
We adopt this framing as design motivation (§13), not as a contribution.

**Memory-level recursive self-improvement is an active category** with a dedicated ICLR 2026 workshop.

### What we believe is new

Against that background, the contribution is narrow and we state it narrowly:

> A timestamped, self-reported negative retrieval test, bound to an exact verifier, terminating in a
> **provably non-isomorphic** configuration — published together with the attempt archive that produced it.

FunSearch, AlphaTensor and AlphaEvolve all produced verified-novel results; none published a reasoning trace
of a system attempting retrieval, reporting failure, and then deriving. Evolutionary program search does not
narrate. "Alex" asserted structural difference; we could find no proof of it. Degree-sequence non-isomorphism
(§4.1) is, as far as we can determine, the first proof of structural distinctness published for n = 26.

A secondary claim: **memory-level RSI scored against a public record rather than against itself.** Most work
in the category reports internal metrics, which is the standard criticism of it.

---

## 11. Limitations

- **Not a record, and not state of the art.** Six published results exceed 2.635917599028, including one from
  a heuristic with no model in it.
- **Not the first independent low-budget result on this benchmark.** See "Alex", July 2025 (§10).
- **The margin over FICO Xpress is 2.09e-6 and does not belong to the memory loop.** It requires two
  model-free post-processing stages, one of them a human-authored LP the model never implemented despite
  repeatedly identifying the opportunity (§8). The memory loop's own best is 2.635907462261.
- **Our bar is not the strictest in the field.** AlphaEvolve validates at atol = 0 (§2).
- **Novelty is measured against the record family we hold** (Packomania and the full-precision Hyra
  coordinates). AlphaEvolve's coordinates are public in `google-deepmind/alphaevolve_results`; we have not yet
  run the comparison against them and therefore do not claim novelty relative to AlphaEvolve specifically.
- **The retrieval cue was supplied by the harness** (§3). The trace records a probed retrieval failure, not a
  spontaneous one.
- **Self-reported retrieval failure is corroborating, not conclusive.** §5.1 shows the model reports its own
  failure history accurately; that does not extend to reports about its training data.
- **Failures do not monotonically decrease across the run** (§5.2).
- **The zero-shot baseline is five single-shot runs**, three invalid (§9.2).
- **The convention control is near-0% by construction** (§9.1).
- **The decisive ablation has not been run** (§9.3), and it requires no budget.
- **n = 1.** One problem, one run. This is an existence result.

---

## 12. Reproducibility

| artifact | contents |
|---|---|
| `pack26-discovery/gen3b-best.json` | the configuration — 26 `(x,y,r)` triples, sum 2.635917599028 |
| `results/best-circle-packing-26.heavy.json` | after LP radii and relocation, 2.635912195016 |
| `scripts/relocate.mjs`, `scripts/lp-radii.mjs` | the human-authored, model-free phase 2 (§8) |
| `src/problems.mjs` | the exact verifier |
| `results/reasoning-live.heavy.log` | 214,223 bytes of verbatim reasoning, including L3018–3024 |
| `results/archive-circle-packing-26.heavy.json` | 91 attempts with analysis, scores, failure reasons, timestamps |
| `pack26-discovery/` | every generation from seed to gen3b, with parents and scores |
| `results/report-convention.md`, `report-independent.md` | the memory-on/off controls, including the null result |

To reproduce the structural claim, compute contact graphs at 1e-7 and compare degree sequences against
`packomania26.json` and `hyra-n26.json`. Ours is `22222333334444444444555556`; the record family's is
`22333444444444455556666667`.

To reproduce §5.1, parse the `analysis` field of the archive for `AVOID` blocks and compare the cited failure
counts against the `reason` field of prior attempts.

---

## 13. Why we looked in memory

Complementary Learning Systems theory (McClelland, McNaughton & O'Reilly, 1995; Kumaran, Hassabis &
McClelland, 2016) holds that an intelligent agent needs two learning systems with opposite properties: a slow
one that generalizes across repeated experience, and a fast one that stores specifics and keeps similar
episodes distinct. The constructive episodic simulation hypothesis (Schacter & Addis, 2007) proposes that
episodic memory exists not to record the past but to permit recombination of past elements into simulations of
situations that have not occurred. The causal evidence is Hassabis, Kumaran, Vann & Maguire (*PNAS*, 2007):
patients with bilateral hippocampal damage, asked to imagine simple novel scenarios, produced descriptions
that "lacked spatial coherence, consisting instead of fragmented images in the absence of a holistic
representation."

This motivated the design: freeze the slow system, build only the fast one, and test whether the pairing
produces something outside what the slow system contains.

**We are not claiming our consolidation step is a hippocampus, and the correspondence is architectural rather
than biological.** The framing is also not ours — it is standard in this subfield (§10). We report it because
it is why the experiment was built this way, not as evidence that it worked. The evidence is in §4 and §5.

---

## References

- McClelland, McNaughton & O'Reilly (1995). *Why there are complementary learning systems in the hippocampus
  and neocortex.* Psychological Review 102:419–457.
- Kumaran, Hassabis & McClelland (2016). *What Learning Systems do Intelligent Agents Need? Complementary
  Learning Systems Theory Updated.* Trends in Cognitive Sciences 20:512–534.
- Hassabis, Kumaran, Vann & Maguire (2007). *Patients with hippocampal amnesia cannot imagine new experiences.*
  PNAS 104:1726–1731.
- Schacter & Addis (2007). *On the constructive episodic simulation of past and future events.* Behavioral and
  Brain Sciences 30:299–351.
- Romera-Paredes et al. (2024). *Mathematical discoveries from program search with large language models.*
  Nature 625:468–475. (FunSearch)
- Novikov et al. (2025). *AlphaEvolve: A coding agent for scientific and algorithmic discovery.*
  arXiv:2506.13131.
- Berthold, Kamp, Mexi, Pokutta & Pólik (2026). *Out-of-the-Box Global Optimization for Packing Problems.*
  arXiv:2605.04850.
- Suzgun et al. (2025). *Dynamic Cheatsheet: Test-Time Learning with Adaptive Memory.*
- Gutiérrez et al. (2024). *HippoRAG: Neurobiologically Inspired Long-Term Memory for Large Language Models.*
  arXiv:2405.14831.
- *Evo-Memory: Benchmarking LLM Agent Test-time Learning with Self-Evolving Memory.* arXiv:2511.20857.
- *ThetaEvolve: Test-time Learning on Open Problems.* arXiv:2511.23473.

---

*We are Blankline, the team behind Dropstone. The model is Dropstone Heavy 1.7 (Kimi 3), served from our
own commercial endpoint, used frozen at list price with no fine-tuning. We did not train the model; we built
the memory loop around it.*
