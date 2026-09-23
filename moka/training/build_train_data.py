#!/usr/bin/env python3
"""Build training JSONL disjoint from eval/frozen_eval.jsonl.

Construction-rule gold only. Does not copy eval labels. Overlap is
checked by SHA-256 of canonical {state, questions} JSON.
"""

from __future__ import annotations

import hashlib
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVAL = ROOT / "eval" / "frozen_eval.jsonl"
TRAIN = Path(__file__).resolve().parent / "data" / "train.jsonl"
VAL = Path(__file__).resolve().parent / "data" / "val.jsonl"

DEPT = {
    "billing": "invoices, payments, refunds, charges",
    "technical": "bugs, outages, errors, product breakage",
    "sales": "pricing, upgrades, new contracts",
    "other": "everything else",
}
URG = ["not urgent", "soon", "blocking or deadline today"]


def key(state, questions) -> str:
    payload = json.dumps(
        {"state": state, "questions": questions},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def rec(tid, domain, state, questions, answers):
    return {
        "id": tid,
        "split": "train",
        "domain": domain,
        "labeler": "construction-rule",
        "state": state,
        "questions": questions,
        "answers": answers,
    }


def C(ins, crit):
    return {"type": "choice", "instructions": ins, "criteria": crit}


def S(ins, crit):
    return {"type": "score", "instructions": ins, "criteria": crit}


def N(ins):
    return {"type": "noul", "instructions": ins}


def A(kind, index, label):
    return {"type": kind, "index": index, "label": label, "source": "construction-rule"}


def build(rng: random.Random) -> list[dict]:
    rows = []
    invoices = [f"INV-{2000 + i}" for i in range(60)]
    builds = [f"b{3000 + i}" for i in range(60)]
    seats = [6, 10, 18, 32, 64, 90]
    names = ["Ravi", "Ines", "Mateo", "Asha", "Jouko", "Priya"]
    cities = ["Lisbon", "Oslo", "Busan", "Recife", "Vilnius", "Hobart"]

    billing = [
        "{name} reports {inv} was captured twice. Reverse the extra capture.",
        "Card billed two times for {inv}. Credit the duplicate.",
    ]
    tech = [
        "payments-api on {build} returns 503 for /charge.",
        "Null pointer in worker after {build}. Jobs stuck in retry.",
    ]
    sales = [
        "{name} in {city} wants annual pricing for {n} seats and an MSA.",
        "Quote add-on analytics for {n} seats. Nothing is broken.",
    ]
    other = [
        "{name} asks how to enable dark mode. No payment or outage.",
        "Where is the public status page URL?",
    ]
    families = [
        ("billing", billing, 0, True, 2),
        ("technical", tech, 1, False, 2),
        ("sales", sales, 2, False, 1),
        ("other", other, 3, False, 0),
    ]
    n = 0
    for _ in range(80):
        domain, tmpls, di, refund, ui = families[n % 4]
        n += 1
        body = rng.choice(tmpls).format(
            name=rng.choice(names),
            inv=rng.choice(invoices),
            build=rng.choice(builds),
            n=rng.choice(seats),
            city=rng.choice(cities),
        )
        state = {"body": body, "ticket": f"TR-{20000 + n}"}
        questions = {
            "department": C("Which department should handle this?", DEPT),
            "refund": N("Does the customer request a refund or charge reversal?"),
            "urgency": S("How urgent is this request?", URG),
        }
        answers = {
            "department": A("choice", di, list(DEPT)[di]),
            "refund": A("noul", 1 if refund else 0, "true" if refund else "false"),
            "urgency": A("score", ui, URG[ui]),
        }
        rows.append(rec(f"syn-route-{n:04d}", domain, state, questions, answers))

    for j, wait in enumerate([2, 3, 5, 8, 14, 16, 21, 40, 50, 60] * 8):
        sla = 15
        breached = wait > sla
        if wait < sla * 0.6:
            idx = 0
        elif not breached:
            idx = 1
        else:
            idx = 2
        labels = ["healthy", "watch", "breached"]
        state = f"Oldest ticket age is {wait} minutes. Team SLA is {sla} minutes. Open tickets: {3 + j % 20}."
        questions = {
            "health": S("Queue health versus SLA", labels),
            "breached": N("Has the SLA already been breached?"),
        }
        answers = {
            "health": A("score", idx, labels[idx]),
            "breached": A("noul", 1 if breached else 0, "true" if breached else "false"),
        }
        rows.append(rec(f"syn-sla-{j:04d}", "numeric_score", state, questions, answers))

    for j in range(80):
        po = rng.choice([1200, 4400, 8800, 15000])
        inv = po if rng.random() < 0.5 else po + rng.choice([250, 900, 3000])
        match = inv == po
        state = f"Invoice {400 + j} is ${inv}. PO approved ${po}. Receipt posted ${po}. Not previously paid."
        questions = {
            "action": C(
                "Accounts-payable action",
                {"pay": "amounts match", "hold_mismatch": "amounts do not match"},
            ),
            "matched": N("Do invoice, PO, and receipt amounts agree?"),
        }
        answers = {
            "action": A("choice", 0 if match else 1, "pay" if match else "hold_mismatch"),
            "matched": A("noul", 1 if match else 0, "true" if match else "false"),
        }
        rows.append(rec(f"syn-ap-{j:04d}", "finance", state, questions, answers))

    for j in range(40):
        ok = j % 2 == 0
        state = (
            "Shipment contains vials that must stay at 2-8C. "
            + ("Refrigerated van V-9 is available." if ok else "The only van has a failed compressor.")
        )
        questions = {
            "dispatch": C(
                "Dispatch decision",
                {"send_cold": "working refrigerated van", "hold": "no working cold chain"},
            ),
            "ready": N("Is a working refrigerated van available?"),
        }
        answers = {
            "dispatch": A("choice", 0 if ok else 1, "send_cold" if ok else "hold"),
            "ready": A("noul", 1 if ok else 0, "true" if ok else "false"),
        }
        rows.append(rec(f"syn-cold-{j:04d}", "logistics", state, questions, answers))

    for j in range(40):
        leave = j % 2 == 0
        name = names[j % len(names)]
        if leave:
            state = f"{name} requests two days of unpaid leave next Wednesday."
            idx, lab = 0, "leave"
        else:
            state = f"{name} requests a replacement headset. The current one has static."
            idx, lab = 1, "equipment"
        questions = {
            "intent": C(
                "What is the employee asking for?",
                {"leave": "time off", "equipment": "hardware", "raise": "pay"},
            )
        }
        answers = {"intent": A("choice", idx, lab)}
        rows.append(rec(f"syn-hr-{j:04d}", "hr", state, questions, answers))

    return rows


def main() -> int:
    if not EVAL.is_file():
        print(f"missing {EVAL}", file=sys.stderr)
        return 2
    banned = {key(r["state"], r["questions"]) for r in load_jsonl(EVAL)}
    rng = random.Random(2026)
    kept = []
    seen = set()
    dropped_eval = 0
    dropped_dup = 0
    for row in build(rng):
        k = key(row["state"], row["questions"])
        if k in banned:
            dropped_eval += 1
            continue
        if k in seen:
            dropped_dup += 1
            continue
        seen.add(k)
        kept.append(row)
    rng.shuffle(kept)
    n_val = max(30, int(0.1 * len(kept)))
    val, train = kept[:n_val], kept[n_val:]
    for row in val:
        row["split"] = "val"
    TRAIN.parent.mkdir(parents=True, exist_ok=True)
    TRAIN.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in train), encoding="utf-8")
    VAL.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in val), encoding="utf-8")
    print(f"eval_keys={len(banned)}")
    print(f"kept={len(kept)} train={len(train)} val={len(val)}")
    print(f"collisions_with_eval={dropped_eval}")
    print(f"dropped_internal_dup={dropped_dup}")
    print(f"wrote {TRAIN}")
    print(f"wrote {VAL}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
