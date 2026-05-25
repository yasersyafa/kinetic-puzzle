// DEPRECATED: not updated for v2 mechanics (sliding momentum, constrained, dependent).
// Levels are now hand-authored; this solver is unused at runtime. Kept for reference only.
// eslint-disable
// @ts-nocheck
import { BlockData, Direction, ExitSide, ExitZone, LevelData } from '../types/Game';

type Pos = [number, number] | null;

interface SolverResult {
  solvable: boolean;
  optimalMoves: number;
  visited: number;
}

const DIR_TO_SIDE: Record<Direction, ExitSide> = {
  UP: 'TOP',
  DOWN: 'BOTTOM',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
};

const DELTA: Record<Direction, [number, number]> = {
  UP: [0, -1],
  DOWN: [0, 1],
  LEFT: [-1, 0],
  RIGHT: [1, 0],
};

const DIRS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
const ALL_SIDES: ExitSide[] = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT'];

interface SolverContext {
  cols: number;
  rows: number;
  simple: BlockData[];
  obstacles: Set<number>;
  exits: Set<string>;
  exitCellsBySide: Record<ExitSide, [number, number][]>;
}

interface Heap<T> {
  push(val: T, pri: number): void;
  pop(): T | undefined;
  size: number;
}

class MinHeap<T> implements Heap<T> {
  private items: { v: T; p: number }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(v: T, p: number): void {
    this.items.push({ v, p });
    this.up(this.items.length - 1);
  }

  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0].v;
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.down(0);
    }
    return top;
  }

  private up(i: number): void {
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (this.items[par].p <= this.items[i].p) break;
      const tmp = this.items[par];
      this.items[par] = this.items[i];
      this.items[i] = tmp;
      i = par;
    }
  }

  private down(i: number): void {
    const n = this.items.length;
    while (true) {
      const l = i * 2 + 1;
      const r = l + 1;
      let best = i;
      if (l < n && this.items[l].p < this.items[best].p) best = l;
      if (r < n && this.items[r].p < this.items[best].p) best = r;
      if (best === i) break;
      const tmp = this.items[best];
      this.items[best] = this.items[i];
      this.items[i] = tmp;
      i = best;
    }
  }
}

function cellKey(col: number, row: number, cols: number): number {
  return row * cols + col;
}

function exitKey(side: ExitSide, index: number): string {
  return `${side}:${index}`;
}

function stateKey(positions: Pos[]): string {
  let s = '';
  for (const p of positions) {
    if (!p) s += 'X|';
    else s += `${p[0]},${p[1]}|`;
  }
  return s;
}

function exitCellTarget(
  side: ExitSide,
  idx: number,
  cols: number,
  rows: number
): [number, number] {
  if (side === 'TOP') return [idx, 0];
  if (side === 'BOTTOM') return [idx, rows - 1];
  if (side === 'LEFT') return [0, idx];
  return [cols - 1, idx];
}

function buildContext(level: LevelData): SolverContext {
  const simple = level.blocks.filter((b) => (b.type ?? 'simple') === 'simple');
  const obstacles = new Set<number>(
    level.blocks
      .filter((b) => b.type === 'obstacle')
      .map((b) => cellKey(b.position[0], b.position[1], level.cols))
  );
  const exits = new Set<string>(level.exits.map((e) => exitKey(e.side, e.index)));

  const exitCellsBySide: Record<ExitSide, [number, number][]> = {
    TOP: [],
    BOTTOM: [],
    LEFT: [],
    RIGHT: [],
  };
  for (const e of level.exits) {
    exitCellsBySide[e.side].push(exitCellTarget(e.side, e.index, level.cols, level.rows));
  }

  return { cols: level.cols, rows: level.rows, simple, obstacles, exits, exitCellsBySide };
}

function heuristic(ctx: SolverContext, positions: Pos[]): number {
  let h = 0;
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    if (!p) continue;
    const allowed = ctx.simple[i].allowedExits ?? ALL_SIDES;
    let min = Infinity;
    for (const side of allowed) {
      const cells = ctx.exitCellsBySide[side];
      for (const [tx, ty] of cells) {
        const d = Math.abs(p[0] - tx) + Math.abs(p[1] - ty) + 1;
        if (d < min) min = d;
      }
    }
    if (min === Infinity) return Infinity;
    h += min;
  }
  return h;
}

