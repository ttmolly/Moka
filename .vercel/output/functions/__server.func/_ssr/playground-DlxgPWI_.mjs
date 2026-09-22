import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { R as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as Badge } from "./badge-BKiI4iGl.mjs";
import { t as Button } from "./button-CJSwB56r.mjs";
import { t as loadStudioAgent } from "./load-DND-U4y0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/playground-DlxgPWI_.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var QUESTIONS = {
	department: {
		type: "choice",
		instructions: "Which department should handle this email?",
		criteria: {
			billing: "invoices payments refunds",
			technical: "bugs outages system errors",
			sales: "pricing new contracts",
			other: "everything else"
		}
	},
	urgency: {
		type: "score",
		instructions: "How urgent is this request?",
		criteria: [
			"not urgent",
			"soon",
			"critical deadline or blocking issue"
		]
	},
	refund: {
		type: "noul",
		instructions: "Does the customer request a refund?"
	}
};
var PRESETS = {
	billing: {
		label: "Duplicate charge",
		state: "I was charged twice for invoice please refund it today.",
		questions: QUESTIONS
	},
	technical: {
		label: "System outage",
		state: "The system errors and outages block our plan.",
		questions: QUESTIONS
	},
	sales: {
		label: "New contracts",
		state: "Please send pricing for new contracts.",
		questions: QUESTIONS
	}
};
function Playground() {
	const [presetId, setPresetId] = (0, import_react.useState)("billing");
	const preset = PRESETS[presetId];
	const [state, setState] = (0, import_react.useState)(preset.state);
	const [status, setStatus] = (0, import_react.useState)("idle");
	const [error, setError] = (0, import_react.useState)(null);
	const [result, setResult] = (0, import_react.useState)(null);
	const [ms, setMs] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		setStatus("loading");
		loadStudioAgent().then(() => setStatus("ready")).catch((err) => {
			setStatus("error");
			setError(err.message);
		});
	}, []);
	function applyPreset(id) {
		setPresetId(id);
		setState(PRESETS[id].state);
		setResult(null);
		setMs(null);
		setError(null);
	}
	async function run() {
		setError(null);
		setStatus("loading");
		try {
			const agent = await loadStudioAgent();
			let parsed = state;
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "space-y-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs uppercase tracking-[0.22em] text-muted",
						children: "Playground"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-3xl tracking-tight",
						children: "Ask for a typed decision"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "max-w-2xl text-sm leading-relaxed text-muted",
						children: [
							"Runs the converted ONNX graph in this browser via ONNX Runtime WASM. Same choice / score / noul contract as the Python package. The weights here are the compact",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-fg",
								children: " moka-tiny "
							}),
							" student — a runtime demo, not the 421M Hub checkpoint."
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-2",
				children: Object.keys(PRESETS).map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: presetId === id ? "primary" : "secondary",
					onClick: () => applyPreset(id),
					children: PRESETS[id].label
				}, id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-6 lg:grid-cols-[1.1fr_0.9fr]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "text-xs uppercase tracking-[0.16em] text-subtle",
							children: "State"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							value: state,
							onChange: (e) => setState(e.target.value),
							className: "min-h-56 w-full rounded-md border border-border bg-bg-elevated p-3 font-mono text-sm leading-relaxed text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									onClick: run,
									disabled: status === "loading",
									children: status === "loading" ? "Running…" : "Predict"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: status === "ready" ? "ok" : status === "error" ? "danger" : "muted",
									children: status === "ready" ? "ORT WASM ready" : status
								}),
								ms != null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-mono text-xs tabular-nums text-muted",
									children: [ms.toFixed(1), " ms end-to-end"]
								})
							]
						}),
						error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-danger",
							children: error
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "rounded-lg border border-border bg-surface p-4",
					children: [!result && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "No answers yet."
					}), result && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-5",
						children: [Object.entries(result.answers).map(([id, answer]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnswerCard, {
							id,
							answer
						}, id)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-mono text-xs text-subtle",
							children: [
								"input ",
								result.usage.input_tokens,
								" · output ",
								result.usage.output_tokens,
								" ·",
								" ",
								result.runtime
							]
						})]
					})]
				})]
			})
		]
	});
}
function AnswerCard({ id, answer }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "space-y-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-baseline justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-medium",
					children: id
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: answer.type })]
			}),
			answer.type === "choice" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display text-xl",
				children: answer.choice
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bars, { entries: Object.entries(answer.probabilities) })] }),
			answer.type === "score" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-mono text-xl tabular-nums",
				children: answer.score.toFixed(3)
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bars, { entries: Object.entries(answer.probabilities) })] }),
			answer.type === "noul" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-mono text-xl tabular-nums",
				children: answer.noul.toFixed(3)
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bars, { entries: [["false", 1 - answer.noul], ["true", answer.noul]] })] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-subtle",
				children: [
					"confidence ",
					answer.confidence.toFixed(3),
					" · act ",
					answer.action.act_probability.toFixed(3)
				]
			})
		]
	});
}
function Bars({ entries }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "space-y-1.5",
		children: entries.map(([label, value]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-xs",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate text-muted",
					children: label
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "h-1.5 overflow-hidden rounded-full bg-surface-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block h-full rounded-full bg-accent",
						style: { width: `${Math.max(2, value * 100)}%` }
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono tabular-nums text-muted",
					children: value.toFixed(2)
				})
			]
		}, label))
	});
}
//#endregion
export { Playground as component };
