# Install, convert, and make typed decisions

Moka runs on Linux with Python 3.10–3.13. The local release checks use an
Intel Xeon Platinum 8481C (2 cores, ~4 GiB RAM, no NVIDIA GPU). CUDA and
TensorRT paths are implemented but were not executed on that host.

```bash
python -m pip install moka
python -m pip install 'moka[demo]'      # terminal Snake
python -m pip install 'moka[convert]'   # export from original checkpoints
```

Inference installs ONNX Runtime, NumPy, Tokenizers, Safetensors and Hugging Face
Hub. It does not require PyTorch or Transformers. The optional `[convert]` extra
installs PyTorch for exporting the original checkpoints.

## Select a model

| Bundle | Default engine | Capacity | Purpose |
| --- | --- | --- | --- |
| Local `moka convert` of `convaiinnovations/laya` | CPU EP | 512 tokens | English ModernBERT-large, 421M |
| Local `moka convert` of `convaiinnovations/laya-typed-decisions` | CPU EP | 1024 tokens | Typed-decisions fine-tune, 421M |
| Local `moka convert` of `convaiinnovations/laya-multilingual` | CPU EP | 1024 tokens | mmBERT-base, 322M |
| `moka-tiny` (shipped student) | CPU EP / WASM | 96 tokens | CI, studio, fidelity plumbing |

`moka-tiny` is a compact student trained on synthetic triage and Snake
scaffolds. It is **not** a Hub Laya checkpoint. It exists so the conversion
graph, ORT session, calibration and Snake policy can be run on a 2-core CI
box. Treat its answers as a demo of the *runtime*, not a claim about Laya
task accuracy.

## Python API

```python
import moka

agent = moka.load("./models/typed")
result = agent.predict(
    "The customer asks for a refund of a duplicate payment.",
    {
        "department": {
            "type": "choice",
            "instructions": "Which department should handle this request?",
            "criteria": {
                "billing": "Payments, invoices, refunds, and duplicate charges.",
                "technical": "Broken features, errors, and product troubleshooting.",
                "sales": "Pricing, upgrades, and new purchases.",
            },
        },
        "urgency": {
            "type": "score",
            "instructions": "How urgent is this?",
            "criteria": ["not urgent", "soon", "blocking"],
        },
        "refund": {
            "type": "noul",
            "instructions": "Does the customer request a refund?",
        },
    },
)
print(result["answers"])
```

`choice` returns a selected label and a probability for every label. `score`
returns the expected zero-based category index, its legend and probabilities.
`noul` returns the probability of true. Answers also include upstream confidence
and action-head probability fields. `usage.output_tokens` is always 0.

```python
agent = moka.load("./models/typed", provider="cuda")       # NVIDIA
agent = moka.load("./models/typed", provider="openvino")   # Intel, opt-in
agent = moka.load("./models/typed", provider="tensorrt")   # opt-in, gated
agent = moka.load("./models/typed", deterministic=True)    # threads=1, no mem arena
```

`provider="auto"` is **CPU only**. GPU is never implicit.

Following upstream v0.3.5, fitted calibration temperatures are clamped to
`[0.5, 5.0]` before use. Raw values remain on `agent.temperature_raw` and
`agent.temperature_by_options_raw`. A `RuntimeWarning` names every clamped
bucket at load.

## CLI

```bash
moka convert <source> <output-dir> [--precision fp32|fp16] [--quantize int8]
moka predict <bundle> --state "..." --questions questions.json
moka validate <bundle> --reference <original-checkpoint>
moka benchmark <bundle> --runs 100 --questions 1
moka-snake --model <bundle> --headless --steps 200 --record snake.json
```

`--offline` / `local_files_only=True` refuses Hub access.

## Convert from source

```bash
pip install 'moka[convert]'
moka convert convaiinnovations/laya-typed-decisions models/typed
moka convert laya-multilingual models/multi --max-length 96
moka convert laya models/english-int8 --quantize int8
```

See [CONVERSION.md](CONVERSION.md) for the graph, shape contract, and the
experiments that did not ship.
