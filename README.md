# Extrapolation Under an Exact Verifier — n = 26 circle packing

Artifacts for the writeup in [`writeup/extrapolation-under-an-exact-verifier.md`](writeup/extrapolation-under-an-exact-verifier.md).

A frozen language model coupled to an external memory loop produced a 26-circle packing that is provably
non-isomorphic to the published record family. This repository contains the configuration, the exact
verifier, the full reasoning trace, and the 91-attempt archive that preceded it.

**What is not here: the memory loop itself.** `src/evolve.mjs` is an internal research system and is not
released (§7.2 of the writeup). What is published is its complete output record — all 91 attempts with the
model's own analysis, verified score, failure reason and timestamp — plus everything downstream of it, since
the two post-processing phases contain no model and are included in full.

So: **you can audit what the loop did and independently check every numerical claim downstream of it. You
cannot re-run the loop.** The experiment that does not require trusting us is the matched-budget restart
ablation below — it needs no model and no access to our system.

**This is not a record.** Six published results exceed ours, one of them a simulated-annealing heuristic with
no model in the loop. See §2 and §10 of the writeup. The contribution is the documented trace and the
structural proof, not the value.

## Check it yourself

Requires Node 18+. No dependencies, no install step.

```sh
node verify.mjs           # the published packing, under exact arithmetic
node contact-graph.mjs    # the non-isomorphism claim (§4.1)
node archive-stats.mjs    # what the 91 attempts show (§5)
```

`verify.mjs` accepts any solution file, so you can check the comparison packings on the same code path:

```sh
node verify.mjs pack26-discovery/packomania26.json
node verify.mjs pack26-discovery/hyra-n26.json
node verify.mjs results/best-circle-packing-26.heavy.json
```

## The result

| | value |
|---|---|
| sum of radii | **2.635917599028** |
| max constraint violation | **2.78e-17** |
| contact edges / wall contacts | 48 / 14 |
| degree sequence | `22222333334444444444555556` |
| record family degree sequence | `22333444444444455556666667` |

Degree sequences are invariant under relabeling. Ours differs from the record family's, so the graphs are
non-isomorphic — this is a proof, not an estimate, and `contact-graph.mjs` reproduces it.

## Layout

| path | contents |
|---|---|
| `pack26-discovery/gen3b-best.json` | the configuration — 26 `(x, y, r)` triples |
| `pack26-discovery/` | the full lineage, seed to gen3b, with parents and scores |
| `pack26-discovery/packomania26.json` | the published record coordinates, for comparison |
| `pack26-discovery/hyra-n26.json` | full-precision record coordinates, shifted to the unit square |
| `pack26-discovery/incumbent.json` | the LP-verified local optimum the search escaped (§4.2) |
| `src/problems.mjs` | the verifier, as used by the loop |
| `scripts/relocate.mjs`, `scripts/lp-radii.mjs` | the human-authored, model-free phase 2 |
| `results/best-circle-packing-26.heavy.json` | after LP radii and relocation, before the seed sweep |
| `results/reasoning-live.heavy.log` | 214,223 bytes of verbatim reasoning, including L3018–3024 |
| `results/archive-circle-packing-26.heavy.json` | 91 attempts with analysis, scores, failure reasons, timestamps |
| `results/report-convention.md` | memory-on/off control, positive |
| `results/report-independent.md` | memory-on/off control, **null result** |

## Provenance

**Three components produced the published number, and only the first contains a model.**

| stage | value | gain | contains a model |
|---|---|---|---|
| memory loop, best of 91 attempts | 2.635907462261 | — | yes |
| + LP radii and relocation (`scripts/relocate.mjs`) | 2.635912195016 | +4.73e-6 | no |
| + seed and parent sweep (`pack26-discovery/gen-next.mjs`) | 2.635917599028 | +5.40e-6 | no |

Phase 2 is a **human algorithmic contribution**, not the loop's. With centres held fixed, maximizing the sum
of radii is a linear program; the model identified this repeatedly and never implemented it, so every program
the loop produced used a greedy grow-to-fit pass that converges away from the LP optimum. The reasoning is in
the header of [`scripts/lp-radii.mjs`](scripts/lp-radii.mjs).

The margins over AlphaEvolve and Friedman 2012 belong to the memory loop and survive without either
post-processing stage. **The margin over FICO Xpress does not** — it requires both. §8 of the writeup states
this in full.

## Not yet run

Listed here rather than only in the paper, because they are the experiments that would strengthen or break
the central claim:

- **Matched-budget memory-free restarts.** `pack26-discovery/structural-search.mjs --seed=N --seconds=S`
  contains no model in the loop. If restarts recover degree sequence `22222333334444444444555556` at any
  meaningful rate, §4.2 fails.
- **Comparison against AlphaEvolve's published coordinates**, available in
  [`google-deepmind/alphaevolve_results`](https://github.com/google-deepmind/alphaevolve_results). Until this
  is run we do not claim novelty relative to AlphaEvolve specifically.

If you run either, we would like to see the result.

## License

MIT — see [`LICENSE`](LICENSE). Solution coordinates and archived run data are facts about a public
mathematical problem and are released alongside the code under the same terms.

Built by Blankline, the team behind Dropstone.
