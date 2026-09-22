import { n as de, r as rs, t as Y } from "../_libs/onnxruntime-web.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/load-DND-U4y0.js
function collateItems(items, padId, shape) {
	if (!items.length) throw new Error("Batch must contain at least one question");
	const dynamicBatch = Boolean(shape.dynamic_batch);
	if (!dynamicBatch && items.length > shape.batch_size) throw new Error("Batch exceeds exported batch_size");
	if (dynamicBatch && items.length > shape.batch_size) throw new Error("Batch exceeds exported batch_size");
	const batchSize = dynamicBatch ? items.length : shape.batch_size;
	let length = Math.max(...items.map((it) => it.ids.length));
	if (length > shape.max_length) throw new Error(`Input has ${length} tokens, but this export supports at most ${shape.max_length}`);
	if (items.some((it) => it.markers.length > shape.max_options)) throw new Error("Question exceeds the exported max_options");
	const multiple = shape.pad_to_multiple || 16;
	const minLength = shape.min_length || 1;
	const padded = Math.max(minLength, Math.ceil(length / multiple) * multiple);
	length = Math.min(shape.max_length, padded);
	const k = shape.max_options;
	const inputIds = new Int32Array(batchSize * length).fill(padId);
	const attention = new Int32Array(batchSize * length);
	const markerPos = new Int32Array(batchSize * k);
	const markerMask = new Int32Array(batchSize * k);
	const qtype = new Int32Array(batchSize);
	if (batchSize > items.length) for (let r = 0; r < batchSize; r++) attention[r * length] = 1;
	items.forEach((item, row) => {
		const n = item.ids.length;
		for (let i = 0; i < n; i++) {
			inputIds[row * length + i] = item.ids[i];
			attention[row * length + i] = 1;
		}
		item.markers.forEach((m, j) => {
			markerPos[row * k + j] = m;
			markerMask[row * k + j] = 1;
		});
		qtype[row] = item.qtype;
	});
	return {
		input_ids: inputIds,
		attention_mask: attention,
		marker_pos: markerPos,
		marker_mask: markerMask,
		qtype,
		_batch: new Int32Array([batchSize]),
		_length: new Int32Array([length])
	};
}
function dims(batch, name) {
	const b = batch._batch[0];
	if (name === "qtype") return [b];
	if (name === "marker_pos" || name === "marker_mask") return [b, batch.marker_pos.length / b];
	return [b, batch._length[0]];
}
var QTYPES = {
	choice: 0,
	score: 1,
	noul: 2
};
function serializeState(state) {
	if (typeof state === "string") return state;
	return JSON.stringify(state);
}
function renderCriterion(value) {
	if (typeof value === "string") return value;
	return JSON.stringify(value);
}
function renderOptions(q) {
	const t = q.t;
	const crit = q.crit;
	if (t === "choice") return Object.entries(crit).map(([k, v]) => v == null || v === "" ? k : `${k}: ${renderCriterion(v)}`);
	if (t === "score") return crit.map((c, i) => `level ${i}: ${renderCriterion(c)}`);
	const dict = crit ?? {};
	const falseCrit = dict.false;
	const trueCrit = dict.true;
	return ["false: " + (falseCrit != null && falseCrit !== "" ? renderCriterion(falseCrit) : "no, the statement does not hold"), "true: " + (trueCrit != null && trueCrit !== "" ? renderCriterion(trueCrit) : "yes, the statement holds")];
}
function toInternal(qdef) {
	const kind = qdef.type;
	if (kind !== "choice" && kind !== "score" && kind !== "noul") throw new Error(`Unknown question type ${String(kind)}`);
	if (qdef.instructions == null) throw new Error("Question is missing instructions");
	let criteria = qdef.criteria;
	if (kind === "choice") {
		if (Array.isArray(criteria)) criteria = Object.fromEntries(criteria.map((c) => [c, null]));
		if (!criteria || typeof criteria !== "object" || Array.isArray(criteria)) throw new Error("Choice criteria must be a nonempty dictionary or list");
	} else if (kind === "score") {
		if (!Array.isArray(criteria) || criteria.length === 0) throw new Error("Score criteria must be a nonempty list");
	}
	return {
		t: kind,
		ins: typeof qdef.instructions === "string" ? qdef.instructions : JSON.stringify(qdef.instructions),
		crit: criteria
	};
}
function buildSequence(tok, state, q, maxLen = 96, headMaxLen = 48) {
	const maskTok = tok.mask_token;
	const opts = renderOptions(q);
	const ins = String(q.ins).replaceAll(maskTok, " ");
	let headIds = tok.call(`${q.t} question: ${ins}`).input_ids;
	let optIds = opts.map((opt) => [tok.mask_token_id, ...tok.call(" " + opt.replaceAll(maskTok, " ")).input_ids.slice(0, 48)]);
	let optBudget = headMaxLen - optIds.reduce((s, o) => s + o.length, 0);
	if (optBudget < 16) {
		const per = Math.max(4, Math.floor((headMaxLen - 16) / Math.max(1, optIds.length)));
		optIds = optIds.map((o) => o.slice(0, per));
		optBudget = headMaxLen - optIds.reduce((s, o) => s + o.length, 0);
	}
	headIds = headIds.slice(0, Math.max(8, optBudget));
	const ids = [
		tok.cls_token_id,
		...headIds,
		tok.sep_token_id
	];
	const markers = [];
	for (const o of optIds) {
		markers.push(ids.length);
		ids.push(...o);
	}
	ids.push(tok.sep_token_id);
	const room = Math.max(0, maxLen - ids.length - 1);
	const st = tok.call(serializeState(state).replaceAll(tok.mask_token, " ")).input_ids.slice(0, room);
	ids.push(...st, tok.sep_token_id);
	return {
		ids: ids.slice(0, maxLen),
		markers: markers.filter((m) => m < maxLen)
	};
}
function prepare(tok, state, questions, maxLen, headMaxLen) {
	const items = [];
	const internal = [];
	for (const [qid, definition] of Object.entries(questions)) {
		const q = toInternal(definition);
		const { ids, markers } = buildSequence(tok, state, q, maxLen, headMaxLen);
		if (markers.length !== renderOptions(q).length) throw new Error(`Question ${qid} has too many options for the token budget`);
		items.push({
			ids,
			markers,
			qtype: QTYPES[q.t]
		});
		internal.push(q);
	}
	return {
		items,
		internal
	};
}
function isolatePunctuation(word) {
	return word.split(/([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/).filter(Boolean);
}
function pretokenize(text) {
	const out = [];
	for (const word of text.split(/\s+/)) {
		if (!word) continue;
		out.push(...isolatePunctuation(word));
	}
	return out;
}
var WordLevelTokenizer = class {
	spec;
	constructor(spec) {
		this.spec = spec;
	}
	get mask_token() {
		return this.spec.maskToken;
	}
	get mask_token_id() {
		return this.spec.maskId;
	}
	get cls_token_id() {
		return this.spec.clsId;
	}
	get sep_token_id() {
		return this.spec.sepId;
	}
	get pad_token_id() {
		return this.spec.padId;
	}
	encode(text) {
		return pretokenize(text).map((tok) => this.spec.vocab[tok] ?? this.spec.unkId);
	}
	call(text) {
		return { input_ids: this.encode(text) };
	}
};
async function loadTokenizer(base = "/models/moka-tiny") {
	const [tok, cfg] = await Promise.all([fetch(`${base}/tokenizer/tokenizer.json`).then((r) => r.json()), fetch(`${base}/tokenizer/tokenizer_config.json`).then((r) => r.json())]);
	const vocab = tok.model.vocab;
	const id = (name) => {
		const raw = cfg[name];
		const value = typeof raw === "string" ? raw : raw?.content;
		const tokenId = vocab[value];
		if (tokenId == null) throw new Error(`Tokenizer missing ${name}`);
		return {
			value,
			tokenId
		};
	};
	const cls = id("cls_token");
	const sep = id("sep_token");
	const mask = id("mask_token");
	const pad = id("pad_token");
	return new WordLevelTokenizer({
		vocab,
		unkId: vocab["[UNK]"] ?? 0,
		clsId: cls.tokenId,
		sepId: sep.tokenId,
		maskId: mask.tokenId,
		padId: pad.tokenId,
		maskToken: mask.value,
		clsToken: cls.value,
		sepToken: sep.value,
		padToken: pad.value
	});
}
var TEMP_MIN = .5;
var TEMP_MAX = 5;
function clampTemp(t) {
	const n = typeof t === "number" ? t : Number(t);
	if (!Number.isFinite(n)) return 1;
	return Math.min(TEMP_MAX, Math.max(TEMP_MIN, n));
}
function softmax(z) {
	const m = Math.max(...z);
	const e = z.map((v) => Math.exp(v - m));
	const s = e.reduce((a, b) => a + b, 0);
	return e.map((v) => v / s);
}
function confidence(p, k) {
	if (k < 2) return 1;
	let ent = 0;
	for (let i = 0; i < k; i++) {
		const v = Math.min(1, Math.max(1e-12, p[i]));
		ent -= v * Math.log(v);
	}
	return Math.min(1, Math.max(0, 1 - ent / Math.log(k)));
}
function tempBucket(qtype, k) {
	const names = [
		"choice",
		"score",
		"noul"
	];
	const size = k <= 2 ? "2" : k <= 5 ? "3-5" : k <= 10 ? "6-10" : "11+";
	return `${names[qtype]}:${size}`;
}
function toInt64(arr) {
	const out = new BigInt64Array(arr.length);
	for (let i = 0; i < arr.length; i++) out[i] = BigInt(arr[i]);
	return out;
}
var wasmReady = false;
function configureOrt() {
	if (wasmReady) return;
	Y.wasm.numThreads = 1;
	Y.wasm.simd = true;
	Y.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";
	wasmReady = true;
}
var MokaAgent = class MokaAgent {
	session;
	tok;
	manifest;
	cfg;
	temperature;
	temperatureByOptions;
	inputNames;
	static async load(base = "/models/moka-tiny") {
		configureOrt();
		const agent = new MokaAgent();
		const [manifest, cfg, tok, session] = await Promise.all([
			fetch(`${base}/moka_config.json`).then((r) => r.json()),
			fetch(`${base}/rl_agent_config.json`).then((r) => r.json()),
			loadTokenizer(base),
			rs.create(`${base}/model.onnx`, { executionProviders: ["wasm"] })
		]);
		agent.manifest = manifest;
		agent.cfg = cfg;
		agent.tok = tok;
		agent.session = session;
		agent.inputNames = session.inputNames;
		agent.temperature = (cfg.temperature ?? [
			1,
			1,
			1
		]).map(clampTemp);
		agent.temperatureByOptions = Object.fromEntries(Object.entries(cfg.temperature_by_options ?? {}).map(([k, v]) => [k, clampTemp(v)]));
		return agent;
	}
	async predict(state, questions) {
		const { items, internal } = prepare(this.tok, state, questions, this.cfg.max_len ?? 96, this.cfg.head_max_len ?? 48);
		const shape = this.manifest.shape;
		const answers = {};
		const ids = Object.keys(questions);
		const batchSize = shape.batch_size || 8;
		for (let start = 0; start < items.length; start += batchSize) {
			const chunk = items.slice(start, start + batchSize);
			const packed = collateItems(chunk, this.tok.pad_token_id, shape);
			const feeds = {};
			for (const name of this.inputNames) {
				const data = packed[name];
				if (!data) throw new Error(`Missing feed ${name}`);
				feeds[name] = new de("int64", toInt64(data), dims(packed, name));
			}
			const out = await this.session.run(feeds);
			const logitsT = out.logits;
			const actionT = out.action_logits;
			const logits = logitsT.data;
			const action = actionT.data;
			const kMax = shape.max_options;
			const actDim = action.length / chunk.length;
			chunk.forEach((item, row) => {
				const q = internal[start + row];
				const qid = ids[start + row];
				const k = item.markers.length;
				const scale = this.temperatureByOptions[tempBucket(item.qtype, k)] ?? this.temperature[item.qtype] ?? 1;
				const z = [];
				for (let i = 0; i < k; i++) z.push(Number(logits[row * kMax + i]) / scale);
				const p = softmax(z);
				const actRow = [];
				for (let i = 0; i < actDim; i++) actRow.push(Number(action[row * actDim + i]));
				const actSoft = softmax(actRow);
				const base = {
					confidence: round4(confidence(p, k)),
					action: { act_probability: round4(actSoft[0] ?? 0) }
				};
				if (q.t === "choice") {
					const labels = Object.keys(q.crit);
					const choice = labels[argmax(p)];
					answers[qid] = {
						type: "choice",
						choice,
						probabilities: Object.fromEntries(labels.map((l, i) => [l, round4(p[i])])),
						...base
					};
				} else if (q.t === "score") {
					const score = p.reduce((s, v, i) => s + v * i, 0);
					answers[qid] = {
						type: "score",
						score: round4(score),
						legend: Object.fromEntries(q.crit.map((v, i) => [String(i), v])),
						probabilities: Object.fromEntries(p.map((v, i) => [String(i), round4(v)])),
						...base
					};
				} else answers[qid] = {
					type: "noul",
					noul: round4(p[1] ?? 0),
					...base,
					confidence: round4(Math.max(p[1] ?? 0, 1 - (p[1] ?? 0)))
				};
			});
		}
		return {
			model: "laya-rl-agent",
			runtime: "moka-onnx-wasm",
			answers,
			usage: {
				input_tokens: items.reduce((s, it) => s + it.ids.length, 0),
				output_tokens: 0
			}
		};
	}
};
function argmax(p) {
	let i = 0;
	for (let k = 1; k < p.length; k++) if (p[k] > p[i]) i = k;
	return i;
}
function round4(n) {
	return Math.round(n * 1e4) / 1e4;
}
var pending = null;
function loadStudioAgent() {
	if (!pending) pending = MokaAgent.load("/models/moka-tiny").catch((err) => {
		pending = null;
		throw err;
	});
	return pending;
}
//#endregion
export { loadStudioAgent as t };
