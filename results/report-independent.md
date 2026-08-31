# Self-learning loop — experiment report

- benchmark: **independent (no shared structure)**
- provider: `real` (backend `cli`)
- solver: `dropstone-pro`  distiller: `dropstone-heavy`  effort: `medium`
- train tasks: 10  transfer tasks: 6  k: 6
- run at: 2026-06-27T03:07:42.882Z

## Headline

| condition | first-pass (early → late) | within-task | transfer | lessons |
| --- | --- | --- | --- | --- |
| treatment (memory ON) | 100%  (100% → 100%) | 100% | 100% | 0 |
| control (memory OFF) | 90%  (100% → 100%) | n/a | 100% | 0 |

## Learning curve (cumulative first-pass rate, task 1..N)
```
treatment  ██████████  100%
control    ██████▇▇▇▇  90%
```

## Verdict: NOT SUPPORTED
- treatment did not separate from the memory-off control

## Lessons the agent wrote
```json
[]
```