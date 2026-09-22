import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Cpu, Gauge, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Home });

type Studio = {
  host: { cpu: string; cores: number; ram_bytes: number; gpu: string | null };
  onnxruntime: string;
  fidelity_fp32: { matched: number; total: number; max_probability_drift: number; passed: boolean };
  fidelity_int8: { matched: number; total: number; max_probability_drift: number; passed: boolean };
  latency_ort: { p50_ms: number; p95_ms: number; decisions_per_sec: number };
  latency_pytorch: { p50_ms: number };
  energy: { available: boolean; reason: string };
  snake: { ticks: number; score: number; interventions: number; decisions_per_sec: number };
  speedup_vs_pytorch: number;
};

function Home() {
  const [data, setData] = useState<Studio | null>(null);
  useEffect(() => {
    fetch("/data/studio.json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <main className="space-y-14">
      <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div className="space-y-5">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Independent Linux port</p>
          <h1 className="max-w-xl font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
            Typed decisions on Linux, without the Neural Engine.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted">
            Moka is the Linux analogue of laya-coreml: an export graph, an ONNX Runtime
            backend, a drift-gated fidelity harness, and a Snake demo driven by live
            probabilities. It is not <span className="font-mono text-sm text-fg">transformers.predict()</span>.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/playground">
                Run a decision <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/snake">Watch Snake</Link>
            </Button>
          </div>
        </div>
        <aside className="rounded-xl border border-border bg-surface p-5 shadow-soft">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Measured on this host</p>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <Stat label="ORT P50" value={data ? `${data.latency_ort.p50_ms.toFixed(2)} ms` : "—"} />
            <Stat label="vs PyTorch" value={data ? `${data.speedup_vs_pytorch.toFixed(2)}×` : "—"} />
            <Stat
              label="FP32 fidelity"
              value={data ? `${data.fidelity_fp32.matched}/${data.fidelity_fp32.total}` : "—"}
            />
            <Stat label="INT8 default" value="refused" warn />
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-subtle">
            {data?.host.cpu}, {data?.host.cores} cores, no GPU. The 1.21× is real. The requested
            10× was not achieved — and was not claimed.
          </p>
        </aside>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Note
          icon={<Cpu className="size-4" />}
          title="ONNX Runtime, CPU first"
          body="Default execution provider is CPU. CUDA, TensorRT and OpenVINO are opt-in because they are absent here and TensorRT can change numerics."
        />
        <Note
          icon={<ShieldCheck className="size-4" />}
          title="Drift-gated, not vibes"
          body="FP32 matched 43/43 with 0.0 max calibrated drift. INT8 matched 41/43 — labelled approximate, not shipped as default."
        />
        <Note
          icon={<Gauge className="size-4" />}
          title="Energy: not invented"
          body="RAPL was unreadable. nvidia-smi is absent. Energy per decision is omitted with that reason, not guessed."
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl tracking-tight">API surface</h2>
        <pre className="overflow-x-auto rounded-lg border border-border bg-bg-elevated p-4 font-mono text-xs leading-relaxed text-accent">
{`import moka
agent = moka.load("./models/typed")
result = agent.predict(state, {
  "refund": {"type": "noul", "instructions": "Does the customer request a refund?"}
})
# choice / score / noul · calibrated probabilities · output_tokens = 0`}
        </pre>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <Badge>Apache-2.0</Badge>
        <Badge>Not an official Convai or laya-coreml release</Badge>
        {data?.fidelity_int8.passed ? (
          <Badge tone="ok">INT8 passed</Badge>
        ) : (
          <Badge tone="danger">
            <XCircle className="size-3" /> INT8 failed answer-match gate
          </Badge>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.16em] text-subtle">{label}</dt>
      <dd className={`mt-1 font-mono text-lg tabular-nums ${warn ? "text-danger" : "text-fg"}`}>
        {value}
      </dd>
    </div>
  );
}

function Note({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <h3 className="font-medium text-fg">{title}</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </article>
  );
}
