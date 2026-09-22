import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { R as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as Badge } from "./badge-BKiI4iGl.mjs";
import { t as Button } from "./button-CJSwB56r.mjs";
import { t as loadStudioAgent } from "./load-DND-U4y0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/snake-BLmCbckT.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var DIRECTIONS = [
	"UP",
	"DOWN",
	"LEFT",
	"RIGHT"
];
var VECTORS = {
	UP: [0, -1],
	DOWN: [0, 1],
	LEFT: [-1, 0],
	RIGHT: [1, 0]
};
function hamiltonianCycle(width, height) {
	if (Math.min(width, height) < 4 || width % 2 && height % 2) throw new Error("Board dimensions must be >= 4, with at least one even dimension");
	if (height % 2) return hamiltonianCycle(height, width).map(([x, y]) => [y, x]);
	const path = [[0, 0]];
	for (let y = 0; y < height; y++) if (y % 2 === 0) for (let x = 1; x < width; x++) path.push([x, y]);
	else for (let x = width - 1; x > 0; x--) path.push([x, y]);
	for (let y = height - 1; y > 0; y--) path.push([0, y]);
	return path;
}
var SnakeGame = class {
	width;
	height;
	seed;
	cycle;
	indices;
	capacity;
	initialLength;
	rng;
	body;
	score = 0;
	ticks = 0;
	alive = true;
	won = false;
	deathReason = null;
	food = null;
	constructor(width = 24, height = 16, seed = 7, initialLength = 6) {
		this.width = width;
		this.height = height;
		this.seed = seed;
		this.cycle = hamiltonianCycle(width, height);
		this.indices = new Map(this.cycle.map((cell, i) => [`${cell[0]},${cell[1]}`, i]));
		this.capacity = width * height;
		this.initialLength = initialLength;
		this.rng = mulberry32(seed);
		const start = this.indices.get(`${Math.floor(width / 2)},${Math.floor(height / 2)}`) ?? 0;
		this.body = [];
		for (let i = 0; i < initialLength; i++) this.body.push(this.cycle[(start - i + this.capacity) % this.capacity]);
		this.food = this.spawnFood();
	}
	get head() {
		return this.body[0];
	}
	key(cell) {
		return `${cell[0]},${cell[1]}`;
	}
	spawnFood() {
		const occupied = new Set(this.body.map((c) => this.key(c)));
		const empty = this.cycle.filter((c) => !occupied.has(this.key(c)));
		if (!empty.length) return null;
		return empty[Math.floor(this.rng() * empty.length)];
	}
	target(direction) {
		const [dx, dy] = VECTORS[direction];
		return [this.head[0] + dx, this.head[1] + dy];
	}
	legalReason(direction) {
		const cell = this.target(direction);
		const [x, y] = cell;
		if (!(x >= 0 && x < this.width && y >= 0 && y < this.height)) return "wall";
		if (cell[0] === this.body[1]?.[0] && cell[1] === this.body[1]?.[1]) return "reverse";
		const occupied = new Set(this.body.map((c) => this.key(c)));
		if (!this.food || cell[0] !== this.food[0] || cell[1] !== this.food[1]) {
			const tail = this.body[this.body.length - 1];
			occupied.delete(this.key(tail));
		}
		return occupied.has(this.key(cell)) ? "body" : "legal";
	}
	moves() {
		if (!this.alive || this.won || !this.food) return [];
		const headIndex = this.indices.get(this.key(this.head)) ?? 0;
		const tailDistance = ((this.indices.get(this.key(this.body[this.body.length - 1])) ?? 0) - headIndex + this.capacity) % this.capacity;
		const foodDistance = ((this.indices.get(this.key(this.food)) ?? 0) - headIndex + this.capacity) % this.capacity;
		return DIRECTIONS.map((direction) => {
			let reason = this.legalReason(direction);
			const legal = reason === "legal";
			const target = this.target(direction);
			const advance = ((this.indices.get(this.key(target)) ?? headIndex) - headIndex + this.capacity) % this.capacity;
			const eats = this.food != null && target[0] === this.food[0] && target[1] === this.food[1];
			let safe = legal;
			if (safe && (advance > tailDistance || advance === tailDistance && eats)) {
				safe = false;
				reason = "would cross the tail";
			}
			if (safe && (advance === 0 || advance > foodDistance)) {
				safe = false;
				reason = "would skip the food on the safe route";
			}
			return {
				direction,
				legal,
				safe,
				advance,
				reason,
				eats
			};
		});
	}
	foodReachability() {
		const blocked = new Set(this.body.slice(1).map((c) => this.key(c)));
		const visited = /* @__PURE__ */ new Set([this.key(this.head)]);
		const queue = [this.head];
		while (queue.length) {
			const [x, y] = queue.shift();
			for (const [dx, dy] of Object.values(VECTORS)) {
				const nx = x + dx;
				const ny = y + dy;
				const key = `${nx},${ny}`;
				if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && !blocked.has(key) && !visited.has(key)) {
					visited.add(key);
					queue.push([nx, ny]);
				}
			}
		}
		return {
			reachable: this.food ? visited.has(this.key(this.food)) : false,
			space: visited.size
		};
	}
	step(direction) {
		if (!this.alive || this.won) throw new Error("Cannot step a finished game");
		this.ticks += 1;
		const reason = this.legalReason(direction);
		if (reason !== "legal") {
			this.alive = false;
			this.deathReason = reason;
			return false;
		}
		const target = this.target(direction);
		this.body.unshift(target);
		if (this.food && target[0] === this.food[0] && target[1] === this.food[1]) {
			this.score += 1;
			if (this.body.length === this.capacity) {
				this.won = true;
				this.food = null;
			} else this.food = this.spawnFood();
			return true;
		}
		this.body.pop();
		return false;
	}
	snapshot() {
		return {
			width: this.width,
			height: this.height,
			seed: this.seed,
			body: this.body.map((c) => [...c]),
			food: this.food ? [...this.food] : null,
			score: this.score,
			length: this.body.length,
			ticks: this.ticks,
			alive: this.alive,
			won: this.won,
			deathReason: this.deathReason
		};
	}
};
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a += 1831565813;
		let t = a;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
