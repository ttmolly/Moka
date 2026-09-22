"""Latency / throughput measurement. Numbers are measured, never invented."""

from __future__ import annotations

import os
import platform
import time

import numpy as np


def hardware_report():
    cpu = platform.processor() or platform.machine()
    try:
        with open("/proc/cpuinfo") as handle:
            for line in handle:
                if line.startswith("model name"):
                    cpu = line.split(":", 1)[1].strip()
                    break
    except OSError:
        pass
    cores = os.cpu_count() or 1
    ram_kb = None
    try:
        with open("/proc/meminfo") as handle:
            for line in handle:
                if line.startswith("MemTotal"):
                    ram_kb = int(line.split()[1])
                    break
    except OSError:
        pass
    return {
        "cpu": cpu,
        "cores": cores,
        "ram_bytes": None if ram_kb is None else ram_kb * 1024,
        "machine": platform.machine(),
        "platform": platform.platform(),
        "python": platform.python_version(),
        "gpu": None,
    }


def percentile(samples, q):
    if samples is None:
        return None
    arr = np.asarray(samples, dtype=np.float64)
    if arr.size == 0:
        return None
    return float(np.percentile(arr, q))


def run_benchmark(
    bundle,
    *,
    warmup=10,
    runs=100,
    questions=1,
    provider="auto",
    state=None,
    question_defs=None,
):
    from .agent import load
    from .cases import workload
    from .energy import EnergySampler

    if state is None or question_defs is None:
        state, question_defs = workload(count=questions)
    agent = load(bundle, provider=provider, local_files_only=True)
    for _ in range(warmup):
        agent.predict(state, question_defs)

    samples = []
    energy = EnergySampler()
    energy.start()
    for _ in range(runs):
        started = time.perf_counter()
        agent.predict(state, question_defs)
        samples.append((time.perf_counter() - started) * 1000)
    energy_report = energy.stop(n=runs)

    ms = np.asarray(samples, dtype=np.float64)
    p50 = percentile(ms, 50)
    p95 = percentile(ms, 95)
    mean = float(ms.mean())
    throughput = 1000.0 / mean if mean else None
    import onnxruntime as ort

    return {
        "bundle": str(bundle),
        "provider_requested": provider,
        "provider_active": agent.provider,
        "questions_per_call": questions,
        "warmup": warmup,
        "runs": runs,
        "p50_ms": p50,
        "p95_ms": p95,
        "mean_ms": mean,
        "min_ms": float(ms.min()),
        "max_ms": float(ms.max()),
        "decisions_per_sec": throughput,
        "hardware": hardware_report(),
        "onnxruntime": ort.__version__,
        "energy": energy_report,
        "notes": [
            "Wall time includes prompt construction, tokenization, ORT session.run, calibration and formatting.",
            "Loading and warmup are excluded.",
            "Energy is RAPL when the counter is readable; otherwise omitted with a reason.",
        ],
    }
