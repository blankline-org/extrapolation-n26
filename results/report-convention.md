# Self-learning loop — experiment report

- benchmark: **convention (shared structure, memory-gated)**
- provider: `real` (backend `cli`)
- solver: `dropstone-pro`  distiller: `dropstone-heavy`  effort: `medium`
- train tasks: 12  transfer tasks: 6  k: 6
- run at: 2026-06-27T10:00:52.328Z

## Headline

| condition | first-pass (early → late) | within-task | transfer | lessons |
| --- | --- | --- | --- | --- |
| treatment (memory ON) | 75%  (50% → 100%) | 100% | 100% | 5 |
| control (memory OFF) | 0%  (0% → 0%) | n/a | 0% | 0 |

## Learning curve (cumulative first-pass rate, task 1..N)
```
treatment  ▁▅▆▅▅▅▅▅▆▆▆▆  75%
control    ▁▁▁▁▁▁▁▁▁▁▁▁  0%
```

## Verdict: SUPPORTED
- treatment first-pass climbed across the stream
- treatment beat the memory-off control on late tasks
- the gain transferred to unseen tasks (strategy, not caching)

## Lessons the agent wrote
```json
[
  {
    "strategy": "Wrap the computed value in an object of the form {\"ok\": true, \"value\": <result>} rather than returning the raw value",
    "useCount": 1
  },
  {
    "strategy": "Use 1-based numbering; add 1 to any 0-based index before returning it as the value.",
    "useCount": 1
  },
  {
    "strategy": "Return the sentinel value 0 inside the standard success wrapper {\"ok\":true,\"value\":0}; do not use an error wrapper.",
    "useCount": 1
  },
  {
    "strategy": "Always wrap results as {\"ok\":true,\"value\":...}; never produce {\"ok\":false,...} for any outcome.",
    "useCount": 1
  },
  {
    "strategy": "Throw `new Error(\"E_INVALID\")` instead of returning a default value or a wrapped success result.",
    "useCount": 1
  }
]
```