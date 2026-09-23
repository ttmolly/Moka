# Moka

**Open-weight typed decisions on Linux. ONNX Runtime, no generated tokens.**

A Linux-native inference backend for the [Laya](https://huggingface.co/convaiinnovations/laya)
typed-decision models — the same role [laya-coreml](https://github.com/mizorewww/laya-coreml)
plays on Apple Silicon. Core ML and the Apple Neural Engine do not exist here.

This is **not** `pip install transformers` and a `.predict()` wrapper. Moka ships
an export-only ModernBERT graph, a conversion CLI that writes a self-contained
ONNX bundle (weights, tokenizer, config, checksums, provenance), a drift-gated
fidelity harness against the PyTorch export graph, and a Snake demo driven by
live model probabilities plus a cycle-safety shield.

Independent community port. Not an official Convai Innovations or laya-coreml release.

## Backend choice

| Path | Role in Moka |
| --- | --- |
| **ONNX Runtime CPU EP** | Default. Runs on every Linux box this project can test. |
| **CUDA EP** | Opt-in (`provider="cuda"` / `moka[cuda]`) when an NVIDIA GPU is present. |
| **TensorRT EP** | Opt-in only. Can change numerics; must pass the fidelity gate. Never implicit. |
| **OpenVINO EP** | Opt-in (`moka[openvino]`) for Intel CPUs. Not the default: it is not portable to AMD/ARM. |
| **INT8 dynamic quant** | Optional, labelled approximate. Same idea as laya-coreml's W8 palette. Not the silent default. |
| PyTorch eager | Baseline to beat, not the shipped runtime. |

CPU is the default because CUDA and TensorRT are absent from many Linux hosts,
and TensorRT has a history of passing speed tests while failing answer-match
gates. If a path does not pay off, it is documented as such rather than hidden.

**This checkout did not convert the official checkpoints.** A 421M FP32 export
needs about 6.7 GiB MemAvailable; the conversion hosts used so far have been
short of that with no swap. `models/typed`, `models/english`, and `models/multi`
are not in git. Commands to produce them: [moka/docs/RELEASE.md](moka/docs/RELEASE.md).

CI and the optional studio run a compact `moka-tiny` student through the **same**
export graph. That student is a distilled reference model, not Laya.

## Install

```bash
pip install moka
# conversion (PyTorch) and the terminal Snake UI:
pip install 'moka[convert,demo]'
```

```python
import moka

# replace with models/typed once you've converted it yourself — see RELEASE.md
agent = moka.load("./artifacts/moka-tiny")
result = agent.predict(
    "The customer requests a refund of a duplicate payment.",
    {
        "refund": {
            "type": "noul",
            "instructions": "Does the customer request a refund?",
        }
    },
)
print(result["answers"]["refund"])
```

To exercise the graph without a Hub conversion, build the distilled student
(not Laya) with `python scripts/build_tiny_bundle.py` and load
`./artifacts/moka-tiny`.

`choice` returns a selected label and a probability for every label. `score`
returns the expected zero-based category index, its legend and probabilities.
`noul` returns the probability of true. Output tokens are always 0.

Following upstream v0.3.5, fitted calibration temperatures are clamped to
`[0.5, 5.0]` before use.

## Convert

```bash
moka convert convaiinnovations/laya-typed-decisions models/typed
moka convert convaiinnovations/laya models/english
moka convert convaiinnovations/laya-multilingual models/multi
# optional approximate variant — not the default:
moka convert convaiinnovations/laya models/english-int8 --quantize int8
```

The output directory is a self-contained bundle: `model.onnx`, tokenizer,
`encoder/config.json`, `rl_agent_config.json`, `moka_config.json` (provenance
and checksums). Nobody needs the original training checkout to run it.

## Validate and measure

```bash
moka validate models/typed --reference ~/.cache/huggingface/.../laya-typed-decisions
moka benchmark models/typed --runs 100 --questions 1
moka-snake --model models/typed --headless --steps 200 --record snake.json
```

The fidelity gate reports **exact selected-answer match rate** and **max
calibrated probability drift**. A bundle that misses the budget is not a
default. See [docs/FIDELITY.md](docs/FIDELITY.md).

## Layout

```
moka/           runtime, conversion, fidelity, Snake
tests/          unit + conversion integration
docs/           USAGE, CONVERSION, BENCHMARKS, RELEASE, FIDELITY
examples/       shared fixtures (email state + typed questions)
.github/        Linux CI
```

## License

Apache-2.0. See [NOTICE](NOTICE) for attribution to Convai Innovations, Laya,
laya-mlx and laya-coreml.
