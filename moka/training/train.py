#!/usr/bin/env python3
"""Fine-tune ModernBERT-large DecisionModel for Moka-v1.

Refuses to start if eval/frozen_eval.jsonl does not match the recorded SHA-256.
Never opens that file as a training example.

Usage, from the package root, on a GPU machine:

    python -m pip install -e '.[convert]'
    python -m pip install transformers pyyaml
    python training/train.py --config training/config.yaml --dry-run
    python training/train.py --config training/config.yaml
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fixture_key(state, questions) -> str:
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


def load_config(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    try:
        import yaml

        return yaml.safe_load(text)
    except ImportError:
        cfg: dict = {}
        section = None
        for raw in text.splitlines():
            line = raw.split("#", 1)[0].rstrip()
            if not line.strip():
                continue
            if not line.startswith(" ") and line.endswith(":"):
                section = line[:-1]
                cfg[section] = {}
                continue
            if section is None or ":" not in line:
                continue
            key, val = line.strip().split(":", 1)
            val = val.strip().strip('"')
            if val.lower() in ("true", "false"):
                parsed: object = val.lower() == "true"
            else:
                try:
                    parsed = int(val) if "." not in val else float(val)
                except ValueError:
                    parsed = val
            cfg[section][key] = parsed
        return cfg


def flatten(rows: list[dict]) -> list[dict]:
    out = []
    for row in rows:
        for qid, definition in row["questions"].items():
            gold = row["answers"][qid]
            out.append(
                {
                    "id": f"{row['id']}::{qid}",
                    "state": row["state"],
                    "definition": definition,
                    "index": int(gold["index"]),
                }
            )
    return out


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=ROOT / "training" / "config.yaml")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    cfg = load_config(args.config)
    eval_path = ROOT / cfg["data"]["frozen_eval"]
    expected = str(cfg["data"]["frozen_eval_sha256"])
    if not eval_path.is_file():
        print(f"missing frozen eval: {eval_path}", file=sys.stderr)
        return 2
    actual = sha256_file(eval_path)
    if actual != expected:
        print(
            f"frozen eval hash mismatch: got {actual}, expected {expected}",
            file=sys.stderr,
        )
        return 2
    print(f"frozen eval lock ok sha256={actual}")

    banned = {fixture_key(r["state"], r["questions"]) for r in load_jsonl(eval_path)}
    train_rows = load_jsonl(ROOT / cfg["data"]["train"])
    val_rows = load_jsonl(ROOT / cfg["data"]["val"])
    for name, rows in (("train", train_rows), ("val", val_rows)):
        for row in rows:
            if fixture_key(row["state"], row["questions"]) in banned:
                print(f"{name} overlaps frozen eval: {row.get('id')}", file=sys.stderr)
                return 2
    train_ex = flatten(train_rows)
    val_ex = flatten(val_rows)
    print(f"train_rows={len(train_rows)} val_rows={len(val_rows)}")
    print(f"train_questions={len(train_ex)} val_questions={len(val_ex)}")
    print(f"backbone={cfg['model']['backbone']}")
    if args.dry_run:
        print("dry-run: lock and disjoint checks passed")
        return 0

    import random

    import torch
    from torch import nn
    from torch.nn import functional as F
    from transformers import AutoConfig, AutoModel, AutoTokenizer

    sys.path.insert(0, str(ROOT))
    from moka.common import QTYPES, build_sequence
    from moka.inputs import collate_items
    from moka.prompt import PromptMixin
    from moka.torch_model import DecisionModel, init_untrained

    seed = int(cfg["train"]["seed"])
    random.seed(seed)
    torch.manual_seed(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"device={device}")

    tokenizer = AutoTokenizer.from_pretrained(cfg["model"]["backbone"])
    raw = AutoConfig.from_pretrained(cfg["model"]["backbone"])
    encoder_cfg = {
        "model_type": "modernbert",
        "hidden_size": int(raw.hidden_size),
        "intermediate_size": int(raw.intermediate_size),
        "vocab_size": int(raw.vocab_size),
        "num_hidden_layers": int(raw.num_hidden_layers),
        "num_attention_heads": int(raw.num_attention_heads),
        "local_attention": int(getattr(raw, "local_attention", 128)),
        "global_attn_every_n_layers": int(getattr(raw, "global_attn_every_n_layers", 3)),
        "hidden_activation": "gelu",
    }
    agent_cfg = {
        "head_layers": int(cfg["model"]["head_layers"]),
        "act_costs": {"escalate": 0.5},
        "max_len": int(cfg["model"]["max_len"]),
        "head_max_len": int(cfg["model"]["head_max_len"]),
        "encoder": "moka-v1",
        "temperature": [1.0, 1.0, 1.0],
    }

    class TokAdapter:
        def __init__(self, backend):
            self.backend = backend
            self.mask_token = backend.mask_token or "[MASK]"
            self.cls_token = backend.cls_token or "[CLS]"
            self.sep_token = backend.sep_token or "[SEP]"
            self.pad_token = backend.pad_token or backend.unk_token
            self.mask_token_id = backend.mask_token_id
            self.cls_token_id = backend.cls_token_id
            self.sep_token_id = backend.sep_token_id
            self.pad_token_id = backend.pad_token_id

        def __call__(self, text, add_special_tokens=False):
            return {"input_ids": self.backend(text, add_special_tokens=add_special_tokens)["input_ids"]}

    tok = TokAdapter(tokenizer)
    model = DecisionModel(encoder_cfg, agent_cfg, agent_cfg["max_len"])
    init_untrained(model)
    hf = AutoModel.from_pretrained(cfg["model"]["backbone"])
    own = model.state_dict()
    mapped = 0
    dest = {k: v.clone() for k, v in own.items()}
    for key, tensor in hf.state_dict().items():
        name = key[6:] if key.startswith("model.") else key
        if name.startswith(("layers.", "embeddings.", "final_norm.")):
            name = "encoder." + name
        if name in dest and dest[name].shape == tensor.shape:
            dest[name] = tensor
            mapped += 1
    model.load_state_dict(dest, strict=True)
    del hf
    print(f"mapped {mapped} tensors from {cfg['model']['backbone']}")
    if mapped < 10:
        print("backbone mapping copied too few tensors", file=sys.stderr)
        return 2
    model.to(device)
    model.train()
    opt = torch.optim.AdamW(
        model.parameters(),
        lr=float(cfg["train"]["lr"]),
        weight_decay=float(cfg["train"]["weight_decay"]),
    )

    def encode_batch(examples):
        items, targets = [], []
        for ex in examples:
            q = PromptMixin._to_internal(ex["definition"])
            ids, markers = build_sequence(
                tok, ex["state"], q, agent_cfg["max_len"], agent_cfg["head_max_len"]
            )
            items.append({"ids": ids, "markers": markers, "qtype": QTYPES[q["t"]]})
            targets.append(min(ex["index"], len(markers) - 1))
        shape = {
            "batch_size": len(items),
            "max_length": agent_cfg["max_len"],
            "min_length": 16,
            "max_options": int(cfg["model"]["max_options"]),
            "flexible": True,
            "dynamic_batch": True,
        }
        arrays = collate_items(items, tok.pad_token_id, shape=shape)
        tensors = {k: torch.from_numpy(v).to(device=device, dtype=torch.long) for k, v in arrays.items()}
        return tensors, torch.tensor(targets, device=device)

    for epoch in range(int(cfg["train"]["epochs"])):
        random.shuffle(train_ex)
        running = 0.0
        steps = 0
        for start in range(0, len(train_ex), int(cfg["train"]["batch_size"])):
            batch = train_ex[start : start + int(cfg["train"]["batch_size"])]
            tensors, targets = encode_batch(batch)
            logits, _action = model(**tensors)
            loss = 0.0
            for i, target in enumerate(targets.tolist()):
                k = int(tensors["marker_mask"][i].sum().item())
                row = logits[i, :k]
                loss = loss + F.cross_entropy(row.unsqueeze(0), torch.tensor([target], device=device))
            loss = loss / max(len(batch), 1)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), float(cfg["train"]["grad_clip"]))
            opt.step()
            running += float(loss)
            steps += 1
        print(f"epoch {epoch} train_loss={running / max(steps, 1):.4f}")

    dest = Path(cfg["output"]["checkpoint_dir"]) / "final"
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "encoder").mkdir(exist_ok=True)
    (dest / "encoder" / "config.json").write_text(json.dumps(encoder_cfg, indent=2) + "\n")
    (dest / "rl_agent_config.json").write_text(json.dumps(agent_cfg, indent=2) + "\n")
    from safetensors.torch import save_file

    save_file({k: v.detach().cpu().contiguous() for k, v in model.state_dict().items()}, str(dest / "model.safetensors"))
    tokenizer.save_pretrained(dest / "tokenizer")
    print(f"saved {dest}")
    print("Next: moka convert checkpoints/moka-v1/final models/moka-v1")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
