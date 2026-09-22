import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { R as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/convert-DXQft_r_.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ConvertPage() {
	const [manifest, setManifest] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		fetch("/models/moka-tiny/moka_config.json").then((r) => r.json()).then(setManifest).catch(() => setManifest(null));
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "space-y-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "space-y-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs uppercase tracking-[0.22em] text-muted",
						children: "Conversion"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-3xl tracking-tight",
						children: "From Laya safetensors to an ONNX bundle"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "max-w-2xl text-sm leading-relaxed text-muted",
						children: "The converter loads original checkpoints into an export-only ModernBERT graph (state-dict names unchanged), writes ONNX, and records checksums plus the upstream revision. Inference never imports Transformers."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
				className: "overflow-x-auto rounded-lg border border-border bg-bg-elevated p-4 font-mono text-xs leading-relaxed text-accent",
				children: `pip install 'moka[convert]'
moka convert convaiinnovations/laya-typed-decisions models/typed
moka convert laya-multilingual models/multi --max-length 96
moka convert laya models/english-int8 --quantize int8   # approximate, gated`
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-4 sm:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "rounded-lg border border-border bg-surface p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-medium",
						children: "Default graph"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm leading-relaxed text-muted",
						children: "Explicit matmul/softmax attention, opset 17, dynamic batch and sequence. SDPA is an experiment flag: it can emit ops CPU EP cannot run."
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "rounded-lg border border-border bg-surface p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-medium",
						children: "What did not ship"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm leading-relaxed text-muted",
						children: "421M/322M Hub conversion did not fit in 4 GiB RAM on this host. INT8 missed the answer-match gate. TensorRT is never implicit. OpenVINO was not installed."
					})]
				})]
			}),
			manifest && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-lg border border-border bg-surface p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-medium",
					children: "Live bundle provenance"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
					className: "mt-3 grid gap-2 font-mono text-xs sm:grid-cols-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							k: "format",
							v: manifest.format
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							k: "precision",
							v: manifest.precision
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							k: "approximate",
							v: String(manifest.approximate)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							k: "attention",
							v: manifest.attention
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							k: "opset",
							v: String(manifest.opset)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							k: "convert s",
							v: manifest.conversion_seconds.toFixed(3)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							k: "weights sha256",
							v: manifest.source_weights_sha256.slice(0, 20) + "…"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
							k: "torch / ort",
							v: `${manifest.versions.torch} / ${manifest.versions.onnxruntime}`
						})
					]
				})]
			})
		]
	});
}
function Row({ k, v }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex justify-between gap-3 border-b border-border py-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
			className: "text-subtle",
			children: k
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
			className: "truncate text-fg",
			children: v
		})]
	});
}
//#endregion
export { ConvertPage as component };
