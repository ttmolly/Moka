"""Reproducible ONNX export from original Laya checkpoints.

The export loads original Laya safetensors into FP32 PyTorch modules, checks
state-dict keys strictly, and writes an ONNX graph plus a self-contained bundle
(tokenizer, configs, checksums, provenance). Inference does not need PyTorch.

Default attention lowering is the explicit matmul/softmax path. SDPA is kept
as a conversion experiment: it can emit ops the CPU Execution Provider cannot
run, and is not the shipped default.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import time
from pathlib import Path

from .hub import SOURCE_REVISIONS

FORMAT = "moka-onnx"
FORMAT_VERSION = 1


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024**2), b""):
            digest.update(block)
    return digest.hexdigest()


def resolve_source(source, revision=None):
    path = Path(source).expanduser()
    if path.is_dir():
        return path
    if path.is_absolute() or str(source).startswith((".", "~")):
        raise FileNotFoundError(source)
    from huggingface_hub import snapshot_download

    repo_id = str(source) if "/" in str(source) else "convaiinnovations/" + str(source)
    revision = revision or SOURCE_REVISIONS.get(repo_id.removeprefix("convaiinnovations/"))
    return Path(
        snapshot_download(
            repo_id,
            revision=revision,
            allow_patterns=[
                "model.safetensors",
                "encoder/config.json",
                "rl_agent_config.json",
                "tokenizer/*",
            ],
        )
    )


def _export_onnx(model, inputs, path, *, dynamic_batch, dynamic_sequence, opset):
    import torch

    dynamic_axes = {}
    if dynamic_batch or dynamic_sequence:
        seq_axes = {}
        if dynamic_batch:
            seq_axes[0] = "batch"
        if dynamic_sequence:
            seq_axes[1] = "seq"
        dynamic_axes["input_ids"] = dict(seq_axes)
        dynamic_axes["attention_mask"] = dict(seq_axes)
        batch_axes = {0: "batch"} if dynamic_batch else {}
        if batch_axes:
            dynamic_axes["marker_pos"] = dict(batch_axes)
            dynamic_axes["marker_mask"] = dict(batch_axes)
            dynamic_axes["qtype"] = dict(batch_axes)
            dynamic_axes["logits"] = dict(batch_axes)
            dynamic_axes["action_logits"] = dict(batch_axes)

    extra = {}
    # torch>=2.5 accepts dynamo=; older exporters ignore unknown kwargs via try.
    try:
        torch.onnx.export(
            model,
            tuple(inputs.values()),
            str(path),
            input_names=list(inputs),
            output_names=["logits", "action_logits"],
            dynamic_axes=dynamic_axes or None,
            opset_version=opset,
            dynamo=False,
            **extra,
        )
    except TypeError:
        torch.onnx.export(
            model,
            tuple(inputs.values()),
            str(path),
            input_names=list(inputs),
            output_names=["logits", "action_logits"],
            dynamic_axes=dynamic_axes or None,
            opset_version=opset,
        )


def convert(
    source,
    output,
    *,
    max_length=None,
    batch_size=8,
    max_options=32,
    precision="fp32",
    revision=None,
    attention="explicit",
    dynamic_batch=True,
    dynamic_sequence=True,
    opset=17,
    quantize=None,
):
    """Convert a Laya checkpoint directory (or Hub id) into a Moka ONNX bundle.

    `quantize` is None (default, exact-intent FP32/FP16 graph) or `"int8"` for
    ONNX Runtime dynamic quantization. INT8 is approximate and is refused as a
    default by the fidelity gate when it misses the drift budget.
    """
    import numpy as np
    import torch

    from .torch_model import load_model

    output = Path(output).expanduser()
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite {output}")
    if precision not in ("fp32", "fp16", "float32", "float16"):
        raise ValueError("precision must be fp32 or fp16")
    precision = {"float32": "fp32", "float16": "fp16"}.get(precision, precision)
    if quantize not in (None, "int8"):
        raise ValueError("quantize must be None or 'int8'")
    if attention not in ("explicit", "sdpa"):
        raise ValueError("attention must be explicit or sdpa")
    if not Path(source).expanduser().is_dir() and revision is None:
        revision = SOURCE_REVISIONS.get(str(source).removeprefix("convaiinnovations/"))

    source_path = resolve_source(source, revision)
    cfg = json.loads((source_path / "rl_agent_config.json").read_text())
    max_length = cfg["max_len"] if max_length is None else max_length
    if not 16 <= max_length <= cfg["max_len"]:
        raise ValueError("max_length must be between 16 and the checkpoint context limit")
    if not 1 <= batch_size <= 64 or not 2 <= max_options <= 255:
        raise ValueError("Expected batch_size 1..64 and max_options 2..255")

    started = time.perf_counter()
    torch.set_num_threads(min(8, max(1, torch.get_num_threads())))
    model = load_model(source_path, max_length, attention_implementation=attention)
    trace_length = min(32, max_length)
    trace_batch = 1
    inputs = {
        "input_ids": torch.zeros((trace_batch, trace_length), dtype=torch.int64),
        "attention_mask": torch.ones((trace_batch, trace_length), dtype=torch.int64),
        "marker_pos": torch.zeros((trace_batch, max_options), dtype=torch.int64),
        "marker_mask": torch.ones((trace_batch, max_options), dtype=torch.int64),
        "qtype": torch.zeros((trace_batch,), dtype=torch.int64),
    }
    print(
        f"Exporting ONNX {precision} B<={batch_size}, L<={max_length}, K={max_options}, "
        f"dynamic_batch={dynamic_batch}, dynamic_sequence={dynamic_sequence}, attn={attention}",
        flush=True,
    )

    output.mkdir(parents=True)
    try:
        onnx_path = output / "model.onnx"
        with torch.inference_mode():
            _export_onnx(
                model,
                inputs,
                onnx_path,
                dynamic_batch=dynamic_batch,
                dynamic_sequence=dynamic_sequence,
                opset=opset,
            )
        if precision == "fp16":
            import onnx
            from onnxruntime.transformers.float16 import convert_float_to_float16

            fp16_model = convert_float_to_float16(onnx.load(str(onnx_path)), keep_io_types=True)
            onnx.save(fp16_model, str(onnx_path))
        if quantize == "int8":
            from .quantize import quantize_dynamic_int8

            int8_path = output / "model.int8.onnx"
            quantize_dynamic_int8(onnx_path, int8_path)
            onnx_path.unlink()
            int8_path.rename(onnx_path)

        shutil.copytree(source_path / "tokenizer", output / "tokenizer")
        (output / "encoder").mkdir()
        shutil.copy2(source_path / "encoder/config.json", output / "encoder/config.json")
        shutil.copy2(source_path / "rl_agent_config.json", output / "rl_agent_config.json")

        import onnxruntime as ort

        manifest = {
            "format": FORMAT,
            "format_version": FORMAT_VERSION,
            "source": str(source),
            "revision": revision,
            "source_weights_sha256": sha256(source_path / "model.safetensors"),
            "precision": "int8" if quantize == "int8" else precision,
            "approximate": bool(quantize == "int8"),
            "attention": attention,
            "opset": opset,
            "shape": {
                "batch_size": batch_size,
                "max_length": max_length,
                "min_length": 16,
                "max_options": max_options,
                "dynamic_batch": dynamic_batch,
                "dynamic_sequence": dynamic_sequence,
                "flexible": dynamic_sequence,
                "pad_to_multiple": 16,
            },
            "versions": {
                "torch": torch.__version__,
                "onnxruntime": ort.__version__,
                "numpy": np.__version__,
            },
            "conversion_seconds": time.perf_counter() - started,
        }
        files = {
            str(p.relative_to(output)): {"bytes": p.stat().st_size, "sha256": sha256(p)}
            for p in sorted(output.rglob("*"))
            if p.is_file()
        }
        manifest["files"] = files
        (output / "moka_config.json").write_text(json.dumps(manifest, indent=2) + "\n")
        (output / "checksums.json").write_text(json.dumps(files, indent=2) + "\n")
    except BaseException:
        shutil.rmtree(output)
        raise
    print(f"Saved {output} in {manifest['conversion_seconds']:.1f}s", flush=True)
    return output
