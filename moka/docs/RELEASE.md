# Release

Moka 0.1.0 is a source release of the Linux runtime, conversion CLI, tests
and studio. Model weights are **not** in git.

## Pinned upstream revisions

These are the Laya checkpoints the converter resolves by short name, copied
from laya-coreml's conversion table so a Moka bundle and a Core ML bundle
of the same name can be compared:

| Short name | Hugging Face repo | Pinned revision |
| --- | --- | --- |
| `laya` | convaiinnovations/laya | `c5d78730f3493e4fe16d61507ef4b78eef7318cf` |
| `laya-multilingual` | convaiinnovations/laya-multilingual | `052592a15d198d9ad47da779604259b10b47b7aa` |
| `laya-typed-decisions` | convaiinnovations/laya-typed-decisions | `f9ab0b228f0fc0f14d873dbc99038f135c2da1b2` |

Example:

```bash
moka convert laya-typed-decisions models/typed
moka load  # from Python: moka.load("models/typed")
```

Or pin explicitly:

```bash
moka convert convaiinnovations/laya-typed-decisions models/typed \
  --revision f9ab0b228f0fc0f14d873dbc99038f135c2da1b2
```

## What 0.1.0 actually ships

| Artifact | Status |
| --- | --- |
| `moka` Python package (ORT inference, CLI, Snake) | yes |
| `moka[convert]` export graph | yes |
| Linux GitHub Actions (pytest + ruff) | yes |
| `moka-tiny` student ONNX (studio + CI) | yes, labelled as a student |
| Hub-converted 322M/421M ONNX | **not in this release** — conversion host RAM |
| CUDA / TensorRT / OpenVINO wheels tested | **not in this release** |
| INT8 as default | **no** — approximate, gated |

A later release that publishes Hub ONNX bundles must include the fidelity
JSON in the same commit as the weights, the way laya-coreml's
`docs/RELEASE.md` tables sit next to the Hub revisions.
