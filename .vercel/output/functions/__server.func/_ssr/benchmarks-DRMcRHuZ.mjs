import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { R as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Bar, i as CartesianGrid, n as YAxis, o as ResponsiveContainer, r as XAxis, s as Tooltip, t as BarChart } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/benchmarks-DRMcRHuZ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function BenchmarksPage() {
	const [data, setData] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		fetch("/data/studio.json").then((r) => r.json()).then(setData).catch(() => setData(null));
	}, []);
	const chart = data ? [{
		name: "PyTorch eager",
		p50: data.latency_pytorch.p50_ms,
		p95: data.latency_pytorch.p95_ms
	}, {
		name: "ORT CPU",
		p50: data.latency_ort.p50_ms,
		p95: data.latency_ort.p95_ms
	}] : [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "space-y-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "space-y-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs uppercase tracking-[0.22em] text-muted",
						children: "Benchmarks"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-3xl tracking-tight",
						children: "Measured, not estimated"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "max-w-2xl text-sm leading-relaxed text-muted",
						children: [
							data?.host.cpu,
							", ",
							data?.host.cores,
							" cores, ",
							(data ? data.host.ram_bytes / 1e9 : 0).toFixed(1),
							" ",
							"GB RAM, GPU none. Python ",
							data?.host.python,
							", ONNX Runtime ",
							data?.onnxruntime,
							". Wall time includes prompt, tokenize, session.run, calibration. Warmup excluded."
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-64 rounded-lg border border-border bg-surface p-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
					width: "100%",
					height: "100%",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
						data: chart,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
								stroke: "rgba(242,235,228,0.08)",
								vertical: false
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
								dataKey: "name",
								stroke: "#9c9288",
								fontSize: 12
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
								stroke: "#9c9288",
								fontSize: 12,
								unit: " ms"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, { contentStyle: {
								background: "#171412",
								border: "1px solid rgba(242,235,228,0.12)",
								color: "#f2ebe4"
							} }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
								dataKey: "p50",
								fill: "#d9cfc4",
								name: "P50 ms",
								radius: [
									4,
									4,
									0,
									0
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
								dataKey: "p95",
								fill: "#c17a4a",
								name: "P95 ms",
								radius: [
									4,
									4,
									0,
									0
								]
							})
						]
					})
				})
			}),
			data && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-3 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						label: "ORT P50 / P95",
						value: `${data.latency_ort.p50_ms.toFixed(2)} / ${data.latency_ort.p95_ms.toFixed(2)} ms`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						label: "Speedup vs eager",
						value: `${data.speedup_vs_pytorch.toFixed(2)}×`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						label: "ORT decisions/s",
						value: data.latency_ort.decisions_per_sec.toFixed(0)
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: "rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed text-muted",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-medium text-fg",
					children: "Energy"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2",
					children: data?.energy.reason
				})]
			}),
			data && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: "rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed text-muted",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-medium text-fg",
					children: "Snake loop"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2",
					children: [
						"Headless 180 steps, score ",
						data.snake.score,
						", ",
						data.snake.interventions,
						" safety interventions, ",
						data.snake.decisions_per_sec.toFixed(1),
						" decisions/s including inference. Terminal painting excluded."
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-subtle",
				children: "Tiny student graph. A 421M number from this box would be fiction — the conversion did not fit in RAM. See docs/BENCHMARKS.md in the package."
			})
		]
	});
}
function Metric({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-border bg-surface p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs uppercase tracking-[0.16em] text-subtle",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 font-mono text-xl tabular-nums",
			children: value
		})]
	});
}
//#endregion
export { BenchmarksPage as component };
