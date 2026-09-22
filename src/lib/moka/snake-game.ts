export const DIRECTIONS = ["UP", "DOWN", "LEFT", "RIGHT"] as const;
export type Direction = (typeof DIRECTIONS)[number];
export const VECTORS: Record<Direction, [number, number]> = {
  UP: [0, -1],
  DOWN: [0, 1],
  LEFT: [-1, 0],
  RIGHT: [1, 0],
};

export type MoveInfo = {
  direction: Direction;
  legal: boolean;
  safe: boolean;
  advance: number;
  reason: string;
  eats: boolean;
};

export function hamiltonianCycle(width: number, height: number): [number, number][] {
  if (Math.min(width, height) < 4 || (width % 2 && height % 2)) {
    throw new Error("Board dimensions must be >= 4, with at least one even dimension");
  }
  if (height % 2) {
    return hamiltonianCycle(height, width).map(([x, y]) => [y, x]);
  }
  const path: [number, number][] = [[0, 0]];
  for (let y = 0; y < height; y++) {
    if (y % 2 === 0) {
      for (let x = 1; x < width; x++) path.push([x, y]);
    } else {
      for (let x = width - 1; x > 0; x--) path.push([x, y]);
    }
  }
  for (let y = height - 1; y > 0; y--) path.push([0, y]);
  return path;
}

export class SnakeGame {
  width: number;
  height: number;
  seed: number;
  cycle: [number, number][];
  indices: Map<string, number>;
  capacity: number;
  initialLength: number;
  rng: () => number;
  body: [number, number][];
  score = 0;
  ticks = 0;
  alive = true;
  won = false;
  deathReason: string | null = null;
  food: [number, number] | null = null;

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
    for (let i = 0; i < initialLength; i++) {
      this.body.push(this.cycle[(start - i + this.capacity) % this.capacity]!);
    }
    this.food = this.spawnFood();
  }

  get head() {
    return this.body[0]!;
  }

  key(cell: [number, number]) {
    return `${cell[0]},${cell[1]}`;
  }

  spawnFood(): [number, number] | null {
    const occupied = new Set(this.body.map((c) => this.key(c)));
    const empty = this.cycle.filter((c) => !occupied.has(this.key(c)));
    if (!empty.length) return null;
    return empty[Math.floor(this.rng() * empty.length)]!;
  }

  target(direction: Direction): [number, number] {
    const [dx, dy] = VECTORS[direction];
    return [this.head[0] + dx, this.head[1] + dy];
  }

  legalReason(direction: Direction): string {
    const cell = this.target(direction);
    const [x, y] = cell;
    if (!(x >= 0 && x < this.width && y >= 0 && y < this.height)) return "wall";
    if (cell[0] === this.body[1]?.[0] && cell[1] === this.body[1]?.[1]) return "reverse";
    const occupied = new Set(this.body.map((c) => this.key(c)));
    if (!this.food || cell[0] !== this.food[0] || cell[1] !== this.food[1]) {
      const tail = this.body[this.body.length - 1]!;
      occupied.delete(this.key(tail));
    }
    return occupied.has(this.key(cell)) ? "body" : "legal";
  }

  moves(): MoveInfo[] {
    if (!this.alive || this.won || !this.food) return [];
    const headIndex = this.indices.get(this.key(this.head)) ?? 0;
    const tailDistance =
      ((this.indices.get(this.key(this.body[this.body.length - 1]!)) ?? 0) - headIndex + this.capacity) %
      this.capacity;
    const foodDistance =
      ((this.indices.get(this.key(this.food)) ?? 0) - headIndex + this.capacity) % this.capacity;
    return DIRECTIONS.map((direction) => {
      let reason = this.legalReason(direction);
      const legal = reason === "legal";
      const target = this.target(direction);
      const advance =
        ((this.indices.get(this.key(target)) ?? headIndex) - headIndex + this.capacity) % this.capacity;
      const eats = this.food != null && target[0] === this.food[0] && target[1] === this.food[1];
      let safe = legal;
      if (safe && (advance > tailDistance || (advance === tailDistance && eats))) {
        safe = false;
        reason = "would cross the tail";
      }
      if (safe && (advance === 0 || advance > foodDistance)) {
        safe = false;
        reason = "would skip the food on the safe route";
      }
      return { direction, legal, safe, advance, reason, eats };
    });
  }

  foodReachability(): { reachable: boolean; space: number } {
    const blocked = new Set(this.body.slice(1).map((c) => this.key(c)));
    const visited = new Set([this.key(this.head)]);
    const queue: [number, number][] = [this.head];
    while (queue.length) {
      const [x, y] = queue.shift()!;
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
    const reachable = this.food ? visited.has(this.key(this.food)) : false;
    return { reachable, space: visited.size };
  }

  step(direction: Direction): boolean {
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
      } else {
        this.food = this.spawnFood();
      }
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
      deathReason: this.deathReason,
    };
  }
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
