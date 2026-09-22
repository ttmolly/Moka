"""Validation fixtures from laya-mlx / laya-coreml (Apache-2.0); see NOTICE."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def workload(count=3, long=False):
    state = json.loads((ROOT / "examples/state.json").read_text())
    definitions = list(json.loads((ROOT / "examples/questions.json").read_text()).values())
    if long:
        state["body"] = "The customer reports duplicate billing and requests a refund today. " * 20
    questions = {f"q{i}": definitions[i % len(definitions)] for i in range(count)}
    return state, questions


def parity_cases():
    state, questions = workload()
    cases = [("email", state, questions)]
    messages = {
        "en": "I was charged twice for invoice 4411, please refund it today.",
        "zh": "invoice 4411 duplicate charge refund today.",
        "de": "I was charged twice for invoice 4411, please refund it today.",
        "fr": "I was charged twice for invoice 4411, please refund it today.",
        "es": "I was charged twice for invoice 4411, please refund it today.",
        "hi": "I was charged twice for invoice 4411, please refund it today.",
        "ja": "I was charged twice for invoice 4411, please refund it today.",
        "ru": "I was charged twice for invoice 4411, please refund it today.",
    }
    for lang, message in messages.items():
        cases.append((lang, {"message": message}, questions))
    cases.extend(
        [
            ("empty_state", "", questions),
            ("long", *workload(3, long=True)),
            ("conversation", [{"role": "user", "content": messages["en"]}], questions),
            ("mask_literals", "[MASK] <mask> hello [MASK] <mask>", questions),
            (
                "structured",
                state,
                {
                    "choice": {
                        "type": "choice",
                        "instructions": {"task": "choose department"},
                        "criteria": {"billing": {"description": "refunds"}, "other": False},
                    },
                    "score": {
                        "type": "score",
                        "instructions": "Urgency?",
                        "criteria": [{"level": "low"}, "high"],
                    },
                    "noul": {
                        "type": "noul",
                        "instructions": "Refund?",
                        "criteria": {"true": {"reason": "money back"}},
                    },
                },
            ),
            (
                "twenty_options",
                state,
                {
                    "choice": {
                        "type": "choice",
                        "instructions": "Which department handles billing?",
                        "criteria": ["billing"] + [f"department_{i}" for i in range(7)],
                    },
                },
            ),
        ]
    )
    return cases
