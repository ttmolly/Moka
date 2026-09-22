import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/fidelity")({ component: FidelityPage });

type Studio = {
  fidelity_fp32: {
    matched: number;
    total: number;
    max_probability_drift: number;
    passed: boolean;
    stable: boolean;
    max_drift_budget: number;
    precision: string;
  };
  fidelity_int8: {
    matched: number;
    total: number;
    max_probability_drift: number;
    passed: boolean;
    stable: boolean;
    max_drift_budget: number;
    precision: string;
  };
};

function FidelityPage() {
  const [data, setData] = useState<Studio | null>(null);
  useEffect(() => {
    fetch("/data/studio.json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const rows = data
    ? [
        { name: "moka-tiny FP32", ...data.fidelity_fp32, default: "yes" },
        { name: "moka-tiny INT8", ...data.fidelity_int8, default: "no" },
        {
          name: "laya 421M",
          matched: 0,
          total: 0,
          max_probability_drift: 0,
          passed: false,
          stable: false,
          max_drift_budget: 0.0001,
          precision: "fp32",
          default: "not converted (RAM)",
        },
      ]
    : [];

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Fidelity</p>
        <h1 className="font-display text-3xl tracking-tight">The gate, not the vibe</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          A bundle ships as default only if selected answers match the PyTorch export graph
          on every fixture, max calibrated drift is inside budget, and repeated calls are
          stable. Conversion fidelity is not task accuracy.
        </p>
      </header>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-[0.14em] text-subtle">
            <tr>
              <th className="px-3 py-2 font-medium">Artifact</th>
              <th className="px-3 py-2 font-medium">Match</th>
              <th className="px-3 py-2 font-medium">Max drift</th>
              <th className="px-3 py-2 font-medium">Budget</th>
              <th className="px-3 py-2 font-medium">Gate</th>
              <th className="px-3 py-2 font-medium">Default</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-t border-border">
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2 font-mono tabular-nums">
                  {row.total ? `${row.matched}/${row.total}` : "—"}
                </td>
                <td className="px-3 py-2 font-mono tabular-nums">
                  {row.total ? row.max_probability_drift.toFixed(4) : "—"}
                </td>
                <td className="px-3 py-2 font-mono tabular-nums">{row.max_drift_budget}</td>
                <td className="px-3 py-2">
                  {row.name.includes("421M") ? (
                    <Badge>not run</Badge>
                  ) : row.passed ? (
                    <Badge tone="ok">passed</Badge>
                  ) : (
                    <Badge tone="danger">failed</Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-muted">{row.default}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <article className="rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed text-muted">
        INT8 stayed inside the 0.02 drift budget (0.0098) and still failed: two selected
        answers flipped on the long-state fixture (41/43). Same policy as laya-coreml’s
        unpublished 6-bit/4-bit experiments — keep the row, refuse the default.
      </article>
    </main>
  );
}
