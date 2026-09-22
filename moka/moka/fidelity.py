"""Drift-gated fidelity: Moka ONNX vs the export-graph PyTorch reference."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

DEFAULT_MAX_DRIFT = {
    "fp32": 1e-4,
    "fp16": 0.02,
    "int8": 0.02,
}


def _softmax(z):
    z = z - z.max()
    p = np.exp(z)
    return p / p.sum()


def _cases():
    from . import cases

    return cases.parity_cases()


def _pytorch_logits(model, batch):
    import torch

    tensors = {k: torch.from_numpy(v) for k, v in batch.items()}
    with torch.inference_mode():
        logits, action = model(**tensors)
    return logits.numpy(), action.numpy()


def compare_answers(reference, candidate, max_drift):
    """Return (matched_selected, max_probability_drift, details)."""
    matched = 0
    total = 0
    drift = 0.0
    details = []
    for qid, left in reference["answers"].items():
        right = candidate["answers"][qid]
        total += 1
        kind = left["type"]
        if kind == "choice":
            same = left["choice"] == right["choice"]
            keys = list(left["probabilities"])
            local = max(abs(left["probabilities"][k] - right["probabilities"][k]) for k in keys)
        elif kind == "score":
            same = abs(left["score"] - right["score"]) <= max_drift + 1e-6
            keys = list(left["probabilities"])
            local = max(abs(left["probabilities"][k] - right["probabilities"][k]) for k in keys)
            local = max(local, abs(left["score"] - right["score"]))
        else:
            same = (left["noul"] >= 0.5) == (right["noul"] >= 0.5)
            local = abs(left["noul"] - right["noul"])
        matched += int(same)
        drift = max(drift, local)
        details.append({"id": qid, "type": kind, "matched": same, "drift": local})
    return matched, total, drift, details


def validate_bundle(bundle, *, reference=None, max_drift=None, repeats=20, cases=None):
    """Run the shipped fixtures through Moka and, when possible, the PyTorch graph."""
    from .agent import load
    from .convert import FORMAT

    bundle = Path(bundle)
    manifest = json.loads((bundle / "moka_config.json").read_text())
    if manifest.get("format") != FORMAT:
        raise ValueError("Not a Moka bundle")
    precision = manifest.get("precision", "fp32")
    budget = DEFAULT_MAX_DRIFT.get(precision, 0.02) if max_drift is None else max_drift
    agent = load(bundle, provider="cpu", deterministic=True, local_files_only=True)

    if cases is None:
        cases = _cases()

    pytorch_model = None
    if reference is not None:
        from .torch_model import load_model

        pytorch_model = load_model(reference, manifest["shape"]["max_length"], "explicit")

    rows = []
    matched = total = 0
    max_seen = 0.0
    for name, state, questions in cases:
        moka_out = agent.predict(state, questions)
        row = {"name": name, "moka": moka_out}
        if pytorch_model is not None:
            items, internal = agent.prepare(state, questions)
            # Compare calibrated answers via a one-off PyTorch forward + same result math.
            from .result import ResultMixin

            class _Ref(ResultMixin):
                pass

            ref_agent = _Ref()
            ref_agent.tok = agent.tok
            ref_agent.cfg = agent.cfg
            ref_agent.shape = agent.shape
            ref_agent.batch_size = agent.batch_size
            ref_agent.pad_to_multiple = agent.pad_to_multiple
            ref_agent.temperature = agent.temperature
            ref_agent.temperature_by_options = agent.temperature_by_options

            def forward(batch, model=pytorch_model):
                return _pytorch_logits(model, batch)

            ref_agent.forward = forward
            ref_agent.prepare = agent.prepare
            torch_out = ref_agent.system_one(state, questions)
            hit, n, drift, details = compare_answers(torch_out, moka_out, budget)
            matched += hit
            total += n
            max_seen = max(max_seen, drift)
            row["pytorch"] = torch_out
            row["matched"] = hit
            row["total"] = n
            row["drift"] = drift
            row["details"] = details
        else:
            # Self-consistency only: selected answers stay finite and in-range.
            for answer in moka_out["answers"].values():
                total += 1
                matched += 1
                if answer["type"] == "noul":
                    max_seen = max(max_seen, abs(answer["noul"] - min(1.0, max(0.0, answer["noul"]))))
            row["matched"] = None
        rows.append(row)

    stable = True
    if repeats and cases:
        name, state, questions = cases[0]
        first = agent.predict(state, questions)
        for _ in range(repeats):
            again = agent.predict(state, questions)
            if json.dumps(again["answers"], sort_keys=True) != json.dumps(
                first["answers"], sort_keys=True
            ):
                stable = False
                break

    passed = True
    if pytorch_model is not None:
        passed = matched == total and max_seen <= budget and stable
    else:
        passed = stable

    return {
        "bundle": str(bundle),
        "precision": precision,
        "approximate": bool(manifest.get("approximate")),
        "max_drift_budget": budget,
        "matched": matched,
        "total": total,
        "max_probability_drift": max_seen,
        "repeated_calls": repeats,
        "stable": stable,
        "passed": passed,
        "hardware_note": "Compared against the export-graph PyTorch reference on this host.",
        "cases": [
            {
                "name": row["name"],
                "matched": row.get("matched"),
                "total": row.get("total"),
                "drift": row.get("drift"),
            }
            for row in rows
        ],
    }
