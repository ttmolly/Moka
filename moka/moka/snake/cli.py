"""Run the live terminal demo, a headless recording, or a paced benchmark."""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path

from .game import SnakeGame
from .policy import LayaPolicy


def _play_headless(policy, game, *, steps=None, duration=None, fps=None):
    records = []
    started = time.perf_counter()
    interval = None if fps is None else 1.0 / fps
    while game.alive and not game.won:
        if steps is not None and game.ticks >= steps:
            break
        if duration is not None and (time.perf_counter() - started) >= duration:
            break
        tick_start = time.perf_counter()
        decision = policy.decide(game)
        game.step(decision.executed)
        records.append(
            {
                "t": time.perf_counter() - started,
                "snapshot": game.snapshot(),
                "decision": decision.to_dict(),
            }
        )
        if interval is not None:
            delay = interval - (time.perf_counter() - tick_start)
            if delay > 0:
                time.sleep(delay)
    return records


def play(argv=None):
    parser = argparse.ArgumentParser(prog="moka-snake")
    parser.add_argument("--model", required=True)
    parser.add_argument("--prompt", choices=("compact", "detailed"), default="compact")
    parser.add_argument("--provider", default="auto")
    parser.add_argument("--width", type=int, default=24)
    parser.add_argument("--height", type=int, default=16)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--initial-length", type=int, default=6)
    parser.add_argument("--fps", type=float, default=12)
    parser.add_argument("--max-speed", action="store_true")
    parser.add_argument("--duration", type=float)
    parser.add_argument("--steps", type=int)
    parser.add_argument("--unassisted", action="store_true", help="Disable the cycle safety shield")
    parser.add_argument("--record", type=Path)
    parser.add_argument("--headless", action="store_true")
    args = parser.parse_args(argv)

    policy = LayaPolicy(
        args.model, guarded=not args.unassisted, prompt=args.prompt, provider=args.provider
    )
    game = SnakeGame(args.width, args.height, seed=args.seed, initial_length=args.initial_length)
    fps = None if args.max_speed else args.fps
    if args.headless or args.record or not _tty():
        records = _play_headless(
            policy, game, steps=args.steps, duration=args.duration, fps=fps
        )
        summary = {
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "metadata": policy.metadata,
            "final": game.snapshot(),
            "decisions": len(records),
            "interventions": sum(1 for row in records if row["decision"]["intervened"]),
            "mean_inference_ms": (
                sum(row["decision"]["inference_ms"] for row in records) / len(records)
                if records
                else None
            ),
            "decisions_per_sec": (
                len(records) / records[-1]["t"] if records and records[-1]["t"] else None
            ),
        }
        if args.record:
            payload = {"summary": summary, "frames": records}
            args.record.write_text(json.dumps(payload) + "\n")
        print(json.dumps(summary, indent=2))
        return 0
    from .ui import run_live

    return run_live(policy, game, fps=args.fps)


def _tty():
    import sys

    return sys.stdout.isatty()


def main(argv=None):
    return play(argv)
