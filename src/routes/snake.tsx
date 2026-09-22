import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadStudioAgent } from "@/lib/moka/load";
import { SnakeGame } from "@/lib/moka/snake-game";
import { decide, type Decision } from "@/lib/moka/snake-policy";

export const Route = createFileRoute("/snake")({ component: SnakePage });

function SnakePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SnakeGame | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [stats, setStats] = useState({ score: 0, length: 6, ticks: 0, interventions: 0, rate: 0 });
  const interRef = useRef(0);
  const startedRef = useRef(0);

  const accRef = useRef(0);
  const busyRef = useRef(false);
  const rafRef = useRef(0);

  useEffect(() => {
    loadStudioAgent()
      .then(() => setReady(true))
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    const game = new SnakeGame(20, 12, 7, 5);
    gameRef.current = game;
    paint(canvasRef.current, game, null);
  }, []);

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const interval = 1 / 8;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      accRef.current += dt;
      const game = gameRef.current;
      if (game) paint(canvasRef.current, game, null);
      if (!busyRef.current && accRef.current >= interval && game && game.alive && !game.won) {
        accRef.current = 0;
        busyRef.current = true;
        void (async () => {
          try {
            const agent = await loadStudioAgent();
            const d = await decide(agent, game, true);
            if (d.intervened) interRef.current += 1;
            game.step(d.executed);
            setDecision(d);
            const elapsed = (performance.now() - startedRef.current) / 1000;
            setStats({
              score: game.score,
              length: game.body.length,
              ticks: game.ticks,
              interventions: interRef.current,
              rate: elapsed ? game.ticks / elapsed : 0,
            });
            if (!game.alive || game.won) setRunning(false);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setRunning(false);
          } finally {
            busyRef.current = false;
          }
        })();
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running]);

  function play() {
    if (!gameRef.current) return;
    startedRef.current = performance.now();
    setRunning(true);
  }

  function reset() {
    setRunning(false);
    busyRef.current = false;
    accRef.current = 0;
    interRef.current = 0;
    const game = new SnakeGame(20, 12, 7, 5);
    gameRef.current = game;
    setDecision(null);
    setStats({ score: 0, length: 5, ticks: 0, interventions: 0, rate: 0 });
    setRunning(false);
    paint(canvasRef.current, game, null);
  }

  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Demo</p>
        <h1 className="font-display text-3xl tracking-tight">A real model playing Snake</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Compact planner features go into the typed questions. The ONNX graph returns
          direction probabilities. A Hamiltonian cycle shield overrides unsafe argmax and
          counts the intervention — the same policy as laya-coreml, on Linux/WASM.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-xl border border-border bg-bg-elevated p-3">
          <canvas
            ref={canvasRef}
            className="h-auto w-full touch-none"
            style={{ imageRendering: "pixelated" }}
          />
        </div>
        <aside className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={play} disabled={!ready || running}>
              {running ? "Running" : "Play"}
            </Button>
            <Button variant="secondary" onClick={reset}>
              Reset
            </Button>
            <Badge tone={ready ? "ok" : "muted"}>{ready ? "model loaded" : "loading weights"}</Badge>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface p-4">
            <Hud label="score" value={String(stats.score)} />
            <Hud label="length" value={String(stats.length)} />
            <Hud label="ticks" value={String(stats.ticks)} />
            <Hud label="shield" value={String(stats.interventions)} />
            <Hud label="dec/s" value={stats.rate.toFixed(1)} />
            <Hud
              label="infer"
              value={decision ? `${decision.inferenceMs.toFixed(1)} ms` : "—"}
            />
          </dl>
          {decision && (
            <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-subtle">Move probabilities</p>
              {Object.entries(decision.probabilities).map(([dir, p]) => (
                <div key={dir} className="grid grid-cols-[3.5rem_1fr_3rem] items-center gap-2 text-xs">
                  <span className={dir === decision.executed ? "text-fg" : "text-muted"}>{dir}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className={`block h-full rounded-full ${dir === decision.proposed ? "bg-live" : "bg-accent"}`}
                      style={{ width: `${Math.max(2, p * 100)}%` }}
                    />
                  </span>
                  <span className="font-mono tabular-nums text-muted">{p.toFixed(2)}</span>
                </div>
              ))}
              <p className="text-xs text-muted">
                proposed {decision.proposed}
                {decision.intervened
                  ? ` · shield took ${decision.executed}`
                  : ` · executed ${decision.executed}`}
                {" · planner "}
                {decision.plannerBest}
              </p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function Hud({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.16em] text-subtle">{label}</dt>
      <dd className="font-mono text-lg tabular-nums">{value}</dd>
    </div>
  );
}

function paint(canvas: HTMLCanvasElement | null, game: SnakeGame, decision: Decision | null) {
  if (!canvas) return;
  const cell = 22;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = game.width * cell * dpr;
  canvas.height = game.height * cell * dpr;
  canvas.style.width = "100%";
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#171412";
  ctx.fillRect(0, 0, game.width * cell, game.height * cell);
  ctx.strokeStyle = "rgba(242,235,228,0.05)";
  for (let x = 0; x <= game.width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cell, 0);
    ctx.lineTo(x * cell, game.height * cell);
    ctx.stroke();
  }
  for (let y = 0; y <= game.height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cell);
    ctx.lineTo(game.width * cell, y * cell);
    ctx.stroke();
  }
  if (game.food) {
    ctx.fillStyle = "#c17a4a";
    ctx.beginPath();
    ctx.arc(game.food[0] * cell + cell / 2, game.food[1] * cell + cell / 2, cell * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  game.body.forEach((seg, i) => {
    ctx.fillStyle = i === 0 ? "#f2ebe4" : "rgba(217,207,196,0.75)";
    const pad = i === 0 ? 3 : 5;
    ctx.fillRect(seg[0] * cell + pad, seg[1] * cell + pad, cell - pad * 2, cell - pad * 2);
  });
  void decision;
}
