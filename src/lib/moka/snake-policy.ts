import type { MokaAgent } from "./agent";
import { DIRECTIONS, SnakeGame, type Direction } from "./snake-game";

export type Decision = {
  probabilities: Record<string, number>;
  proposed: Direction;
  executed: Direction;
  safeDirections: Direction[];
  intervened: boolean;
  deadEndRisk: number;
  foodReachable: number;
  inferenceMs: number;
  decisionMs: number;
  inputTokens: number;
  outputTokens: number;
  safeCount: number;
  plannerBest: string;
};

export async function decide(
  agent: MokaAgent,
  game: SnakeGame,
  guarded = true,
): Promise<Decision> {
  const started = performance.now();
  const moves = game.moves();
  const safe = moves.filter((m) => m.safe);
  if (!safe.length && guarded) throw new Error("Cycle safety invariant violated: no safe action");
  const preferred = safe.length
    ? safe.reduce((a, b) => (a.advance >= b.advance ? a : b)).direction
    : "NONE";
  const { reachable } = game.foodReachability();
  const criteria: Record<string, string> = {};
  for (const m of moves) {
    criteria[m.direction] = !m.legal
      ? "Blocked. Collision."
      : !m.safe
        ? "Unsafe. Traps the snake."
        : m.eats
          ? "Safe. Eat food now. Best."
          : m.direction === preferred
            ? "Safe. Best route to food."
            : "Safe. Slower route.";
  }
  const state = `Safe route: ${safe.length ? "yes" : "no"}. Food reachable through empty cells: ${reachable ? "yes" : "no"}.`;
  const questions = {
    move: {
      type: "choice" as const,
      instructions: "Choose the best safe move toward food.",
      criteria,
    },
    risk: { type: "noul" as const, instructions: "Is a safe route available?" },
    food: { type: "noul" as const, instructions: "Is food reachable through empty cells?" },
  };
  const tInf = performance.now();
  const output = await agent.predict(state, questions);
  const inferenceMs = performance.now() - tInf;
  const move = output.answers.move;
  if (move.type !== "choice") throw new Error("expected choice");
  const probabilities = move.probabilities;
  const proposed = DIRECTIONS.reduce((a, b) =>
    (probabilities[a] ?? 0) >= (probabilities[b] ?? 0) ? a : b,
  );
  const allowed = safe.map((m) => m.direction);
  const executed =
    guarded && allowed.length && !allowed.includes(proposed)
      ? allowed.reduce((a, b) => ((probabilities[a] ?? 0) >= (probabilities[b] ?? 0) ? a : b))
      : proposed;
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
    plannerBest: preferred,
  };
}
