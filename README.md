# Extrapolation Under an Exact Verifier — n = 26 circle packing

A frozen language model with an external memory loop produced a 26-circle packing that is **provably
non-isomorphic** to every published solution we could obtain — including AlphaEvolve's. This repository has
the coordinates, the exact verifier, the full reasoning trace, and all 91 attempts.

**Write-up:** https://blankline.org/research/extrapolation-under-an-exact-verifier

![Two 26-circle packings side by side with their contact graphs overlaid. Ours has 48 contacts and 14 wall
contacts; the record family has 58 and 20. Coloured edges are unique to that packing; shared edges are
dimmed.](writeup/figures/fig-1-structure.png)

Same problem, near-identical sum, different object. Ours makes **48 contacts**; the record family makes
**58**.

## Check it in ten seconds

Node 18+. No dependencies, no install.

```sh
git clone https://github.com/blankline-org/extrapolation-n26
cd extrapolation-n26
node verify.mjs
```

```
sum of radii    2.635917599028
max violation   2.776e-17   (overlap 1-13)
valid @ 1e-9    yes
```

`2.78e-17` is machine epsilon — the packing is feasible to the limit of double precision. The verifier is
forty lines and the candidate program never saw it.

```sh
node contact-graph.mjs   # the non-isomorphism proof
node archive-stats.mjs   # what the 91 attempts show
node verify.mjs pack26-discovery/alphaevolve-n26.json   # or any other solution file
```

## The proof

![Paired bars of how many circles have 2, 3, 4, 5, 6 and 7 contacts in each packing, with the sorted degree
sequences printed underneath.](writeup/figures/fig-2-degrees.png)

Both packings share a mode of ten degree-4 circles. The entire difference is in the tails — ours carries the
weight low, the record family carries it high.

A degree sequence does not depend on how the circles are numbered. **Two graphs with different degree
sequences cannot be relabelings of each other.** That makes this a proof rather than an observation, and
`contact-graph.mjs` recomputes it from the coordinates rather than trusting the numbers printed here.

| | contacts | wall | degree sequence |
|---|---|---|---|
| **this work** | **48** | **14** | `22222333334444444444555556` |
| AlphaEvolve | 29 | 15 | `11112222222222222233333344` |
| Packomania (Haowei Lin) | 58 | 20 | `22333444444444455556666667` |
| Hyra full-precision | 58 | 20 | `22333444444444455556666667` |

AlphaEvolve's construction is not snapped to exact contact, so its edge count moves with the tolerance (29 →
38 → 46 at 1e-7 → 1e-6 → 1e-5). The conclusion holds at every tolerance we tested, but that graph is less
well determined than the record family's, which is stable at 58.

## What this is not

**Not a record.** Six published results exceed 2.635917599028, including a simulated-annealing heuristic with
no model in it (2.6359372) and an independent individual working alone in July 2025 (2.63592717). The record
is 2.635983084919.

**Not the strictest verification in the field.** AlphaEvolve validates at `atol = 0`; we report a measured
violation of 2.78e-17, which is above zero.

**Not a new category of result.** Verified LLM discovery is three years old and has a *Nature* paper
(FunSearch, 2023). Test-time learning over a frozen model with external memory is an established category
with its own benchmarks.

The contribution is narrow: a timestamped, self-reported *failed* retrieval, bound to an exact verifier,
ending in a provably non-isomorphic configuration — published with the attempt archive that produced it.

## Provenance

**Three components produced the published number, and only the first contains a model.**

| stage | value | gain | model? |
|---|---|---|---|
| memory loop, best of 91 attempts | 2.635907462261 | — | yes |
| + LP radii and relocation (`scripts/relocate.mjs`) | 2.635912195016 | +4.73e-6 | no |
| + seed and parent sweep (`pack26-discovery/gen-next.mjs`) | 2.635917599028 | +5.40e-6 | no |

Stage 2 is a **human** contribution, not the loop's. With centres fixed, maximizing the sum of radii is a
linear program; the model identified this repeatedly and never implemented it, so every program it wrote used
a greedy grow-to-fit pass that converges away from the LP optimum. See the header of
[`scripts/lp-radii.mjs`](scripts/lp-radii.mjs).

The margins over AlphaEvolve and Friedman 2012 belong to the memory loop and survive without either
post-processing stage. **The margin over FICO Xpress does not** — it needs both.

## What is not here

**The memory loop itself.** `src/evolve.mjs` is an internal [Dropstone](https://dropstone.io) research system
and is not released. It is not shipped, not available to customers, and not part of any production model; if
it reaches production it will do so inside Dropstone, after the misuse, memory-integrity and tenant-isolation
evaluations described in §7.2 of the write-up. What is published here is its complete output record — all 91
attempts with the model's own analysis, verified score, failure reason and timestamp — plus everything
downstream, since both post-processing stages contain no model.

**You can audit what the loop did and check every claim downstream of it. You cannot re-run the loop.**

## Layout

| path | contents |
|---|---|
| `pack26-discovery/gen3b-best.json` | the configuration — 26 `(x, y, r)` triples |
| `pack26-discovery/alphaevolve-n26.json` | AlphaEvolve's construction 1, extracted and re-verified |
| `pack26-discovery/packomania26.json`, `hyra-n26.json` | the record family, for comparison |
| `pack26-discovery/incumbent.json` | the LP-verified local optimum the search escaped |
| `pack26-discovery/` | the full lineage, seed to gen3b, with parents and scores |
| `src/problems.mjs` | the verifier |
| `scripts/` | the human-authored, model-free stage 2 |
| `results/reasoning-live.heavy.log` | 214,223 bytes of verbatim reasoning, including L3018 |
| `results/archive-circle-packing-26.heavy.json` | 91 attempts, with analysis, scores and timestamps |
| `results/report-convention.md`, `report-independent.md` | memory on/off controls, including the null result |

## License

MIT — see [`LICENSE`](LICENSE). Coordinates and archived run data are facts about a public mathematical
problem, released under the same terms.

Built by Blankline, the team behind [Dropstone](https://dropstone.io). The model is Dropstone Heavy 1.7
(Kimi 3), served from our own endpoint and used frozen. We did not train it — we built the memory loop
around it.
