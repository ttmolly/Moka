#!/usr/bin/env python3
"""Train a compact DecisionModel student and export a Moka ONNX bundle.

This is NOT the 322M/421M Hub checkpoint. It exists so Linux CI, the fidelity
gate, and the in-browser studio can run a real ONNX graph end-to-end on a
2-core host. The conversion CLI for the original Laya weights is the same path.
"""

from __future__ import annotations

import json
import random
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import torch
from safetensors.torch import save_file
from tokenizers import Tokenizer
from tokenizers.models import WordLevel
from tokenizers.pre_tokenizers import Punctuation, Sequence, WhitespaceSplit
from torch import nn
from torch.nn import functional as F

from moka.common import QTYPES, build_sequence
from moka.convert import convert
from moka.inputs import collate_items
from moka.prompt import PromptMixin
from moka.torch_model import DecisionModel, init_untrained

WORDS = """
[UNK] [CLS] [SEP] [MASK] [PAD]
. , : ? !
choice score noul question pick a b c d billing technical sales other
Safe Best route food yes no true false refund invoice duplicate charge
today please customer request money back department handle email
urgency urgent soon critical deadline blocking issue invoices payments
refunds bugs outages system errors pricing new contracts everything else
Blocked Collision Unsafe Traps snake Eat now slower progress toward
available reachable empty cells sample Which How Does Is Select Choose
the safest move with best collisions Avoid of for this and or we will
cancel our plan were billed twice March I was charged invoice
UP DOWN LEFT RIGHT
not not-urgent
level low high
task choose description reason
body from subject message
""".split()


def build_vocab():
    vocab = {}
    for token in WORDS:
        if token and token not in vocab:
            vocab[token] = len(vocab)
    # Keep room for unseen training tokens.
    return vocab


def save_tokenizer(path: Path, vocab: dict):
    path.mkdir(parents=True, exist_ok=True)
    tok = Tokenizer(WordLevel(vocab, unk_token="[UNK]"))
    tok.pre_tokenizer = Sequence([WhitespaceSplit(), Punctuation()])
    tok.save(str(path / "tokenizer.json"))
    (path / "tokenizer_config.json").write_text(
        json.dumps(
            {
                "cls_token": "[CLS]",
                "sep_token": "[SEP]",
                "mask_token": "[MASK]",
                "pad_token": "[PAD]",
            }
        )
    )
    (path / "vocab.json").write_text(json.dumps(vocab, indent=2) + "\n")
    return tok


class TokAdapter:
    def __init__(self, backend: Tokenizer, vocab: dict):
        self.backend = backend
        self.mask_token = "[MASK]"
        self.cls_token = "[CLS]"
        self.sep_token = "[SEP]"
        self.pad_token = "[PAD]"
        self.mask_token_id = vocab["[MASK]"]
        self.cls_token_id = vocab["[CLS]"]
        self.sep_token_id = vocab["[SEP]"]
        self.pad_token_id = vocab["[PAD]"]

    def __call__(self, text, add_special_tokens=False):
        return {"input_ids": self.backend.encode(text, add_special_tokens=add_special_tokens).ids}


def examples(rng: random.Random):
    items = []
    departments = ["billing", "technical", "sales", "other"]
    for _ in range(80):
        target = rng.choice(departments)
        state = {
            "billing": "I was charged twice for invoice please refund it today.",
            "technical": "The system errors and outages block our plan.",
            "sales": "Please send pricing for new contracts.",
            "other": "Hello this is everything else.",
        }[target]
        items.append(
            (
                state,
                {
                    "department": {
                        "type": "choice",
                        "instructions": "Which department should handle this email?",
                        "criteria": {
                            "billing": "invoices payments refunds",
                            "technical": "bugs outages system errors",
                            "sales": "pricing new contracts",
                            "other": "everything else",
                        },
                    }
                },
                {"department": departments.index(target)},
            )
        )
        items.append(
            (
                state,
                {"refund": {"type": "noul", "instructions": "Does the customer request a refund?"}},
                {"refund": 1 if target == "billing" else 0},
            )
        )
        items.append(
            (
                state,
                {
                    "urgency": {
                        "type": "score",
                        "instructions": "How urgent is this request?",
                        "criteria": ["not urgent", "soon", "critical deadline or blocking issue"],
                    }
                },
                {"urgency": 2 if target == "technical" else 1 if target == "billing" else 0},
            )
        )
    # Compact snake-style prompts: the label is the option whose text contains Best.
    directions = ["UP", "DOWN", "LEFT", "RIGHT"]
    for _ in range(120):
        best = rng.choice(directions)
        reachable = rng.choice([True, False])
        safe = rng.choice([True, False])
        criteria = {}
        for d in directions:
            if d == best:
                criteria[d] = "Safe. Best route to food."
            elif rng.random() < 0.4:
                criteria[d] = "Blocked. Collision."
            elif rng.random() < 0.5:
                criteria[d] = "Unsafe. Traps the snake."
            else:
                criteria[d] = "Safe. Slower route."
        state = (
            f"Safe route: {'yes' if safe else 'no'}. "
            f"Food reachable through empty cells: {'yes' if reachable else 'no'}."
        )
        items.append(
            (
                state,
                {
                    "move": {
                        "type": "choice",
                        "instructions": "Choose the best safe move toward food.",
                        "criteria": criteria,
                    },
                    "risk": {"type": "noul", "instructions": "Is a safe route available?"},
                    "food": {
                        "type": "noul",
                        "instructions": "Is food reachable through empty cells?",
                    },
                },
                {"move": directions.index(best), "risk": int(safe), "food": int(reachable)},
            )
        )
    rng.shuffle(items)
    return items