async function decide(agent, game, guarded = true) {
	const started = performance.now();
	const moves = game.moves();
	const safe = moves.filter((m) => m.safe);
	if (!safe.length && guarded) throw new Error("Cycle safety invariant violated: no safe action");
	const preferred = safe.length ? safe.reduce((a, b) => a.advance >= b.advance ? a : b).direction : "NONE";
	const { reachable } = game.foodReachability();
	const criteria = {};
	for (const m of moves) criteria[m.direction] = !m.legal ? "Blocked. Collision." : !m.safe ? "Unsafe. Traps the snake." : m.eats ? "Safe. Eat food now. Best." : m.direction === preferred ? "Safe. Best route to food." : "Safe. Slower route.";
	const state = `Safe route: ${safe.length ? "yes" : "no"}. Food reachable through empty cells: ${reachable ? "yes" : "no"}.`;
	const questions = {
		move: {
			type: "choice",
			instructions: "Choose the best safe move toward food.",
			criteria
		},
		risk: {
			type: "noul",
			instructions: "Is a safe route available?"
		},
		food: {
			type: "noul",
			instructions: "Is food reachable through empty cells?"
		}
	};
	const tInf = performance.now();
	const output = await agent.predict(state, questions);
	const inferenceMs = performance.now() - tInf;
	const move = output.answers.move;
	if (move.type !== "choice") throw new Error("expected choice");
	const probabilities = move.probabilities;
	const proposed = DIRECTIONS.reduce((a, b) => (probabilities[a] ?? 0) >= (probabilities[b] ?? 0) ? a : b);
	const allowed = safe.map((m) => m.direction);
	const executed = guarded && allowed.length && !allowed.includes(proposed) ? allowed.reduce((a, b) => (probabilities[a] ?? 0) >= (probabilities[b] ?? 0) ? a : b) : proposed;
	const risk = output.answers.risk;
	const food = output.answers.food;
	return {
		probabilities,
		proposed,
		executed,
		safeDirections: allowed,
		intervened: proposed !== executed,
		deadEndRisk: risk.type === "noul" ? 1 - risk.noul : 0,
		foodReachable: food.type === "noul" ? food.noul : 0,
		inferenceMs,
		decisionMs: performance.now() - started,
		inputTokens: output.usage.input_tokens,
		outputTokens: output.usage.output_tokens,
		safeCount: safe.length,
		plannerBest: preferred
	};
}
function SnakePage() {
	const canvasRef = (0, import_react.useRef)(null);
	const gameRef = (0, import_react.useRef)(null);
	const [ready, setReady] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [running, setRunning] = (0, import_react.useState)(false);
	const [decision, setDecision] = (0, import_react.useState)(null);
	const [stats, setStats] = (0, import_react.useState)({
		score: 0,
		length: 6,
		ticks: 0,
		interventions: 0,
		rate: 0
	});
	const interRef = (0, import_react.useRef)(0);
	const startedRef = (0, import_react.useRef)(0);
	const accRef = (0, import_react.useRef)(0);
	const busyRef = (0, import_react.useRef)(false);
	const rafRef = (0, import_react.useRef)(0);
	(0, import_react.useEffect)(() => {
		loadStudioAgent().then(() => setReady(true)).catch((err) => setError(err.message));
	}, []);
	(0, import_react.useEffect)(() => {
		const game = new SnakeGame(20, 12, 7, 5);
		gameRef.current = game;
		paint(canvasRef.current, game, null);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!running) return;
		let last = performance.now();
		const interval = 1 / 8;
		const frame = (now) => {
			const dt = Math.min(.1, (now - last) / 1e3);
			last = now;
			accRef.current += dt;
			const game = gameRef.current;
			if (game) paint(canvasRef.current, game, null);
			if (!busyRef.current && accRef.current >= interval && game && game.alive && !game.won) {
				accRef.current = 0;
				busyRef.current = true;
				(async () => {
					try {
						const d = await decide(await loadStudioAgent(), game, true);
						if (d.intervened) interRef.current += 1;
						game.step(d.executed);
						setDecision(d);
						const elapsed = (performance.now() - startedRef.current) / 1e3;
						setStats({
							score: game.score,
							length: game.body.length,
							ticks: game.ticks,
							interventions: interRef.current,
							rate: elapsed ? game.ticks / elapsed : 0
						});
						if (!game.alive || game.won) setRunning(false);
					} catch (err) {
						setError(err instanceof Error ? err.message : String(err));
						setRunning(false);
					} finally {
						busyRef.current = false;
					}
				})();
			}
			rafRef.current = requestAnimationFrame(frame);
		};
		rafRef.current = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(rafRef.current);
	}, [running]);
	function play() {
		if (!gameRef.current) return;
		startedRef.current = performance.now();
		setRunning(true);
	}
	function reset() {
		setRunning(false);
		busyRef.current = false;
		accRef.current = 0;
		interRef.current = 0;
		const game = new SnakeGame(20, 12, 7, 5);
		gameRef.current = game;
		setDecision(null);
		setStats({
			score: 0,
			length: 5,
			ticks: 0,
			interventions: 0,
			rate: 0
		});
		setRunning(false);
		paint(canvasRef.current, game, null);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "space-y-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "space-y-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs uppercase tracking-[0.22em] text-muted",
					children: "Demo"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-3xl tracking-tight",
					children: "A real model playing Snake"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "max-w-2xl text-sm leading-relaxed text-muted",
					children: "Compact planner features go into the typed questions. The ONNX graph returns direction probabilities. A Hamiltonian cycle shield overrides unsafe argmax and counts the intervention — the same policy as laya-coreml, on Linux/WASM."
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-6 lg:grid-cols-[1.2fr_0.8fr]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-hidden rounded-xl border border-border bg-bg-elevated p-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
					ref: canvasRef,
					className: "h-auto w-full touch-none",
					style: { imageRendering: "pixelated" }
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								onClick: play,
								disabled: !ready || running,
								children: running ? "Running" : "Play"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "secondary",
								onClick: reset,
								children: "Reset"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: ready ? "ok" : "muted",
								children: ready ? "model loaded" : "loading weights"
							})
						]
					}),
					error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-danger",
						children: error
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
						className: "grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hud, {
								label: "score",
								value: String(stats.score)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hud, {
								label: "length",
								value: String(stats.length)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hud, {
								label: "ticks",
								value: String(stats.ticks)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hud, {
								label: "shield",
								value: String(stats.interventions)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hud, {
								label: "dec/s",
								value: stats.rate.toFixed(1)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hud, {
								label: "infer",
								value: decision ? `${decision.inferenceMs.toFixed(1)} ms` : "—"
							})
						]
					}),
					decision && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-2 rounded-lg border border-border bg-surface p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs uppercase tracking-[0.16em] text-subtle",
								children: "Move probabilities"
							}),
							Object.entries(decision.probabilities).map(([dir, p]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-[3.5rem_1fr_3rem] items-center gap-2 text-xs",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: dir === decision.executed ? "text-fg" : "text-muted",
										children: dir
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "h-1.5 overflow-hidden rounded-full bg-surface-2",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: `block h-full rounded-full ${dir === decision.proposed ? "bg-live" : "bg-accent"}`,
											style: { width: `${Math.max(2, p * 100)}%` }
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-mono tabular-nums text-muted",
										children: p.toFixed(2)
									})
								]
							}, dir)),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-muted",
								children: [
									"proposed ",
									decision.proposed,
									decision.intervened ? ` · shield took ${decision.executed}` : ` · executed ${decision.executed}`,
									" · planner ",
									decision.plannerBest
								]
							})
						]
					})
				]
			})]
		})]
	});
}
function Hud({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
		className: "text-xs uppercase tracking-[0.16em] text-subtle",
		children: label
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
		className: "font-mono text-lg tabular-nums",
		children: value
	})] });
}
function paint(canvas, game, decision) {
	if (!canvas) return;
	const cell = 22;
	const dpr = Math.min(2, window.devicePixelRatio || 1);
	canvas.width = game.width * cell * dpr;
	canvas.height = game.height * cell * dpr;
	canvas.style.width = "100%";
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.fillStyle = "#171412";
	ctx.fillRect(0, 0, game.width * cell, game.height * cell);
	ctx.strokeStyle = "rgba(242,235,228,0.05)";
	for (let x = 0; x <= game.width; x++) {
		ctx.beginPath();
		ctx.moveTo(x * cell, 0);
		ctx.lineTo(x * cell, game.height * cell);
		ctx.stroke();
	}
	for (let y = 0; y <= game.height; y++) {
		ctx.beginPath();
		ctx.moveTo(0, y * cell);
		ctx.lineTo(game.width * cell, y * cell);
		ctx.stroke();
	}
	if (game.food) {
		ctx.fillStyle = "#c17a4a";
		ctx.beginPath();
		ctx.arc(game.food[0] * cell + cell / 2, game.food[1] * cell + cell / 2, cell * .28, 0, Math.PI * 2);
		ctx.fill();
	}
	game.body.forEach((seg, i) => {
		ctx.fillStyle = i === 0 ? "#f2ebe4" : "rgba(217,207,196,0.75)";
		const pad = i === 0 ? 3 : 5;
		ctx.fillRect(seg[0] * cell + pad, seg[1] * cell + pad, cell - pad * 2, cell - pad * 2);
	});
}
//#endregion
export { SnakePage as component };
