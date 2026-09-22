import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { R as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as Badge } from "./badge-BKiI4iGl.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/fidelity-DMmJPsAs.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function FidelityPage() {
	const [data, setData] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		fetch("/data/studio.json").then((r) => r.json()).then(setData).catch(() => setData(null));
	}, []);
	const rows = data ? [
		{
			name: "moka-tiny FP32",
			...data.fidelity_fp32,
			default: "yes"
		},
		{
			name: "moka-tiny INT8",
			...data.fidelity_int8,
			default: "no"
		},
		{
			name: "laya 421M",
			matched: 0,
			total: 0,
			max_probability_drift: 0,
			passed: false,
			stable: false,
			max_drift_budget: 1e-4,
			precision: "fp32",
			default: "not converted (RAM)"
		}
	] : [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "space-y-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "space-y-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs uppercase tracking-[0.22em] text-muted",
						children: "Fidelity"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-3xl tracking-tight",
						children: "The gate, not the vibe"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "max-w-2xl text-sm leading-relaxed text-muted",
						children: "A bundle ships as default only if selected answers match the PyTorch export graph on every fixture, max calibrated drift is inside budget, and repeated calls are stable. Conversion fidelity is not task accuracy."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-x-auto rounded-lg border border-border",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-[40rem] text-left text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "bg-surface text-xs uppercase tracking-[0.14em] text-subtle",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2 font-medium",
								children: "Artifact"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2 font-medium",
								children: "Match"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2 font-medium",
								children: "Max drift"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2 font-medium",
								children: "Budget"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2 font-medium",
								children: "Gate"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2 font-medium",
								children: "Default"
							})
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-t border-border",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2",
								children: row.name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2 font-mono tabular-nums",
								children: row.total ? `${row.matched}/${row.total}` : "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2 font-mono tabular-nums",
								children: row.total ? row.max_probability_drift.toFixed(4) : "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2 font-mono tabular-nums",
								children: row.max_drift_budget
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2",
								children: row.name.includes("421M") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: "not run" }) : row.passed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: "ok",
									children: "passed"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: "danger",
									children: "failed"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2 text-muted",
								children: row.default
							})
						]
					}, row.name)) })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("article", {
				className: "rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed text-muted",
				children: "INT8 stayed inside the 0.02 drift budget (0.0098) and still failed: two selected answers flipped on the long-state fixture (41/43). Same policy as laya-coreml’s unpublished 6-bit/4-bit experiments — keep the row, refuse the default."
			})
		]
	});
}
//#endregion
export { FidelityPage as component };
