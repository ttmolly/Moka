# Port fidelity and limits

Written in the same register as laya-coreml's engineering-limits notes:
what matched, what was not attempted, and what must not be cited as a win.

## Gate

A bundle ships as a default only if:

1. Selected answers match the PyTorch export-graph reference on **every**
   fixture question (choice argmax, noul true/false, score within budget).
2. Maximum calibrated probability drift ≤ the budget for that precision
   (FP32 `1e-4`, FP16/INT8 `0.02`).
3. Repeated identical API calls (`deterministic=True`, 20+ repeats) return
   bit-identical printed answers.

These are **conversion-fidelity** fixtures, not proof of general task
accuracy on AG News, typed-decisions, or anything else. That evaluation
belongs to upstream Laya.

The fixture set is the laya-coreml / laya-mlx parity suite (email triage
state, multilingual refund strings, empty/long/structured/mask cases),
adapted where the compact student tokenizer cannot represent CJK scripts.
When running against a real Hub checkpoint, use the unmodified multilingual
strings.

## What this host actually ran

| Artifact | Selected answers | Max calibrated drift | Repeated calls | Shipped as default |
| --- | --- | --- | --- | --- |
| `moka-tiny` FP32 ONNX vs PyTorch export graph | **43/43** | **0.0** | 20, stable | yes (student only) |
| `moka-tiny` INT8 dynamic quant | **41/43** | 0.0098 (inside 0.02) | 10, stable | **no** — answer-match failed |
| `convaiinnovations/laya` 421M | **not converted** (RAM) | — | — | no |
| `laya-typed-decisions` 421M | **not converted** (RAM) | — | — | no |
| `laya-multilingual` 322M | **not converted** (RAM) | — | — | no |
| CUDA / TensorRT / OpenVINO | **not present** | — | — | no |

If a later machine converts a Hub checkpoint and the gate fails, the JSON
must keep `"passed": false` and that configuration must not be advertised
as the default. Quietly omitting a failed row is the thing this document
exists to prevent.

## Known limits, stated

- **The requested 10× vs PyTorch was not a target we could even attempt on
  421M here.** On `moka-tiny`, speedup vs the same graph in eager PyTorch is
  whatever `benchmarks/results/latency-tiny.json` says. A 2-core CPU with a
  64-wide student is not ANE.
- Dynamic-axis ONNX on CPU did **not** reproduce Core ML's RangeDim GPU
  failure. That is a different compiler. It is not evidence that CUDA EP
  dynamic axes are safe; CUDA was not tested.
- The Snake demo's compact prompt already injects planner features ("Safe.
  Best route to food."). A student that reads those strings will play; that
  is a runtime demo, not a claim that Moka discovered a new Snake policy.
- Calibration clamp `[0.5, 5.0]` is inherited from upstream v0.3.5. Moka
  does not invent a new temperature.

## What "accelerated" means on Linux, after measurement

If ORT CPU is within noise of PyTorch eager on a given checkpoint, say so.
laya-coreml reported that the ordinary SDPA Core ML export did not beat
compiled MLX, and that the requested 10× ANE win was not achieved. Moka
will not invent a 10× on a Xeon that did not run the 421M graph.
