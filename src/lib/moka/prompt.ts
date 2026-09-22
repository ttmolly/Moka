import { QTYPES, type InternalQuestion, type PreparedItem, type Question } from "./types";
import type { WordLevelTokenizer } from "./tokenizer";

export function serializeState(state: unknown): string {
  if (typeof state === "string") return state;
  return JSON.stringify(state);
}

function renderCriterion(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function renderOptions(q: InternalQuestion): string[] {
  const t = q.t;
  const crit = q.crit;
  if (t === "choice") {
    const entries = Object.entries(crit as Record<string, unknown>);
    return entries.map(([k, v]) =>
      v == null || v === "" ? k : `${k}: ${renderCriterion(v)}`,
    );
  }
  if (t === "score") {
    return (crit as unknown[]).map((c, i) => `level ${i}: ${renderCriterion(c)}`);
  }
  const dict = (crit ?? {}) as Record<string, unknown>;
  const falseCrit = dict.false;
  const trueCrit = dict.true;
  return [
    "false: " +
      (falseCrit != null && falseCrit !== ""
        ? renderCriterion(falseCrit)
        : "no, the statement does not hold"),
    "true: " +
      (trueCrit != null && trueCrit !== ""
        ? renderCriterion(trueCrit)
        : "yes, the statement holds"),
  ];
}

export function toInternal(qdef: Question): InternalQuestion {
  const kind = qdef.type;
  if (kind !== "choice" && kind !== "score" && kind !== "noul") {
    throw new Error(`Unknown question type ${String(kind)}`);
  }
  if (qdef.instructions == null) throw new Error("Question is missing instructions");
  let criteria = qdef.criteria;
  if (kind === "choice") {
    if (Array.isArray(criteria)) {
      criteria = Object.fromEntries((criteria as string[]).map((c) => [c, null]));
    }
    if (!criteria || typeof criteria !== "object" || Array.isArray(criteria)) {
      throw new Error("Choice criteria must be a nonempty dictionary or list");
    }
  } else if (kind === "score") {
    if (!Array.isArray(criteria) || criteria.length === 0) {
      throw new Error("Score criteria must be a nonempty list");
    }
  }
  const instructions =
    typeof qdef.instructions === "string"
      ? qdef.instructions
      : JSON.stringify(qdef.instructions);
  return { t: kind, ins: instructions, crit: criteria as InternalQuestion["crit"] };
}

export function buildSequence(
  tok: WordLevelTokenizer,
  state: unknown,
  q: InternalQuestion,
  maxLen = 96,
  headMaxLen = 48,
): { ids: number[]; markers: number[] } {
  const maskTok = tok.mask_token;
  const opts = renderOptions(q);
  const ins = String(q.ins).replaceAll(maskTok, " ");
  let headIds = tok.call(`${q.t} question: ${ins}`).input_ids;
  let optIds = opts.map((opt) => [
    tok.mask_token_id,
    ...tok.call(" " + opt.replaceAll(maskTok, " ")).input_ids.slice(0, 48),
  ]);
  let optBudget = headMaxLen - optIds.reduce((s, o) => s + o.length, 0);
  if (optBudget < 16) {
    const per = Math.max(4, Math.floor((headMaxLen - 16) / Math.max(1, optIds.length)));
    optIds = optIds.map((o) => o.slice(0, per));
    optBudget = headMaxLen - optIds.reduce((s, o) => s + o.length, 0);
  }
  headIds = headIds.slice(0, Math.max(8, optBudget));
  const ids: number[] = [tok.cls_token_id, ...headIds, tok.sep_token_id];
  const markers: number[] = [];
  for (const o of optIds) {
    markers.push(ids.length);
    ids.push(...o);
  }
  ids.push(tok.sep_token_id);
  const room = Math.max(0, maxLen - ids.length - 1);
  const st = tok
    .call(serializeState(state).replaceAll(tok.mask_token, " "))
    .input_ids.slice(0, room);
  ids.push(...st, tok.sep_token_id);
  return {
    ids: ids.slice(0, maxLen),
    markers: markers.filter((m) => m < maxLen),
  };
}

export function prepare(
  tok: WordLevelTokenizer,
  state: unknown,
  questions: Record<string, Question>,
  maxLen: number,
  headMaxLen: number,
): { items: PreparedItem[]; internal: InternalQuestion[] } {
  const items: PreparedItem[] = [];
  const internal: InternalQuestion[] = [];
  for (const [qid, definition] of Object.entries(questions)) {
    const q = toInternal(definition);
    const { ids, markers } = buildSequence(tok, state, q, maxLen, headMaxLen);
    if (markers.length !== renderOptions(q).length) {
      throw new Error(`Question ${qid} has too many options for the token budget`);
    }
    items.push({ ids, markers, qtype: QTYPES[q.t] });
    internal.push(q);
  }
  return { items, internal };
}