def collate_training(tok, cfg, batch):
    items, targets, types, counts = [], [], [], []
    for state, questions, labels in batch:
        for qid, definition in questions.items():
            q = PromptMixin._to_internal(definition)
            ids, markers = build_sequence(
                tok, state, q, cfg["max_len"], cfg["head_max_len"]
            )
            items.append({"ids": ids, "markers": markers, "qtype": QTYPES[q["t"]]})
            targets.append(labels[qid])
            types.append(q["t"])
            counts.append(len(markers))
    shape = {
        "batch_size": len(items),
        "max_length": cfg["max_len"],
        "min_length": 16,
        "max_options": 8,
        "flexible": True,
        "dynamic_batch": True,
    }
    arrays = collate_items(items, tok.pad_token_id, shape=shape)
    tensors = {k: torch.from_numpy(v).long() for k, v in arrays.items()}
    return tensors, torch.tensor(targets), types, counts


def train(source_dir: Path):
    rng = random.Random(2026)
    torch.manual_seed(2026)
    vocab = build_vocab()
    backend = save_tokenizer(source_dir / "tokenizer", vocab)
    tok = TokAdapter(backend, vocab)
    encoder_cfg = {
        "model_type": "modernbert",
        "hidden_size": 64,
        "intermediate_size": 128,
        "vocab_size": max(vocab.values()) + 1,
        "num_hidden_layers": 4,
        "num_attention_heads": 4,
        "local_attention": 16,
        "global_attn_every_n_layers": 2,
        "hidden_activation": "gelu",
    }
    agent_cfg = {
        "head_layers": 2,
        "act_costs": {"escalate": 0.5},
        "max_len": 96,
        "head_max_len": 48,
        "encoder": "moka-tiny",
        "temperature": [1.0, 1.0, 1.0],
    }
    (source_dir / "encoder").mkdir(parents=True, exist_ok=True)
    (source_dir / "encoder/config.json").write_text(json.dumps(encoder_cfg, indent=2) + "\n")
    (source_dir / "rl_agent_config.json").write_text(json.dumps(agent_cfg, indent=2) + "\n")

    model = DecisionModel(encoder_cfg, agent_cfg, agent_cfg["max_len"])
    init_untrained(model)
    model.train()
    opt = torch.optim.AdamW(model.parameters(), lr=3e-3, weight_decay=0.01)
    data = examples(rng)
    steps = 80
    batch_size = 8
    for step in range(steps):
        batch = [data[rng.randrange(len(data))] for _ in range(batch_size)]
        tensors, targets, types, counts = collate_training(tok, agent_cfg, batch)
        logits, _action = model(**tensors)
        loss = 0.0
        n = 0
        for i, (target, kind, k) in enumerate(zip(targets.tolist(), types, counts)):
            row = logits[i, :k]
            if kind == "noul":
                # option 0 = false, option 1 = true
                loss = loss + F.cross_entropy(row.unsqueeze(0), torch.tensor([target]))
            else:
                loss = loss + F.cross_entropy(row.unsqueeze(0), torch.tensor([target]))
            n += 1
        loss = loss / max(n, 1)
        opt.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        if step % 20 == 0 or step == steps - 1:
            print(f"train step {step} loss={float(loss):.4f}", flush=True)
    model.eval()
    save_file(model.state_dict(), str(source_dir / "model.safetensors"))
    return source_dir, agent_cfg


def main():
    artifacts = ROOT / "artifacts" / "tiny-source"
    if artifacts.exists():
        shutil.rmtree(artifacts)
    artifacts.mkdir(parents=True)
    train(artifacts)
    out = ROOT / "artifacts" / "moka-tiny"
    if out.exists():
        shutil.rmtree(out)
    convert(
        artifacts,
        out,
        max_length=96,
        batch_size=8,
        max_options=8,
        precision="fp32",
        attention="explicit",
    )
    public = Path("/workspace/public/models/moka-tiny")
    if public.exists():
        shutil.rmtree(public)
    shutil.copytree(out, public)
    print(f"bundle -> {out}")
    print(f"studio copy -> {public}")


if __name__ == "__main__":
    main()
