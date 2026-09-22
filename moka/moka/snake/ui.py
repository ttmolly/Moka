"""Optional Rich terminal UI for the Snake demo."""

from __future__ import annotations

import time


def run_live(policy, game, *, fps=12):
    try:
        from rich.console import Console
        from rich.live import Live
        from rich.panel import Panel
        from rich.table import Table
        from rich.text import Text
    except ImportError:
        print("Install moka[demo] for the terminal UI, or pass --headless / --record.")
        return 1

    console = Console()
    interval = 1.0 / fps if fps else 0
    interventions = 0
    started = time.perf_counter()
    last = None

    def render():
        grid = [["·"] * game.width for _ in range(game.height)]
        if game.food:
            fx, fy = game.food
            grid[fy][fx] = "●"
        for i, (x, y) in enumerate(game.body):
            grid[y][x] = "◆" if i == 0 else "■"
        board = "\n".join(" ".join(row) for row in grid)
        table = Table.grid(padding=(0, 2))
        stats = Text.assemble(
            ("score ", "dim"),
            (str(game.score), "bold"),
            ("  length ", "dim"),
            (str(len(game.body)), "bold"),
            ("  ticks ", "dim"),
            (str(game.ticks), "bold"),
        )
        if last is not None:
            probs = "  ".join(
                f"{d[0]} {last.probabilities[d]:.2f}" for d in last.probabilities
            )
            stats.append(f"\n{probs}")
            stats.append(
                f"\nproposed {last.proposed}  executed {last.executed}  "
                f"{'SHIELD' if last.intervened else 'model'}  "
                f"{last.inference_ms:.1f} ms"
            )
        table.add_row(Text(board, style="bold"), stats)
        title = "Moka · ONNX Runtime Snake"
        return Panel(table, title=title, subtitle=f"interventions {interventions}")

    with Live(render(), console=console, refresh_per_second=max(fps, 4)) as live:
        while game.alive and not game.won:
            tick = time.perf_counter()
            last = policy.decide(game)
            if last.intervened:
                interventions += 1
            game.step(last.executed)
            live.update(render())
            if interval:
                delay = interval - (time.perf_counter() - tick)
                if delay > 0:
                    time.sleep(delay)
    elapsed = time.perf_counter() - started
    console.print(
        f"done score={game.score} length={len(game.body)} ticks={game.ticks} "
        f"interventions={interventions} rate={game.ticks / elapsed:.2f}/s"
        if elapsed
        else "done"
    )
    return 0
