"""Fail if eval/frozen_eval.jsonl changes after the recorded digest."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVAL = ROOT / "eval" / "frozen_eval.jsonl"

# sha256sum output recorded when the freeze was committed:
# ff6e662a9fb1c2f3c39a7f91200b73b2115a7072063468c2c815a8053a1cd098  frozen_eval.jsonl
EXPECTED_SHA256 = "ff6e662a9fb1c2f3c39a7f91200b73b2115a7072063468c2c815a8053a1cd098"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def test_frozen_eval_exists():
    assert EVAL.is_file(), f"missing {EVAL}"


def test_frozen_eval_hash_locked():
    actual = sha256_file(EVAL)
    assert actual == EXPECTED_SHA256, (
        f"frozen eval hash changed: got {actual}, expected {EXPECTED_SHA256}"
    )


def test_frozen_eval_has_all_types():
    rows = [json.loads(line) for line in EVAL.read_text(encoding="utf-8").splitlines() if line.strip()]
    kinds = {q["type"] for row in rows for q in row["questions"].values()}
    assert kinds == {"choice", "score", "noul"}
    assert all(row.get("labeler") == "construction-rule" for row in rows)
