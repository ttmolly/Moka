import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/convert")({ component: ConvertPage });

type Manifest = {
  format: string;
  precision: string;
  approximate: boolean;
  attention: string;
  opset: number;
  source: string;
  source_weights_sha256: string;
  conversion_seconds: number;
  shape: Record<string, unknown>;
  versions: Record<string, string>;
};

function ConvertPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  useEffect(() => {
    fetch("/models/moka-tiny/moka_config.json")
      .then((r) => r.json())
      .then(setManifest)
      .catch(() => setManifest(null));
  }, []);

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Conversion</p>
        <h1 className="font-display text-3xl tracking-tight">From Laya safetensors to an ONNX bundle</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          The converter loads original checkpoints into an export-only ModernBERT graph
          (state-dict names unchanged), writes ONNX, and records checksums plus the upstream
          revision. Inference never imports Transformers.
        </p>
      </header>
      <pre className="overflow-x-auto rounded-lg border border-border bg-bg-elevated p-4 font-mono text-xs leading-relaxed text-accent">
{`pip install 'moka[convert]'
moka convert convaiinnovations/laya-typed-decisions models/typed
moka convert laya-multilingual models/multi --max-length 96
moka convert laya models/english-int8 --quantize int8   # approximate, gated`}
      </pre>
      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-medium">Default graph</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Explicit matmul/softmax attention, opset 17, dynamic batch and sequence. SDPA is
            an experiment flag: it can emit ops CPU EP cannot run.
          </p>
        </article>
        <article className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-medium">What did not ship</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            421M/322M Hub conversion did not fit in 4 GiB RAM on this host. INT8 missed the
            answer-match gate. TensorRT is never implicit. OpenVINO was not installed.
          </p>
        </article>
      </section>
      {manifest && (
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-medium">Live bundle provenance</h2>
          <dl className="mt-3 grid gap-2 font-mono text-xs sm:grid-cols-2">
            <Row k="format" v={manifest.format} />
            <Row k="precision" v={manifest.precision} />
            <Row k="approximate" v={String(manifest.approximate)} />
            <Row k="attention" v={manifest.attention} />
            <Row k="opset" v={String(manifest.opset)} />
            <Row k="convert s" v={manifest.conversion_seconds.toFixed(3)} />
            <Row k="weights sha256" v={manifest.source_weights_sha256.slice(0, 20) + "…"} />
            <Row k="torch / ort" v={`${manifest.versions.torch} / ${manifest.versions.onnxruntime}`} />
          </dl>
        </section>
      )}
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-1.5">
      <dt className="text-subtle">{k}</dt>
      <dd className="truncate text-fg">{v}</dd>
    </div>
  );
}
