import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadStudioAgent } from "@/lib/moka/load";
import type { PredictResult, Question } from "@/lib/moka/types";

export const Route = createFileRoute("/playground")({ component: Playground });

const QUESTIONS: Record<string, Question> = {
  department: {
    type: "choice",
    instructions: "Which department should handle this email?",
    criteria: {
      billing: "invoices payments refunds",
      technical: "bugs outages system errors",
      sales: "pricing new contracts",
      other: "everything else",
    },
  },
  urgency: {
    type: "score",
    instructions: "How urgent is this request?",
    criteria: ["not urgent", "soon", "critical deadline or blocking issue"],
  },
  refund: {
    type: "noul",
    instructions: "Does the customer request a refund?",
  },
};

const PRESETS: Record<string, { label: string; state: string; questions: Record<string, Question> }> =
  {
    billing: {
      label: "Duplicate charge",
      state: "I was charged twice for invoice please refund it today.",
      questions: QUESTIONS,
    },
    technical: {
      label: "System outage",
      state: "The system errors and outages block our plan.",
      questions: QUESTIONS,
    },
    sales: {
      label: "New contracts",
      state: "Please send pricing for new contracts.",
      questions: QUESTIONS,
    },
  };

function Playground() {
  const [presetId, setPresetId] = useState<keyof typeof PRESETS>("billing");
  const preset = PRESETS[presetId]!;
  const [state, setState] = useState(preset.state);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    setStatus("loading");
    loadStudioAgent()
      .then(() => setStatus("ready"))
      .catch((err: Error) => {
        setStatus("error");
        setError(err.message);
      });
  }, []);

  function applyPreset(id: keyof typeof PRESETS) {
    setPresetId(id);
    setState(PRESETS[id]!.state);
    setResult(null);
    setMs(null);
    setError(null);
  }

  async function run() {
    setError(null);
    setStatus("loading");
    try {
      const agent = await loadStudioAgent();
      let parsed: unknown = state;
      try {
        parsed = JSON.parse(state);
      } catch {
        parsed = state;
      }
      const t0 = performance.now();
      const out = await agent.predict(parsed, preset.questions);
      setMs(performance.now() - t0);
      setResult(out);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Playground</p>
        <h1 className="font-display text-3xl tracking-tight">Ask for a typed decision</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Runs the converted ONNX graph in this browser via ONNX Runtime WASM. Same choice /
          score / noul contract as the Python package. The weights here are the compact
          <span className="text-fg"> moka-tiny </span> student — a runtime demo, not the 421M Hub
          checkpoint.
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((id) => (
          <Button
            key={id}
            size="sm"
            variant={presetId === id ? "primary" : "secondary"}
            onClick={() => applyPreset(id)}
          >
            {PRESETS[id]!.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-3">
          <label className="text-xs uppercase tracking-[0.16em] text-subtle">State</label>
          <textarea
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="min-h-56 w-full rounded-md border border-border bg-bg-elevated p-3 font-mono text-sm leading-relaxed text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={run} disabled={status === "loading"}>
              {status === "loading" ? "Running…" : "Predict"}
            </Button>
            <Badge tone={status === "ready" ? "ok" : status === "error" ? "danger" : "muted"}>
              {status === "ready" ? "ORT WASM ready" : status}
            </Badge>
            {ms != null && (
              <span className="font-mono text-xs tabular-nums text-muted">
                {ms.toFixed(1)} ms end-to-end
              </span>
            )}
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          {!result && <p className="text-sm text-muted">No answers yet.</p>}
          {result && (
            <div className="space-y-5">
              {Object.entries(result.answers).map(([id, answer]) => (
                <AnswerCard key={id} id={id} answer={answer} />
              ))}
              <p className="font-mono text-xs text-subtle">
                input {result.usage.input_tokens} · output {result.usage.output_tokens} ·{" "}
                {result.runtime}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function AnswerCard({ id, answer }: { id: string; answer: PredictResult["answers"][string] }) {
  return (
    <article className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium">{id}</h2>
        <Badge>{answer.type}</Badge>
      </div>
      {answer.type === "choice" && (
        <>
          <p className="font-display text-xl">{answer.choice}</p>
          <Bars entries={Object.entries(answer.probabilities)} />
        </>
      )}
      {answer.type === "score" && (
        <>
          <p className="font-mono text-xl tabular-nums">{answer.score.toFixed(3)}</p>
          <Bars entries={Object.entries(answer.probabilities)} />
        </>
      )}
      {answer.type === "noul" && (
        <>
          <p className="font-mono text-xl tabular-nums">{answer.noul.toFixed(3)}</p>
          <Bars
            entries={[
              ["false", 1 - answer.noul],
              ["true", answer.noul],
            ]}
          />
        </>
      )}
      <p className="text-xs text-subtle">
        confidence {answer.confidence.toFixed(3)} · act {answer.action.act_probability.toFixed(3)}
      </p>
    </article>
  );
}

function Bars({ entries }: { entries: [string, number][] }) {
  return (
    <ul className="space-y-1.5">
      {entries.map(([label, value]) => (
        <li key={label} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-xs">
          <span className="truncate text-muted">{label}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${Math.max(2, value * 100)}%` }}
            />
          </span>
          <span className="font-mono tabular-nums text-muted">{value.toFixed(2)}</span>
        </li>
      ))}
    </ul>
  );
}
