import * as ort from "onnxruntime-web/wasm";
import { collateItems, dims, type Shape } from "./collate";
import { prepare } from "./prompt";
import { loadTokenizer, type WordLevelTokenizer } from "./tokenizer";
import type { Answer, PredictResult, Question } from "./types";

export type Manifest = {
  format: string;
  precision: string;
  approximate?: boolean;
  shape: Shape;
  source?: string;
  revision?: string | null;
};

export type AgentConfig = {
  max_len: number;
  head_max_len: number;
  temperature: number[];
  temperature_by_options?: Record<string, number>;
};

const TEMP_MIN = 0.5;
const TEMP_MAX = 5.0;

function clampTemp(t: unknown): number {
  const n = typeof t === "number" ? t : Number(t);
  if (!Number.isFinite(n)) return 1;
  return Math.min(TEMP_MAX, Math.max(TEMP_MIN, n));
}

function softmax(z: number[]): number[] {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

function confidence(p: number[], k: number): number {
  if (k < 2) return 1;
  let ent = 0;
  for (let i = 0; i < k; i++) {
    const v = Math.min(1, Math.max(1e-12, p[i]!));
    ent -= v * Math.log(v);
  }
  return Math.min(1, Math.max(0, 1 - ent / Math.log(k)));
}

function tempBucket(qtype: number, k: number): string {
  const names = ["choice", "score", "noul"];
  const size = k <= 2 ? "2" : k <= 5 ? "3-5" : k <= 10 ? "6-10" : "11+";
  return `${names[qtype]}:${size}`;
}

function toInt64(arr: Int32Array): BigInt64Array {
  const out = new BigInt64Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = BigInt(arr[i]!);
  return out;
}

let wasmReady = false;
function configureOrt() {
  if (wasmReady) return;
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
  // Absolute CDN URL so Vite does not intercept the WASM helper's dynamic import().
  ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";
  wasmReady = true;
}

export class MokaAgent {
  session!: ort.InferenceSession;
  tok!: WordLevelTokenizer;
  manifest!: Manifest;
  cfg!: AgentConfig;
  temperature!: number[];
  temperatureByOptions!: Record<string, number>;
  inputNames!: readonly string[];

  static async load(base = "/models/moka-tiny"): Promise<MokaAgent> {
    configureOrt();
    const agent = new MokaAgent();
    const [manifest, cfg, tok, session] = await Promise.all([
      fetch(`${base}/moka_config.json`).then((r) => r.json() as Promise<Manifest>),
      fetch(`${base}/rl_agent_config.json`).then((r) => r.json() as Promise<AgentConfig>),
      loadTokenizer(base),
      ort.InferenceSession.create(`${base}/model.onnx`, {
        executionProviders: ["wasm"],
      }),
    ]);
    agent.manifest = manifest;
    agent.cfg = cfg;
    agent.tok = tok;
    agent.session = session;
    agent.inputNames = session.inputNames;
    const raw = cfg.temperature ?? [1, 1, 1];
    agent.temperature = raw.map(clampTemp);
    agent.temperatureByOptions = Object.fromEntries(
      Object.entries(cfg.temperature_by_options ?? {}).map(([k, v]) => [k, clampTemp(v)]),
    );
    return agent;
  }

  async predict(state: unknown, questions: Record<string, Question>): Promise<PredictResult> {
    const { items, internal } = prepare(
      this.tok,
      state,
      questions,
      this.cfg.max_len ?? 96,
      this.cfg.head_max_len ?? 48,
    );
    const shape = this.manifest.shape;
    const answers: Record<string, Answer> = {};
    const ids = Object.keys(questions);
    const batchSize = shape.batch_size || 8;
    for (let start = 0; start < items.length; start += batchSize) {
      const chunk = items.slice(start, start + batchSize);
      const packed = collateItems(chunk, this.tok.pad_token_id, shape);
      const feeds: Record<string, ort.Tensor> = {};
      for (const name of this.inputNames) {
        const data = packed[name];
        if (!data) throw new Error(`Missing feed ${name}`);
        feeds[name] = new ort.Tensor("int64", toInt64(data), dims(packed, name));
      }
      const out = await this.session.run(feeds);
      const logitsT = out.logits as ort.Tensor;
      const actionT = out.action_logits as ort.Tensor;
      const logits = logitsT.data as Float32Array;
      const action = actionT.data as Float32Array;
      const kMax = shape.max_options;
      const actDim = action.length / chunk.length;
      chunk.forEach((item, row) => {
        const q = internal[start + row]!;
        const qid = ids[start + row]!;
        const k = item.markers.length;
        const scale =
          this.temperatureByOptions[tempBucket(item.qtype, k)] ?? this.temperature[item.qtype] ?? 1;
        const z: number[] = [];
        for (let i = 0; i < k; i++) z.push(Number(logits[row * kMax + i]) / scale);
        const p = softmax(z);
        const actRow: number[] = [];
        for (let i = 0; i < actDim; i++) actRow.push(Number(action[row * actDim + i]));
        const actSoft = softmax(actRow);
        const base = {
          confidence: round4(confidence(p, k)),
          action: { act_probability: round4(actSoft[0] ?? 0) },
        };
        if (q.t === "choice") {
          const labels = Object.keys(q.crit as Record<string, unknown>);
          const choice = labels[argmax(p)]!;
          answers[qid] = {
            type: "choice",
            choice,
            probabilities: Object.fromEntries(labels.map((l, i) => [l, round4(p[i]!)])),
            ...base,
          };
        } else if (q.t === "score") {
          const score = p.reduce((s, v, i) => s + v * i, 0);
          answers[qid] = {
            type: "score",
            score: round4(score),
            legend: Object.fromEntries((q.crit as unknown[]).map((v, i) => [String(i), v])),
            probabilities: Object.fromEntries(p.map((v, i) => [String(i), round4(v)])),
            ...base,
          };
        } else {
          answers[qid] = {
            type: "noul",
            noul: round4(p[1] ?? 0),
            ...base,
            confidence: round4(Math.max(p[1] ?? 0, 1 - (p[1] ?? 0))),
          };
        }
      });
    }
    return {
      model: "laya-rl-agent",
      runtime: "moka-onnx-wasm",
      answers,
      usage: {
        input_tokens: items.reduce((s, it) => s + it.ids.length, 0),
        output_tokens: 0,
      },
    };
  }
}

function argmax(p: number[]): number {
  let i = 0;
  for (let k = 1; k < p.length; k++) if (p[k]! > p[i]!) i = k;
  return i;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
