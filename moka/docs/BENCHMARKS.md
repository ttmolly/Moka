# Benchmarks

Numbers on this page are **measured on the conversion host** or explicitly
marked as not measured. Nothing here is an estimate of ANE, M3 Max, or a
T4 GPU.

## Host

| Field | Value |
| --- | --- |
| CPU | Intel Xeon Platinum 8481C @ 2.70 GHz |
| Cores | 2 |
| RAM | ~4 GiB |
| GPU | none (no NVIDIA device, no nvidia-smi) |
| OS | Linux x86_64 |
| Python | 3.10 |
| ONNX Runtime | 1.23.2 (CPU Execution Provider) |
| PyTorch | 2.14.0+cpu (baseline only) |
| Energy | RAPL sysfs not readable; no figure is reported |

## Methodology

- End-to-end wall time includes prompt construction, tokenization, input
  arrays, `InferenceSession.run`, calibration and result formatting.
- Loading and warmup calls are excluded.
- P50 / P95 over the recorded sample. Throughput is `1000 / mean_ms`
  decisions per second for that call shape.
- Jobs run sequentially. `deterministic=False` for speed, `True` for the
  fidelity gate.
- Energy: RAPL `energy_uj` is the planned CPU sensor. It was **not
  readable** on this host. nvidia-smi was **not present**. The JSON records
  `energy.available = false` and a reason instead of a made-up joule.

## Results

Host: Intel Xeon Platinum 8481C @ 2.70 GHz, 2 cores, ~4 GiB RAM, no GPU.
ONNX Runtime 1.23.2 CPU EP. Tiny student graph (`moka-tiny`, hidden 64, 4 layers).
40 measured calls after 8 warmup. JSON: `benchmarks/results/`.

| Implementation | P50 | P95 | decisions/s |
| --- | ---: | ---: | ---: |
| PyTorch eager `DecisionModel` forward | 2.97 ms | 3.60 ms | 324 |
| **ORT CPU FP32 (Moka)** | **2.45 ms** | **2.67 ms** | **407** |

Speedup vs eager: **1.21×**. Not 10×. The student is small enough that Python
overhead dominates; ORT still wins, and the win is the compiled graph plus
the fact that inference no longer imports PyTorch.

Energy: RAPL unread; nvidia-smi absent. `energy.available = false`.

Snake (headless, 180 steps, seed 7, 12×8): score 13, 6 shield interventions,
233 decisions/s including inference, still alive. JSON:
`benchmarks/results/snake-tiny.json`.


## Comparison contract

A speedup is only a speedup against **the same checkpoint, the same
questions, the same host**:

| Implementation | What it is |
| --- | --- |
| PyTorch eager `DecisionModel` | Baseline |
| ORT CPU FP32 | Default Moka runtime |
| ORT CPU INT8 | Approximate, gated |
| ORT CUDA / TensorRT / OpenVINO | Not measured here |

If INT8 is slower than FP32 on CPU (it can be, for small graphs), that is
the result. Package-size reduction is not a speed ratio.

## Snake

Headless `moka-snake --max-speed --steps 200` logs decisions/sec and
safety interventions. Terminal painting is excluded from the rate, matching
laya-coreml's game-loop notes.