function attempt(
  ctx: SolverContext,
  positions: Pos[],
  blockIdx: number,
  dir: Direction
): { kind: 'slide'; nextX: number; nextY: number } | { kind: 'exit' } | null {
  const cur = positions[blockIdx];
  if (!cur) return null;
  const [x, y] = cur;
  const block = ctx.simple[blockIdx];
  const allowed = block.allowedExits ?? ALL_SIDES;

  const wantsToExit =
    (dir === 'LEFT' && x === 0) ||
    (dir === 'UP' && y === 0) ||
    (dir === 'RIGHT' && x === ctx.cols - 1) ||
    (dir === 'DOWN' && y === ctx.rows - 1);

  if (wantsToExit) {
    const side = DIR_TO_SIDE[dir];
    if (!allowed.includes(side)) return null;
    const idx = side === 'LEFT' || side === 'RIGHT' ? y : x;
    if (!ctx.exits.has(exitKey(side, idx))) return null;
    return { kind: 'exit' };
  }

  const [dx, dy] = DELTA[dir];
  const nx = x + dx;
  const ny = y + dy;
  if (nx < 0 || nx >= ctx.cols || ny < 0 || ny >= ctx.rows) return null;

  if (ctx.obstacles.has(cellKey(nx, ny, ctx.cols))) return null;
  for (let i = 0; i < positions.length; i++) {
    if (i === blockIdx) continue;
    const p = positions[i];
    if (!p) continue;
    if (p[0] === nx && p[1] === ny) return null;
  }
  return { kind: 'slide', nextX: nx, nextY: ny };
}

export function solve(
  level: LevelData,
  options: { maxVisited?: number; maxDepth?: number } = {}
): SolverResult {
  const maxVisited = options.maxVisited ?? 200000;
  const maxDepth = options.maxDepth ?? 200;

  const ctx = buildContext(level);
  if (ctx.simple.length === 0) return { solvable: true, optimalMoves: 0, visited: 0 };

  const initial: Pos[] = ctx.simple.map((b) => [b.position[0], b.position[1]]);
  const initialH = heuristic(ctx, initial);
  if (initialH === Infinity) return { solvable: false, optimalMoves: 0, visited: 0 };

  type QItem = { positions: Pos[]; g: number };
  const open = new MinHeap<QItem>();
  open.push({ positions: initial, g: 0 }, initialH);

  const best = new Map<string, number>();
  best.set(stateKey(initial), 0);

  while (open.size > 0) {
    if (best.size > maxVisited) {
      return { solvable: false, optimalMoves: 0, visited: best.size };
    }
    const cur = open.pop()!;
    if (cur.g > maxDepth) continue;

    let allRemoved = true;
    for (const p of cur.positions) {
      if (p) {
        allRemoved = false;
        break;
      }
    }
    if (allRemoved) {
      return { solvable: true, optimalMoves: cur.g, visited: best.size };
    }

    const curKey = stateKey(cur.positions);
    const prevG = best.get(curKey);
    if (prevG !== undefined && prevG < cur.g) continue;

    for (let i = 0; i < cur.positions.length; i++) {
      if (!cur.positions[i]) continue;
      for (const d of DIRS) {
        const r = attempt(ctx, cur.positions, i, d);
        if (!r) continue;

        const next: Pos[] = cur.positions.slice();
        if (r.kind === 'slide') {
          next[i] = [r.nextX, r.nextY];
        } else {
          next[i] = null;
        }

        const k = stateKey(next);
        const nextG = cur.g + 1;
        const known = best.get(k);
        if (known !== undefined && known <= nextG) continue;
        best.set(k, nextG);

        const h = heuristic(ctx, next);
        if (h === Infinity) continue;
        open.push({ positions: next, g: nextG }, nextG + h);
      }
    }
  }

  return { solvable: false, optimalMoves: 0, visited: best.size };
}
