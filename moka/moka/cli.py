"""Command-line interface: convert, predict, validate, benchmark."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="moka",
        description="Linux ONNX Runtime backend for Laya typed-decision models.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    convert = sub.add_parser("convert", help="Export a Laya checkpoint to a Moka ONNX bundle")
    convert.add_argument("source", help="Local checkpoint directory or Hub id (laya, laya-multilingual, laya-typed-decisions)")
    convert.add_argument("output", help="Destination directory (must not exist)")
    convert.add_argument("--max-length", type=int)
    convert.add_argument("--batch-size", type=int, default=8)
    convert.add_argument("--max-options", type=int, default=32)
    convert.add_argument("--precision", choices=("fp32", "fp16"), default="fp32")
    convert.add_argument("--quantize", choices=("int8",), default=None)
    convert.add_argument("--revision")
    convert.add_argument("--attention", choices=("explicit", "sdpa"), default="explicit")
    convert.add_argument("--fixed-batch", action="store_true")
    convert.add_argument("--fixed-sequence", action="store_true")
    convert.add_argument("--opset", type=int, default=17)

    predict = sub.add_parser("predict", help="Run a typed decision")
    predict.add_argument("model_dir")
    predict.add_argument("--state", required=True)
    predict.add_argument("--questions", required=True, type=Path)
    predict.add_argument("--provider", default="auto")
    predict.add_argument("--offline", action="store_true")
    predict.add_argument("--revision")
    predict.add_argument("--deterministic", action="store_true")

    validate = sub.add_parser("validate", help="Fidelity gate against a PyTorch reference")
    validate.add_argument("bundle")
    validate.add_argument("--reference", help="Original Laya checkpoint directory")
    validate.add_argument("--max-drift", type=float, default=0.02)
    validate.add_argument("--repeats", type=int, default=20)
    validate.add_argument("--output", type=Path)

    bench = sub.add_parser("benchmark", help="Measure P50/P95 latency on this machine")
    bench.add_argument("bundle")
    bench.add_argument("--warmup", type=int, default=10)
    bench.add_argument("--runs", type=int, default=100)
    bench.add_argument("--questions", type=int, default=1)
    bench.add_argument("--provider", default="auto")
    bench.add_argument("--output", type=Path)

    args = parser.parse_args(argv)
    if args.command == "convert":
        from .convert import convert as run_convert

        run_convert(
            args.source,
            args.output,
            max_length=args.max_length,
            batch_size=args.batch_size,
            max_options=args.max_options,
            precision=args.precision,
            quantize=args.quantize,
            revision=args.revision,
            attention=args.attention,
            dynamic_batch=not args.fixed_batch,
            dynamic_sequence=not args.fixed_sequence,
            opset=args.opset,
        )
        return 0
    if args.command == "predict":
        from .agent import load

        questions = json.loads(Path(args.questions).read_text())
        agent = load(
            args.model_dir,
            provider=args.provider,
            local_files_only=args.offline,
            revision=args.revision,
            deterministic=args.deterministic,
        )
        result = agent.predict(args.state, questions)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0
    if args.command == "validate":
        from .fidelity import validate_bundle

        report = validate_bundle(
            args.bundle,
            reference=args.reference,
            max_drift=args.max_drift,
            repeats=args.repeats,
        )
        text = json.dumps(report, indent=2)
        if args.output:
            args.output.write_text(text + "\n")
        sys.stdout.write(text + "\n")
        return 0 if report.get("passed") else 1
    if args.command == "benchmark":
        from .bench import run_benchmark

        report = run_benchmark(
            args.bundle,
            warmup=args.warmup,
            runs=args.runs,
            questions=args.questions,
            provider=args.provider,
        )
        text = json.dumps(report, indent=2)
        if args.output:
            args.output.write_text(text + "\n")
        sys.stdout.write(text + "\n")
        return 0
    return 1
