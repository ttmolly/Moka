# Release

Moka 0.1.0 is a source release of the Linux runtime, conversion CLI, tests
and studio. Model weights are **not** in git.

## Hardware this checkout did not have

A 421M FP32 export keeps three weight-sized copies (Torch module, ONNX proto,
scratch) plus about 2 GiB for libtorch: **6.71 GiB MemAvailable** for
`laya` / `laya-typed-decisions`, **5.60 GiB** for `laya-multilingual`.
16 GiB physical RAM is the comfortable machine. 20 GiB free disk covers all
three bundles plus the Hugging Face cache.

`models/typed`, `models/english`, and `models/multi` are not produced here
and must not be filled with `moka-tiny`.

## Pinned upstream revisions

Configs at these revisions were fetched (a few KB). Hub `main` for
`convaiinnovations/laya` has moved; these pins stay so a Moka bundle and a
laya-coreml bundle of the same name can be compared.

| Short name | Hugging Face repo | Pinned revision | Context |
| --- | --- | --- | --- |
| `laya` | convaiinnovations/laya | `c5d78730f3493e4fe16d61507ef4b78eef7318cf` | 512 |
| `laya-multilingual` | convaiinnovations/laya-multilingual | `052592a15d198d9ad47da779604259b10b47b7aa` | 1024 |
| `laya-typed-decisions` | convaiinnovations/laya-typed-decisions | `f9ab0b228f0fc0f14d873dbc99038f135c2da1b2` | 1024 |

## Manual job (copy-paste)

Flags below match `moka convert --help` / `moka validate --help` /
`moka benchmark --help` in this tag. There is no `--laya` flag in 0.1.0:
official-package comparison is `pip install laya` plus a side-by-side of the
two `predict()` JSON files, or a later Moka release that adds the flag.

```bash
# From the package root (this file lives in docs/; `cd` there first if
# you cloned the monorepo):
python -m pip install -e '.[convert]'

moka convert laya-typed-decisions models/typed
moka convert laya models/english
moka convert laya-multilingual models/multi

# Optional pin (the short names already resolve to the table above):
# moka convert convaiinnovations/laya-typed-decisions models/typed \
#   --revision f9ab0b228f0fc0f14d873dbc99038f135c2da1b2

SNAP_TYPED="$HOME/.cache/huggingface/hub/models--convaiinnovations--laya-typed-decisions/snapshots/f9ab0b228f0fc0f14d873dbc99038f135c2da1b2"
SNAP_EN="$HOME/.cache/huggingface/hub/models--convaiinnovations--laya/snapshots/c5d78730f3493e4fe16d61507ef4b78eef7318cf"
SNAP_MULTI="$HOME/.cache/huggingface/hub/models--convaiinnovations--laya-multilingual/snapshots/052592a15d198d9ad47da779604259b10b47b7aa"

moka validate models/typed --reference "$SNAP_TYPED" --output fidelity-typed.json
moka validate models/english --reference "$SNAP_EN" --output fidelity-english.json
moka validate models/multi --reference "$SNAP_MULTI" --output fidelity-multi.json

# Batch-1 is the real predict() shape. The second call is a small batch.
moka benchmark models/typed --warmup 10 --runs 100 --questions 1 --output bench-typed.json
moka benchmark models/typed --warmup 5 --runs 50 --questions 8 --output bench-typed-batch.json
moka benchmark models/english --warmup 10 --runs 100 --questions 1 --output bench-english.json
moka benchmark models/multi --warmup 10 --runs 100 --questions 1 --output bench-multi.json
```

`moka validate` without `--reference` only checks self-consistency of the
ONNX bundle. Pass `--reference` pointing at the original safetensors snapshot
to run the export-graph PyTorch gate. A failed row must keep `"passed": false`.

INT8 is not a default:

```bash
moka convert laya models/english-int8 --quantize int8
moka validate models/english-int8 --reference "$SNAP_EN" --output fidelity-english-int8.json
```

Ship INT8 only if that JSON has `"passed": true`.

After the commands finish, send back the `fidelity-*.json` and `bench-*.json`
files. Docs will take the numbers exactly as reported. No blanket
"Moka beats Laya" line — each row is scoped to that JSON.

## What 0.1.0 actually ships

| Artifact | Status |
| --- | --- |
| `moka` Python package (ORT inference, CLI, Snake) | yes |
| `moka[convert]` export graph | yes |
| Linux GitHub Actions (build tiny bundle, pytest, ruff) | yes |
| `moka-tiny` ONNX (studio + CI) | yes — distilled reference model, not Laya |
| Hub-converted `models/typed`, `models/english`, `models/multi` | **no** — conversion host RAM |
| CUDA / TensorRT / OpenVINO wheels tested | **no** |
| INT8 as default | **no** — approximate, gated |
