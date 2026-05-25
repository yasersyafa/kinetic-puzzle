// Constructive reverse-scramble bake (foundation, no auto-run).
// Builds levels by starting from solved state and applying N reverse moves.
// Guarantees par ≥ N (verified by forward A*). Currently exports primitives;
// main bake loop is gated behind CLI arg to allow incremental validation.
//
// Usage:
//   npx tsx scripts/bake-constructive.ts test         # run single-level dryrun
//   npx tsx scripts/bake-constructive.ts test L24     # dryrun for specific level
//   npx tsx scripts/bake-constructive.ts bake         # run full bake (NOT IMPLEMENTED YET)

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS as EXISTING_LEVELS, SOLUTIONS as EXISTING_SOLUTIONS } from '../src/config/Levels';

// ============================================================
// Shared types
// ============================================================
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type ExitSide = 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
export type BlockType = 'simple' | 'constrained' | 'dependent' | 'obstacle' | 'lock';

export interface BlockSpec {
  id: string;
  type: BlockType;
  pos: [number, number];
  direction?: Direction;
  dependsOn?: string;
  unlockAt?: number;
}

export interface ExitZone {
  side: ExitSide;
  index: number;
}

export interface Level {
  id: number;
  cols: number;
  rows: number;
  blocks: BlockSpec[];
  exits: ExitZone[];
  iceCells?: [number, number][];
}

// Mutable state for scramble. Mirrors solver state but written as we un-do moves.
export interface ScrambleState {
  cols: number;
  rows: number;
  // All non-obstacle blocks; positions[i] === null means block is "still exited" (not yet un-exited).
  movables: BlockSpec[];
  positions: Array<[number, number] | null>;
  obstacleSet: Set<number>;
  iceSet: Set<number>;
  exits: ExitZone[];
  exitCount: number; // forward-time count of how many blocks have exited (decremented as we un-exit during scramble)
}

const DIR_TO_SIDE: Record<Direction, ExitSide> = {
  UP: 'TOP', DOWN: 'BOTTOM', LEFT: 'LEFT', RIGHT: 'RIGHT',
};
const SIDE_TO_DIR: Record<ExitSide, Direction> = {
  TOP: 'UP', BOTTOM: 'DOWN', LEFT: 'LEFT', RIGHT: 'RIGHT',
};
const DELTA: Record<Direction, [number, number]> = {
  UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0],
};
const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
};
const DIRS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

function cellKey(c: number, r: number, cols: number): number {
  return r * cols + c;
}

function exitCell(exit: ExitZone, cols: number, rows: number): [number, number] {
  // The in-grid cell adjacent to the exit portal — block leaves from here.
  if (exit.side === 'TOP') return [exit.index, 0];
  if (exit.side === 'BOTTOM') return [exit.index, rows - 1];
  if (exit.side === 'LEFT') return [0, exit.index];
  return [cols - 1, exit.index];
}

function exitDirectionFromSide(side: ExitSide): Direction {
  // Direction a block slides to exit through this side.
  return SIDE_TO_DIR[side];
}

function isOccupied(state: ScrambleState, c: number, r: number, ignoreIdx = -1): boolean {
  if (state.obstacleSet.has(cellKey(c, r, state.cols))) return true;
  for (let i = 0; i < state.positions.length; i++) {
    if (i === ignoreIdx) continue;
    const p = state.positions[i];
    if (!p) continue;
    if (p[0] === c && p[1] === r) return true;
  }
  return false;
}

// ============================================================
// Reverse move primitive
//
// A forward move is: pick block, pick direction D, block slides max until stop or exit.
// To reverse, we pick a block currently in-grid (or exited) and find a "source" cell P_src
// such that the forward move from P_src in some direction D would land the block at its
// CURRENT cell (or take it to an exit).
//
// Two cases:
//   (a) Block currently in-grid at P_cur. Reverse move = block came from P_src along
//       direction D, with P_src..P_cur all empty (slide path). P_src is the cell where
//       block stops if we backtrack from P_cur along -D until first blocker.
//   (b) Block currently exited. Reverse move = block was at P_src, slid direction D,
//       exited at side matching D. P_cur after reverse = some cell on slide path, often
//       the cell furthest from exit (so block has further to go forward later).
//
// We pick a RANDOM valid (block, direction, source-cell) tuple. The chosen reverse move
// is "applied" by moving the block from P_cur → P_src (or from exited → P_src).
// ============================================================

export interface ReverseOption {
  blockIdx: number;
  dir: Direction;            // forward direction the block would have moved
  srcCol: number;            // cell where block ends up after reverse (= forward start)
  srcRow: number;
  fromExit: boolean;         // true if block was exited and is being un-exited
  destCol?: number;          // for non-exit reverse: cell block was at before reverse
  destRow?: number;
}

// Enumerate all valid reverse options for current state.
// Constraints:
// - Constrained block: only reverse along its direction (block can only move that way forward).
// - Dependent block: reverse only valid if its parent is currently "still exited".
//   (Forward: child needs parent removed. Reverse: when we un-exit child, parent must be exited still.
//   When parent gets un-exited later, all its children should have already been un-exited.)
// - Lock block: reverse only if grid.exitCount >= unlockAt at the time of the forward move.
//   We track exitCount during scramble; when we un-exit a block, exitCount decrements AFTER
//   the un-exit. So at the moment of "forward-move", exitCount was state.exitCount.
export function enumerateReverseOptions(state: ScrambleState, idMap: Map<string, number>): ReverseOption[] {
  const options: ReverseOption[] = [];
  for (let i = 0; i < state.movables.length; i++) {
    const block = state.movables[i];
    const pos = state.positions[i];
    const isExited = pos === null;

    // Dependent: parent must be exited (i.e. positions[parentIdx] === null).
    if (block.type === 'dependent' && block.dependsOn) {
      const parentIdx = idMap.get(block.dependsOn);
      if (parentIdx === undefined || state.positions[parentIdx] !== null) continue;
    }
    // Lock: at forward time, exitCount must have been >= unlockAt.
    if (block.type === 'lock' && (block.unlockAt ?? 0) > state.exitCount) continue;

    // For constrained blocks, allowed forward directions are only block.direction.
    const allowedDirs: Direction[] = block.type === 'constrained' && block.direction
      ? [block.direction]
      : DIRS;

    if (isExited) {
      // Un-exit: block came in from an exit, slid direction D, exited matching side.
      // Source cell = some cell along -D from the exit cell, up to first blocker.
      for (const dir of allowedDirs) {
        const exitSide = DIR_TO_SIDE[dir];
        for (const exit of state.exits) {
          if (exit.side !== exitSide) continue;
          // Forward-direction block would have slid: must end at exitCell going outward.
          const [ecCol, ecRow] = exitCell(exit, state.cols, state.rows);
          // Block at exitCell would need to be able to forward-slide direction D and exit.
          // For reverse, block ends up at some cell P_src such that forward(P_src, D) reaches exitCell then exits.
          // P_src = any cell along -D from exitCell, up to next blocker (obstacle/other block).
          // Walk backward (-D) from exitCell.
          const [dx, dy] = DELTA[dir];
          let c = ecCol;
          let r = ecRow;
          // exitCell itself is a valid P_src (block came in, immediately exits with 1-move slide of distance 0/1).
          // But typically we want block to land deeper. Enumerate all valid P_src cells.
          while (true) {
            if (c < 0 || c >= state.cols || r < 0 || r >= state.rows) break;
            if (isOccupied(state, c, r, i)) break;
            options.push({ blockIdx: i, dir, srcCol: c, srcRow: r, fromExit: true });
            const pc = c - dx;
            const pr = r - dy;
            if (pc < 0 || pc >= state.cols || pr < 0 || pr >= state.rows) break;
            c = pc; r = pr;
          }
        }
      }
    } else {
      // In-grid reverse: block currently at pos, came from P_src along direction D.
      // P_src is found by walking -D from current pos until first blocker.
      // Block then slid +D from P_src and stopped at current pos because next cell is blocked.
      const [pcol, prow] = pos;
      for (const dir of allowedDirs) {
        const [dx, dy] = DELTA[dir];
        // Forward stop requires next cell after pos in direction D to be blocked.
        const nc = pcol + dx;
        const nr = prow + dy;
        const outOfGrid = nc < 0 || nc >= state.cols || nr < 0 || nr >= state.rows;
        let forwardStopValid = false;
        if (outOfGrid) {
          // Block would exit. To stop here forward, exit must NOT exist at this side+index.
          const side = DIR_TO_SIDE[dir];
          const idx = side === 'LEFT' || side === 'RIGHT' ? prow : pcol;
          forwardStopValid = !state.exits.some((e) => e.side === side && e.index === idx);
        } else {
          // Block stops because next cell is blocked.
          forwardStopValid = isOccupied(state, nc, nr, i);
        }
        if (!forwardStopValid) continue;

        // Walk -D from pos to enumerate possible P_src cells.
        let c = pcol - dx;
        let r = prow - dy;
        while (c >= 0 && c < state.cols && r >= 0 && r < state.rows) {
          if (isOccupied(state, c, r, i)) break;
          options.push({ blockIdx: i, dir, srcCol: c, srcRow: r, fromExit: false, destCol: pcol, destRow: prow });
          c -= dx;
          r -= dy;
        }
      }
    }
  }
  return options;
}

export function applyReverseMove(state: ScrambleState, opt: ReverseOption): void {
  state.positions[opt.blockIdx] = [opt.srcCol, opt.srcRow];
  if (opt.fromExit) {
    state.exitCount = Math.max(0, state.exitCount - 1);
  }
}

// ============================================================
// Scramble loop
// ============================================================
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

export interface ScrambleConfig {
  steps: number;                 // target par (number of reverse moves)
  maxNodes?: number;             // DFS budget (default steps * 200)
  topK?: number;                 // explore top-K biased options per node (default 4)
  verifyPerStep?: boolean;       // forward-verify after each reverse; backtrack if par mismatch (default true)
  verifyBudget?: number;         // forward solver budget per step (default 20000 nodes)
  verifyTolerance?: number;      // accept par_new >= history.length - tolerance (default 1)
}

function cloneState(s: ScrambleState): ScrambleState {
  return {
    cols: s.cols, rows: s.rows, movables: s.movables,
    positions: s.positions.slice(),
    obstacleSet: s.obstacleSet, iceSet: s.iceSet,
    exits: s.exits, exitCount: s.exitCount,
  };
}

// Distance-from-nearest-exit heuristic. Higher = block lands further from exit (more puzzle depth).
function scoreOption(state: ScrambleState, opt: ReverseOption): number {
  let minDist = Infinity;
  for (const e of state.exits) {
    const tc = e.side === 'LEFT' ? 0 : e.side === 'RIGHT' ? state.cols - 1 : e.index;
    const tr = e.side === 'TOP' ? 0 : e.side === 'BOTTOM' ? state.rows - 1 : e.index;
    const d = Math.abs(opt.srcCol - tc) + Math.abs(opt.srcRow - tr);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// Filter + order reverse options per heuristics. Returns ordered array (best first).
function shapeOptions(
  all: ReverseOption[],
  state: ScrambleState,
  idMap: Map<string, number>,
  history: ReverseOption[],
): ReverseOption[] {
  const anyExited = state.positions.some((p) => p === null);
  let pool: ReverseOption[];
  if (anyExited) {
    const unExits = all.filter((o) => o.fromExit);
    // children-first dep ordering: prefer dependents whose parent still exited,
    // AND prefer DEEPEST child (longest dep chain) first.
    // Compute dep-depth for each block (chain length from this block to root).
    const depth = new Map<number, number>();
    function getDepth(idx: number): number {
      if (depth.has(idx)) return depth.get(idx)!;
      const b = state.movables[idx];
      if (b.type !== 'dependent' || !b.dependsOn) { depth.set(idx, 0); return 0; }
      const parentIdx = idMap.get(b.dependsOn);
      if (parentIdx === undefined) { depth.set(idx, 0); return 0; }
      const d = 1 + getDepth(parentIdx);
      depth.set(idx, d);
      return d;
    }
    const childrenFirst = unExits
      .filter((o) => {
        const b = state.movables[o.blockIdx];
        if (b.type !== 'dependent' || !b.dependsOn) return false;
        const parentIdx = idMap.get(b.dependsOn);
        return parentIdx !== undefined && state.positions[parentIdx] === null;
      })
      .sort((a, b) => getDepth(b.blockIdx) - getDepth(a.blockIdx));
    pool = childrenFirst.length > 0 ? childrenFirst : unExits;
  } else {
    pool = all.filter((o) => !o.fromExit);
  }
  if (pool.length === 0) pool = all;

  // Anti-streak + anti-inverse
  const last = history[history.length - 1];
  const last2 = history.slice(-2);
  const last2Ids = new Set(last2.map((o) => o.blockIdx));
  pool = pool.filter((o) => {
    if (last2.length === 2 && last2Ids.size === 1 && last2Ids.has(o.blockIdx)) return false;
    if (last && !last.fromExit && !o.fromExit && o.blockIdx === last.blockIdx
      && o.dir === OPPOSITE[last.dir]) return false;
    return true;
  });
  if (pool.length === 0) pool = all;

  // Bias: sort by distance-from-exit DESC (further is better for puzzle depth).
  pool.sort((a, b) => scoreOption(state, b) - scoreOption(state, a));
  return pool;
}

interface DFSNode {
  state: ScrambleState;
  history: ReverseOption[];
  untried: ReverseOption[]; // ordered best-first
}

// DFS with backtracking. Explores top-K options per node biased by distance.
// Falls back to deeper alternatives if dead-ends are hit.
export function scramble(
  initial: ScrambleState,
  idMap: Map<string, number>,
  cfg: ScrambleConfig,
  rand: () => number,
): { state: ScrambleState; steps: number; reverses: ReverseOption[] } | null {
  const target = cfg.steps;
  const maxNodes = cfg.maxNodes ?? target * 200;
  const topK = cfg.topK ?? 4;
  const verifyPerStep = cfg.verifyPerStep ?? true;
  const verifyBudget = cfg.verifyBudget ?? 20000;
  const verifyTolerance = cfg.verifyTolerance ?? 1;

  // Initial node
  const initState = cloneState(initial);
  const initAll = enumerateReverseOptions(initState, idMap);
  if (initAll.length === 0) return null;
  const initOpts = shapeOptions(initAll, initState, idMap, []).slice(0, topK);
  // Slight randomization within topK to vary across seeds
  if (rand() < 0.5 && initOpts.length > 1) {
    const i = Math.floor(rand() * initOpts.length);
    const j = Math.floor(rand() * initOpts.length);
    [initOpts[i], initOpts[j]] = [initOpts[j], initOpts[i]];
  }

  const stack: DFSNode[] = [{ state: initState, history: [], untried: initOpts }];
  let nodesExplored = 0;

  while (stack.length > 0 && nodesExplored < maxNodes) {
    nodesExplored++;
    const top = stack[stack.length - 1];

    if (top.history.length === target) {
      return { state: top.state, steps: top.history.length, reverses: top.history };
    }
    if (top.untried.length === 0) {
      stack.pop();
      continue;
    }

    const opt = top.untried.shift()!;
    const newState = cloneState(top.state);
    applyReverseMove(newState, opt);
    const newHistory = [...top.history, opt];

    // Per-step forward verify: after this reverse, forward par should be at least
    // history.length - tolerance. Skip if reverse created big shortcut.
    // Tolerance scales with depth — early-stage strictness, late-stage slack.
    if (verifyPerStep) {
      const fv = forwardSolve(newState, idMap, verifyBudget, target + 5);
      if (!fv.solvable) continue;
      const scaledTol = verifyTolerance + Math.floor(newHistory.length / 5);
      if (fv.optimal < newHistory.length - scaledTol) continue;
    }

    const allNext = enumerateReverseOptions(newState, idMap);
    let untried: ReverseOption[];
    if (allNext.length === 0 && newHistory.length < target) {
      // dead-end; skip pushing this node so we backtrack from current top
      continue;
    }
    untried = shapeOptions(allNext, newState, idMap, newHistory).slice(0, topK);
    if (rand() < 0.5 && untried.length > 1) {
      const i = Math.floor(rand() * untried.length);
      const j = Math.floor(rand() * untried.length);
      [untried[i], untried[j]] = [untried[j], untried[i]];
    }
    stack.push({ state: newState, history: newHistory, untried });
  }
  return null;
}

// ============================================================
// Forward solver (copy of bake-v2 A* with ice + lock + dependent + constrained)
// Returns optimal par or -1 if not solvable within budget.
// ============================================================
interface SolverCtx {
  cols: number; rows: number;
  movables: BlockSpec[];
  obstacleSet: Set<number>;
  iceSet: Set<number>;
  exits: ExitZone[];
  depByIdx: number[];
}

function buildSolverCtx(state: ScrambleState, idMap: Map<string, number>): SolverCtx {
  const depByIdx: number[] = state.movables.map((b) =>
    b.type === 'dependent' && b.dependsOn ? idMap.get(b.dependsOn) ?? -1 : -1,
  );
  return {
    cols: state.cols, rows: state.rows,
    movables: state.movables,
    obstacleSet: state.obstacleSet,
    iceSet: state.iceSet,
    exits: state.exits,
    depByIdx,
  };
}

function exitAt(ctx: SolverCtx, side: ExitSide, idx: number): boolean {
  return ctx.exits.some((e) => e.side === side && e.index === idx);
}

type Pos = [number, number] | null;

function forwardAttempt(
  ctx: SolverCtx, positions: Pos[], exitCount: number, idx: number, dir: Direction,
): { kind: 'slide' | 'exit'; nextC?: number; nextR?: number } | null {
  const cur = positions[idx];
  if (!cur) return null;
  const b = ctx.movables[idx];
  if (b.type === 'lock' && exitCount < (b.unlockAt ?? 0)) return null;
  if (b.type === 'dependent') {
    const p = ctx.depByIdx[idx];
    if (p >= 0 && positions[p] !== null) return null;
  }
  if (b.type === 'constrained' && b.direction !== dir) return null;

  const [dx, dy] = DELTA[dir];
  let c = cur[0], r = cur[1];
  const sC = c, sR = r;
  while (true) {
    const nc = c + dx, nr = r + dy;
    if (nc < 0 || nc >= ctx.cols || nr < 0 || nr >= ctx.rows) {
      const side = DIR_TO_SIDE[dir];
      const eIdx = side === 'LEFT' || side === 'RIGHT' ? r : c;
      const dist = Math.abs(c - sC) + Math.abs(r - sR);
      if (exitAt(ctx, side, eIdx)) return { kind: 'exit' };
      if (dist === 0) return null;
      if (ctx.iceSet.has(cellKey(c, r, ctx.cols))) return null;
      return { kind: 'slide', nextC: c, nextR: r };
    }
    const obs = ctx.obstacleSet.has(cellKey(nc, nr, ctx.cols));
    let blocked = obs;
    if (!blocked) {
      for (let i = 0; i < positions.length; i++) {
        if (i === idx) continue;
        const p = positions[i];
        if (!p) continue;
        if (p[0] === nc && p[1] === nr) { blocked = true; break; }
      }
    }
    if (blocked) {
      const dist = Math.abs(c - sC) + Math.abs(r - sR);
      if (dist === 0) return null;
      // Ice push: if natural stop is ice, skip past blocker
      if (ctx.iceSet.has(cellKey(c, r, ctx.cols))) {
        const pushed = forwardIcePush(ctx, positions, idx, c, r, nc, nr, dir);
        if (pushed) {
          if (pushed.exit) return { kind: 'exit' };
          return { kind: 'slide', nextC: pushed.col, nextR: pushed.row };
        }
        return null;
      }
      return { kind: 'slide', nextC: c, nextR: r };
    }
    c = nc; r = nr;
  }
}

// Ice push: when slide stops on ice, jump past the blocker. Recurse if landing on another ice.
function forwardIcePush(
  ctx: SolverCtx, positions: Pos[], selfIdx: number,
  curC: number, curR: number, skipC: number, skipR: number, dir: Direction,
): { col: number; row: number; exit: boolean } | null {
  void curC; void curR;
  const [dx, dy] = DELTA[dir];
  const landC = skipC + dx;
  const landR = skipR + dy;
  if (landC < 0 || landC >= ctx.cols || landR < 0 || landR >= ctx.rows) {
    const side = DIR_TO_SIDE[dir];
    const exitIdx = side === 'LEFT' || side === 'RIGHT' ? skipR : skipC;
    if (exitAt(ctx, side, exitIdx)) return { col: skipC, row: skipR, exit: true };
    return null;
  }
  if (ctx.obstacleSet.has(cellKey(landC, landR, ctx.cols))) return null;
  for (let i = 0; i < positions.length; i++) {
    if (i === selfIdx) continue;
    const p = positions[i];
    if (!p) continue;
    if (p[0] === landC && p[1] === landR) return null;
  }
  if (ctx.iceSet.has(cellKey(landC, landR, ctx.cols))) {
    // chain push: try to skip another blocker
    const nextC = landC + dx;
    const nextR = landR + dy;
    if (nextC < 0 || nextC >= ctx.cols || nextR < 0 || nextR >= ctx.rows) {
      const side = DIR_TO_SIDE[dir];
      const exitIdx = side === 'LEFT' || side === 'RIGHT' ? landR : landC;
      if (exitAt(ctx, side, exitIdx)) return { col: landC, row: landR, exit: true };
      return null;
    }
    const nextObs = ctx.obstacleSet.has(cellKey(nextC, nextR, ctx.cols));
    let nextBlocked = nextObs;
    if (!nextBlocked) {
      for (let i = 0; i < positions.length; i++) {
        if (i === selfIdx) continue;
        const p = positions[i];
        if (!p) continue;
        if (p[0] === nextC && p[1] === nextR) { nextBlocked = true; break; }
      }
    }
    if (nextBlocked) return forwardIcePush(ctx, positions, selfIdx, landC, landR, nextC, nextR, dir);
    return { col: landC, row: landR, exit: false };
  }
  return { col: landC, row: landR, exit: false };
}

function stateKey(positions: Pos[], exitCount: number): string {
  let s = '';
  for (const p of positions) s += p ? `${p[0]},${p[1]}|` : 'X|';
  s += `#${exitCount}`;
  return s;
}

function heuristic(ctx: SolverCtx, positions: Pos[]): number {
  let h = 0;
  for (const p of positions) {
    if (!p) continue;
    let min = Infinity;
    for (const e of ctx.exits) {
      const tc = e.side === 'LEFT' ? 0 : e.side === 'RIGHT' ? ctx.cols - 1 : e.index;
      const tr = e.side === 'TOP' ? 0 : e.side === 'BOTTOM' ? ctx.rows - 1 : e.index;
      const d = Math.abs(p[0] - tc) + Math.abs(p[1] - tr);
      if (d < min) min = d;
    }
    h += Math.max(1, Math.ceil(min / 4));
  }
  return h;
}

class MinHeap<T> {
  items: { v: T; p: number }[] = [];
  push(v: T, p: number) {
    this.items.push({ v, p });
    let i = this.items.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (this.items[par].p <= this.items[i].p) break;
      [this.items[par], this.items[i]] = [this.items[i], this.items[par]];
      i = par;
    }
  }
  pop(): T | undefined {
    if (!this.items.length) return undefined;
    const top = this.items[0].v;
    const last = this.items.pop()!;
    if (this.items.length) {
      this.items[0] = last;
      let i = 0;
      const n = this.items.length;
      while (true) {
        const l = i * 2 + 1, r = l + 1;
        let b = i;
        if (l < n && this.items[l].p < this.items[b].p) b = l;
        if (r < n && this.items[r].p < this.items[b].p) b = r;
        if (b === i) break;
        [this.items[b], this.items[i]] = [this.items[i], this.items[b]];
        i = b;
      }
    }
    return top;
  }
  get size() { return this.items.length; }
}

export function forwardSolve(
  state: ScrambleState, idMap: Map<string, number>,
  maxStates = 200000, maxDepth = 80,
): { solvable: boolean; optimal: number; visited: number } {
  const ctx = buildSolverCtx(state, idMap);
  if (ctx.movables.length === 0) return { solvable: true, optimal: 0, visited: 0 };

  const init: Pos[] = state.positions.slice();
  const initE = state.exitCount;
  const initKey = stateKey(init, initE);
  const open = new MinHeap<{ p: Pos[]; e: number; g: number; key: string }>();
  open.push({ p: init, e: initE, g: 0, key: initKey }, heuristic(ctx, init));
  const seen = new Map<string, number>();
  seen.set(initKey, 0);
  let visited = 0;
  while (open.size > 0) {
    if (visited > maxStates) return { solvable: false, optimal: -1, visited };
    const cur = open.pop()!;
    visited++;
    let allOut = true;
    for (const p of cur.p) if (p) { allOut = false; break; }
    if (allOut) return { solvable: true, optimal: cur.g, visited };
    if (cur.g >= maxDepth) continue;
    for (let i = 0; i < cur.p.length; i++) {
      if (!cur.p[i]) continue;
      for (const d of DIRS) {
        const r = forwardAttempt(ctx, cur.p, cur.e, i, d);
        if (!r) continue;
        const next: Pos[] = cur.p.slice();
        let nextE = cur.e;
        if (r.kind === 'exit') {
          next[i] = null;
          nextE++;
        } else {
          next[i] = [r.nextC!, r.nextR!];
        }
        const nk = stateKey(next, nextE);
        const ng = cur.g + 1;
        const prev = seen.get(nk);
        if (prev !== undefined && prev <= ng) continue;
        seen.set(nk, ng);
        open.push({ p: next, e: nextE, g: ng, key: nk }, ng + heuristic(ctx, next));
      }
    }
  }
  return { solvable: false, optimal: -1, visited };
}

// ============================================================
// Phase config (lightweight; user supplies blocks/exits, scramble produces positions)
// ============================================================
export interface PhaseSpec {
  id: number;
  cols: number;
  rows: number;
  exits: ExitZone[];                    // 1 exit for brief compliance
  blocks: BlockSpec[];                  // type + id + direction/dep/unlockAt; positions filled by scramble
  iceCells?: [number, number][];
  obstacles?: [number, number][];        // fixed obstacle positions (decided by designer)
  targetPar: number;
  pack: string;
}

// Build initial ScrambleState from PhaseSpec.
// Initial state: ALL movables exited (positions: null). Obstacles placed. exitCount = movables.length.
export function initialState(spec: PhaseSpec): { state: ScrambleState; idMap: Map<string, number> } {
  const obstacleSet = new Set<number>();
  if (spec.obstacles) {
    for (const [c, r] of spec.obstacles) obstacleSet.add(cellKey(c, r, spec.cols));
  }
  // Movables: non-obstacle blocks (caller passes block specs sans positions).
  const movables = spec.blocks.filter((b) => b.type !== 'obstacle');
  const idMap = new Map<string, number>();
  movables.forEach((b, i) => idMap.set(b.id, i));
  const iceSet = new Set<number>();
  if (spec.iceCells) for (const [c, r] of spec.iceCells) iceSet.add(cellKey(c, r, spec.cols));
  return {
    state: {
      cols: spec.cols,
      rows: spec.rows,
      movables,
      positions: movables.map(() => null), // all "exited" initially
      obstacleSet,
      iceSet,
      exits: spec.exits,
      exitCount: movables.length, // all already exited at scramble start
    },
    idMap,
  };
}

// ============================================================
// bakeOne — produce a single level matching target par via multi-seed retry.
// ============================================================
export interface BakeOneResult {
  spec: PhaseSpec;
  positions: Array<[number, number] | null>; // final scrambled positions of movables
  par: number;          // actual forward par (== targetPar on success)
  solution: { blockId: string; dir: Direction }[]; // optimal forward path
  reverses: ReverseOption[]; // scramble history (debug)
  seedUsed: number;
  attempts: number;
}

export interface BakeOneConfig {
  seedsBudget?: number;   // max seeds to try (default 200)
  tolerance?: number;     // accept par within [target-tol, target+tol] (default 0 = exact)
  solverBudget?: number;  // forward solver maxStates (default 100000)
  solverMaxDepth?: number;// (default targetPar + 20)
  scrambleNodes?: number; // DFS budget per scramble (default targetPar * 200)
  topK?: number;          // (default 6)
  verbose?: boolean;
  verifyPerStepInScramble?: boolean; // pass to scramble cfg (default true)
}

export function bakeOne(spec: PhaseSpec, cfg: BakeOneConfig = {}): BakeOneResult | null {
  const seedsBudget = cfg.seedsBudget ?? 200;
  const tolerance = cfg.tolerance ?? 0;
  const solverBudget = cfg.solverBudget ?? 100000;
  const solverMaxDepth = cfg.solverMaxDepth ?? (spec.targetPar + 20);
  const scrambleNodes = cfg.scrambleNodes ?? spec.targetPar * 500;
  const topK = cfg.topK ?? 10;

  let bestNear: BakeOneResult | null = null;
  let bestDiff = Infinity;
  let scrambleFails = 0;
  let solverFails = 0;
  let succeeded = 0;

  for (let seed = 0; seed < seedsBudget; seed++) {
    const rand = rng(spec.id * 9301 + seed * 49297 + 1);
    const { state, idMap } = initialState(spec);
    const result = scramble(state, idMap, {
      steps: spec.targetPar,
      maxNodes: scrambleNodes,
      topK,
      verifyPerStep: cfg.verifyPerStepInScramble ?? true,
    }, rand);
    if (!result) { scrambleFails++; continue; }

    const verify = forwardSolve(result.state, idMap, solverBudget, solverMaxDepth);
    if (!verify.solvable) { solverFails++; continue; }
    succeeded++;

    const diff = Math.abs(spec.targetPar - verify.optimal);
    if (diff <= tolerance) {
      // success
      return {
        spec,
        positions: result.state.positions.slice(),
        par: verify.optimal,
        solution: extractSolutionPath(result.state, idMap, solverBudget, solverMaxDepth),
        reverses: result.reverses,
        seedUsed: seed,
        attempts: seed + 1,
      };
    }
    if (diff < bestDiff) {
      bestDiff = diff;
      bestNear = {
        spec,
        positions: result.state.positions.slice(),
        par: verify.optimal,
        solution: extractSolutionPath(result.state, idMap, solverBudget, solverMaxDepth),
        reverses: result.reverses,
        seedUsed: seed,
        attempts: seed + 1,
      };
    }
    if (cfg.verbose && seed % 50 === 49) {
      console.log(`  ...phase ${spec.id} seed ${seed}: bestDiff=${bestDiff}`);
    }
  }
  if (cfg.verbose) {
    console.log(`  stats: scrambleFails=${scrambleFails} solverFails=${solverFails} succeeded=${succeeded}`);
  }
  return bestNear;
}

// Extract solution path with parent tracking (A* variant of forwardSolve).
export function extractSolutionPath(
  state: ScrambleState, idMap: Map<string, number>, maxStates: number, maxDepth: number,
): { blockId: string; dir: Direction }[] {
  const ctx = buildSolverCtx(state, idMap);
  if (ctx.movables.length === 0) return [];
  const init: Pos[] = state.positions.slice();
  const initE = state.exitCount;
  const initKey = stateKey(init, initE);
  const open = new MinHeap<{ p: Pos[]; e: number; g: number; key: string }>();
  open.push({ p: init, e: initE, g: 0, key: initKey }, heuristic(ctx, init));
  const seen = new Map<string, number>();
  seen.set(initKey, 0);
  const parents = new Map<string, { parent: string | null; move: { blockId: string; dir: Direction } | null }>();
  parents.set(initKey, { parent: null, move: null });
  let visited = 0;
  while (open.size > 0) {
    if (visited > maxStates) return [];
    const cur = open.pop()!;
    visited++;
    let allOut = true;
    for (const p of cur.p) if (p) { allOut = false; break; }
    if (allOut) {
      const path: { blockId: string; dir: Direction }[] = [];
      let k: string | null = cur.key;
      while (k) {
        const rec = parents.get(k);
        if (!rec || !rec.move) break;
        path.push(rec.move);
        k = rec.parent;
      }
      path.reverse();
      return path;
    }
    if (cur.g >= maxDepth) continue;
    for (let i = 0; i < cur.p.length; i++) {
      if (!cur.p[i]) continue;
      for (const d of DIRS) {
        const r = forwardAttempt(ctx, cur.p, cur.e, i, d);
        if (!r) continue;
        const next: Pos[] = cur.p.slice();
        let nextE = cur.e;
        if (r.kind === 'exit') { next[i] = null; nextE++; }
        else { next[i] = [r.nextC!, r.nextR!]; }
        const nk = stateKey(next, nextE);
        const ng = cur.g + 1;
        const prev = seen.get(nk);
        if (prev !== undefined && prev <= ng) continue;
        seen.set(nk, ng);
        parents.set(nk, { parent: cur.key, move: { blockId: ctx.movables[i].id, dir: d } });
        open.push({ p: next, e: nextE, g: ng, key: nk }, ng + heuristic(ctx, next));
      }
    }
  }
  return [];
}

// ============================================================
// Dryrun: scramble a sample phase, print result, verify forward.
// ============================================================
interface SampleCase {
  label: string;
  phase: PhaseSpec;
}

// ============================================================
// Phase generator — produce PhaseSpec per target par with obstacles arranged
// to allow scramble to reach par target. Obstacles placed in zig-zag pattern
// to force detours during reverse-scramble.
// ============================================================
function generatePhase(id: number, targetPar: number, pack: string, rand: () => number): PhaseSpec {
  // Grid sized to target par
  let cols: number;
  if (targetPar <= 3) cols = 5;
  else if (targetPar <= 6) cols = 6;
  else if (targetPar <= 10) cols = 7;
  else if (targetPar <= 14) cols = 8;
  else if (targetPar <= 18) cols = 9;
  else cols = 10;
  const rows = cols;

  // Block roster scales with par
  const blocks: BlockSpec[] = [];
  let movableCount: number;
  let depCount: number;
  let yellowCount: number;
  let obstacleCount: number;
  if (pack === 'tutorial') {
    movableCount = targetPar <= 2 ? 1 : targetPar <= 4 ? 2 : 3;
    depCount = targetPar >= 5 ? 1 : 0;
    yellowCount = targetPar >= 3 ? 1 : 0;
    obstacleCount = targetPar <= 2 ? 0 : Math.max(1, Math.floor(targetPar / 2));
  } else if (pack === 'hook') {
    movableCount = targetPar <= 8 ? 3 : 4;
    depCount = 1;
    yellowCount = 1;
    obstacleCount = Math.max(2, Math.floor(targetPar / 2));
  } else if (pack === 'gears') {
    movableCount = targetPar <= 12 ? 4 : 5;
    depCount = targetPar <= 13 ? 2 : 3;
    yellowCount = 1;
    obstacleCount = Math.max(3, Math.floor(targetPar / 2));
  } else if (pack === 'stones') {
    movableCount = targetPar <= 17 ? 4 : 5;
    depCount = targetPar <= 16 ? 2 : 2;
    yellowCount = 1;
    obstacleCount = Math.max(4, Math.floor(targetPar / 2));
  } else {
    movableCount = 5;
    depCount = 3;
    yellowCount = 1;
    obstacleCount = Math.max(5, Math.floor(targetPar / 2));
  }

  // Build block specs (positions [0,0], will be set by scramble)
  for (let i = 0; i < movableCount - depCount - yellowCount; i++) {
    blocks.push({ id: `m${i + 1}`, type: 'simple', pos: [0, 0] });
  }
  if (yellowCount > 0) {
    // Constrained block direction must MATCH an exit side so it can exit during forward play.
    // Use exit side dir directly.
    const exitSidesArr: ExitSide[] = ['RIGHT', 'BOTTOM', 'LEFT', 'TOP'];
    const exitSideForBlock = exitSidesArr[id % 4];
    const dir: Direction = exitSideForBlock === 'TOP' ? 'UP'
      : exitSideForBlock === 'BOTTOM' ? 'DOWN'
      : exitSideForBlock === 'LEFT' ? 'LEFT'
      : 'RIGHT';
    for (let i = 0; i < yellowCount; i++) {
      const idIdx = movableCount - depCount - yellowCount + i + 1;
      blocks.push({ id: `m${idIdx}`, type: 'constrained', pos: [0, 0], direction: dir });
    }
  }
  for (let i = 0; i < depCount; i++) {
    const idIdx = movableCount - depCount + i + 1;
    const parentId = i === 0 ? 'm1' : `m${idIdx - 1}`; // linear chain depth
    blocks.push({ id: `m${idIdx}`, type: 'dependent', pos: [0, 0], dependsOn: parentId });
  }

  // Exits: single exit on side, index near center
  const sides: ExitSide[] = ['RIGHT', 'BOTTOM', 'LEFT', 'TOP'];
  const exitSide = sides[id % 4];
  const isHoriz = exitSide === 'LEFT' || exitSide === 'RIGHT';
  const exitIdx = Math.floor((isHoriz ? rows : cols) / 2);
  const exits: ExitZone[] = [{ side: exitSide, index: exitIdx }];

  // Obstacles: place in zig-zag, avoid exit cell
  const obstacles: [number, number][] = [];
  const obstacleSet = new Set<number>();
  const exitCellKey = (() => {
    const [c, r] = exitCell({ side: exitSide, index: exitIdx }, cols, rows);
    return r * cols + c;
  })();
  let placed = 0;
  let attempts = 0;
  while (placed < obstacleCount && attempts < 200) {
    attempts++;
    const c = Math.floor(rand() * cols);
    const r = Math.floor(rand() * rows);
    const k = r * cols + c;
    if (k === exitCellKey) continue;
    if (obstacleSet.has(k)) continue;
    obstacleSet.add(k);
    obstacles.push([c, r]);
    blocks.push({ id: `o${placed + 1}`, type: 'obstacle', pos: [c, r] });
    placed++;
  }

  return { id, cols, rows, exits, blocks, obstacles, targetPar, pack };
}

const SAMPLES: SampleCase[] = [
  { label: 'tutorial-1 (par=2)', phase: generatePhase(1, 2, 'tutorial', rng(101)) },
  { label: 'tutorial-5 (par=4)', phase: generatePhase(5, 4, 'tutorial', rng(105)) },
  { label: 'hook-9 (par=7)', phase: generatePhase(9, 7, 'hook', rng(109)) },
  { label: 'gears-24 (par=10)', phase: generatePhase(24, 10, 'gears', rng(124)) },
  { label: 'stones-48 (par=17)', phase: generatePhase(48, 17, 'stones', rng(148)) },
  { label: 'master-78 (par=28)', phase: generatePhase(78, 28, 'master', rng(178)) },
];

function dryrunSample(idx?: number): void {
  const cases = idx !== undefined && idx >= 0 && idx < SAMPLES.length ? [SAMPLES[idx]] : SAMPLES;
  for (const { label, phase } of cases) {
    console.log(`\n=== ${label} ===`);
    console.log(`grid: ${phase.cols}x${phase.rows}, target par=${phase.targetPar}, movables=${phase.blocks.filter(b => b.type !== 'obstacle').length}, obstacles=${(phase.obstacles ?? []).length}`);

    const t0 = Date.now();
    const result = bakeOne(phase, { seedsBudget: 200, tolerance: 2, verbose: true, verifyPerStepInScramble: false } as BakeOneConfig & { verifyPerStepInScramble: boolean });
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    if (!result) {
      console.log(`fail: no scramble produced solvable layout (${dt}s)`);
      continue;
    }
    const placements = phase.blocks.filter(b => b.type !== 'obstacle').map((b, i) => {
      const p = result.positions[i];
      return `${b.id}=${p ? `(${p[0]},${p[1]})` : 'exited'}`;
    }).join(' ');
    const hit = result.par === phase.targetPar;
    console.log(`${hit ? '✓ HIT' : '~ near'}: par=${result.par}/${phase.targetPar} (diff=${phase.targetPar - result.par}, seed=${result.seedUsed}, attempts=${result.attempts}, ${dt}s)`);
    console.log(`  placements: ${placements}`);
    console.log(`  solution length: ${result.solution.length}`);
  }
}

// ============================================================
// CLI + JSON store integration (mirrors bake-v2)
// ============================================================

// Brief par targets per level. Keep in sync with scripts/bake-v2.ts PAR_TARGETS.
const PAR_TARGETS: number[] = [
  // Tutorial L1-8
  2, 3, 3, 4, 4, 5, 5, 6,
  // Hook L9-23
  7, 6, 8, 9, 7, 10, 8, 9, 11, 8, 10, 12, 9, 10, 12,
  // Gears L24-43
  10, 11, 12, 10, 13, 14, 11, 14, 12, 13, 15, 12, 14, 16, 13, 15, 17, 14, 16, 18,
  // Stones L44-63
  14, 15, 16, 14, 17, 16, 18, 15, 17, 19, 16, 18, 20, 17, 19, 20, 18, 21, 19, 22,
  // Master L64-72
  18, 19, 20, 18, 21, 20, 22, 19, 23,
];
const TOTAL_BAKED = 72;
const PACK_RANGES: Record<string, [number, number]> = {
  tutorial: [1, 8],
  hook: [9, 23],
  gears: [24, 43],
  stones: [44, 63],
  master: [64, 72],
};
function packOfId(id: number): string {
  if (id <= 8) return 'tutorial';
  if (id <= 23) return 'hook';
  if (id <= 43) return 'gears';
  if (id <= 63) return 'stones';
  if (id <= 78) return 'master';
  return 'fixture';
}

// Stored level format (compatible with bake-v2 store)
interface StoredLevel {
  id: number;
  cols: number;
  rows: number;
  blocks: BlockSpec[];
  exits: { side: ExitSide; index: number }[];
  parMoves: number;
  pack: string;
  solution: { blockId: string; dir: Direction }[];
}

const STORE_PATH_REL = 'scripts/output/baked.json';

function loadStore(repoRoot: string): Map<number, StoredLevel> {
  const store = new Map<number, StoredLevel>();
  const full = resolve(repoRoot, STORE_PATH_REL);
  if (!existsSync(full)) return store;
  try {
    const raw = JSON.parse(readFileSync(full, 'utf8'));
    if (raw && raw.levels && typeof raw.levels === 'object') {
      for (const [k, v] of Object.entries(raw.levels)) {
        store.set(parseInt(k, 10), v as StoredLevel);
      }
    }
  } catch (e) {
    console.warn(`[store] failed to read ${STORE_PATH_REL}:`, (e as Error).message);
  }
  return store;
}

function saveStore(repoRoot: string, store: Map<number, StoredLevel>): void {
  const full = resolve(repoRoot, STORE_PATH_REL);
  mkdirSync(dirname(full), { recursive: true });
  const sortedIds = [...store.keys()].sort((a, b) => a - b);
  const obj: { version: number; updated: string; levels: Record<string, StoredLevel> } = {
    version: 1, updated: new Date().toISOString(), levels: {},
  };
  for (const id of sortedIds) obj.levels[String(id)] = store.get(id)!;
  writeFileSync(full, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function parseBakeArgs(): { ids: number[]; description: string } {
  const args = process.argv.slice(3); // skip [node, script, "bake"]
  const ids = new Set<number>();
  const labels: string[] = [];
  for (const arg of args) {
    if (arg.startsWith('--pack=')) {
      const p = arg.slice(7);
      const range = PACK_RANGES[p];
      if (!range) { console.error(`unknown pack '${p}'`); process.exit(1); }
      for (let i = range[0]; i <= range[1]; i++) ids.add(i);
      labels.push(`pack=${p}`);
    } else if (arg.startsWith('--ids=')) {
      const expr = arg.slice(6);
      for (const part of expr.split(',')) {
        const m = part.match(/^(\d+)(?:-(\d+))?$/);
        if (!m) { console.error(`bad ids '${part}'`); process.exit(1); }
        const lo = parseInt(m[1], 10);
        const hi = m[2] ? parseInt(m[2], 10) : lo;
        for (let i = lo; i <= hi; i++) ids.add(i);
      }
      labels.push(`ids=${expr}`);
    }
  }
  for (const id of ids) {
    if (id < 1 || id > TOTAL_BAKED) {
      console.error(`id ${id} out of bake range (1..${TOTAL_BAKED})`);
      process.exit(1);
    }
  }
  if (ids.size === 0) {
    for (let i = 1; i <= TOTAL_BAKED; i++) ids.add(i);
    labels.push(`all(1..${TOTAL_BAKED})`);
  }
  return { ids: [...ids].sort((a, b) => a - b), description: labels.join(' + ') };
}

// Emit Levels.ts from full store (mirror of bake-v2 emit). Inline fixtures L73-80.
function emitLevelsTs(entries: StoredLevel[]): string {
  const header = `import { LevelData, BlockData, Color, ExitZone, Direction } from '../types/Game';

const S = (id: string, c: number, r: number): BlockData => ({
  id, color: 'red', position: [c, r], size: [1, 1], type: 'simple',
});
const O = (id: string, c: number, r: number): BlockData => ({
  id, color: 'red', position: [c, r], size: [1, 1], type: 'obstacle',
});
const C = (id: string, c: number, r: number, dir: Direction): BlockData => ({
  id, color: 'yellow', position: [c, r], size: [1, 1], type: 'constrained', direction: dir,
});
const D = (id: string, c: number, r: number, dep: string): BlockData => ({
  id, color: 'blue', position: [c, r], size: [1, 1], type: 'dependent', dependsOn: dep,
});
const SC = (id: string, c: number, r: number, color: Color): BlockData => ({
  id, color, position: [c, r], size: [1, 1], type: 'simple',
});
const K = (id: string, c: number, r: number, unlockAt: number, color: Color = 'purple'): BlockData => ({
  id, color, position: [c, r], size: [1, 1], type: 'lock', unlockAt,
});
const E = (
  side: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT',
  index: number,
): ExitZone => ({ side, index });
const L = (
  id: number, cols: number, rows: number, blocks: BlockData[], exits: ExitZone[],
  parMoves: number, pack?: string, iceCells?: [number, number][],
): LevelData => ({ id, cols, rows, blocks, exits, parMoves, pack, iceCells });

// AUTO-BAKED via scripts/bake-constructive.ts (Opsi 2 reverse-scramble).
// parMoves = optimal solver solution length (used for 3-star thresholds).

export const LEVELS: LevelData[] = [
`;

  const body = entries.map((e) => {
    const blocksStr = e.blocks.map((b) => {
      if (b.type === 'simple') return `S('${b.id}',${b.pos[0]},${b.pos[1]})`;
      if (b.type === 'obstacle') return `O('${b.id}',${b.pos[0]},${b.pos[1]})`;
      if (b.type === 'constrained') return `C('${b.id}',${b.pos[0]},${b.pos[1]},'${b.direction}')`;
      return `D('${b.id}',${b.pos[0]},${b.pos[1]},'${b.dependsOn}')`;
    }).join(', ');
    const exitsStr = e.exits.map((x) => `E('${x.side}',${x.index})`).join(', ');
    return `  L(${e.id}, ${e.cols}, ${e.rows}, [${blocksStr}], [${exitsStr}], ${e.parMoves}, '${e.pack}'),`;
  }).join('\n');

  // Fixtures L73-80 inline (hand-authored, not regen-able via bake-constructive)
  const fixtures = `
  // === MASTER PACK FIXTURES (L73-78): ice push + lock counter intros ===
  L(73, 5, 3, [SC('m1',0,1,'red'), O('o1',2,1)], [E('RIGHT',1)], 2, 'master', [[1,1]]),
  L(74, 7, 3, [SC('m1',0,1,'red'), O('o1',2,1), O('o2',4,1)], [E('RIGHT',1)], 2, 'master', [[1,1],[3,1]]),
  L(75, 6, 4, [SC('m1',0,1,'red'), SC('m2',0,2,'blue'), O('o1',3,1), O('o2',3,2)], [E('RIGHT',1), E('RIGHT',2)], 4, 'master', [[2,1],[2,2]]),
  L(76, 6, 2, [SC('m1',0,0,'red'), K('k1',0,1,1)], [E('RIGHT',0), E('RIGHT',1)], 2, 'master'),
  L(77, 7, 3, [SC('m1',0,0,'red'), SC('m2',0,1,'blue'), K('k1',0,2,2)], [E('RIGHT',0), E('RIGHT',1), E('RIGHT',2)], 3, 'master'),
  L(78, 8, 3, [SC('m1',0,0,'red'), K('k1',0,1,1), K('k2',0,2,2)], [E('RIGHT',0), E('RIGHT',1), E('RIGHT',2)], 3, 'master'),
  // === FIXTURE PACK (L79-80): legendary finale ===
  L(79, 8, 5, [SC('m1',0,2,'red'), O('o1',3,2), O('o2',5,1), O('o3',5,3), SC('m2',0,4,'blue'), D('m3',0,0,'m1')], [E('RIGHT',2), E('RIGHT',4), E('TOP',0)], 7, 'fixture', [[2,2],[4,2]]),
  L(80, 9, 5, [SC('m1',0,1,'red'), SC('m2',0,3,'blue'), O('o1',3,1), O('o2',3,3), K('k1',0,0,2), K('k2',0,4,2)], [E('RIGHT',1), E('RIGHT',3), E('RIGHT',0), E('RIGHT',4)], 8, 'fixture', [[2,1],[2,3]]),`;

  const bakedSolutions = entries.map((e) => {
    const moves = e.solution.map((m) => `{blockId:'${m.blockId}',dir:'${m.dir}'}`).join(', ');
    return `  ${e.id}: [${moves}],`;
  }).join('\n');

  const fixtureSolutions = `  73: [{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'RIGHT'}],
  74: [{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'RIGHT'}],
  75: [{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'RIGHT'},{blockId:'m2',dir:'RIGHT'},{blockId:'m2',dir:'RIGHT'}],
  76: [{blockId:'m1',dir:'RIGHT'},{blockId:'k1',dir:'RIGHT'}],
  77: [{blockId:'m1',dir:'RIGHT'},{blockId:'m2',dir:'RIGHT'},{blockId:'k1',dir:'RIGHT'}],
  78: [{blockId:'m1',dir:'RIGHT'},{blockId:'k1',dir:'RIGHT'},{blockId:'k2',dir:'RIGHT'}],
  79: [],
  80: [],`;

  const solutionsBody = bakedSolutions + '\n' + fixtureSolutions;

  const footer = `
];

export type SolutionMove = { blockId: string; dir: Direction };

export const SOLUTIONS: Record<number, SolutionMove[]> = {
${solutionsBody}
};

export function getSolution(id: number): SolutionMove[] {
  return SOLUTIONS[id] ?? [];
}

export function getLevel(id: number): LevelData {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, id - 1))];
}

export const MAX_LEVEL_COLS = LEVELS.reduce((m, l) => Math.max(m, l.cols), 0);
export const MAX_LEVEL_ROWS = LEVELS.reduce((m, l) => Math.max(m, l.rows), 0);

export interface WorldPack {
  id: string;
  name: string;
  theme: string;
  levelIds: number[];
  unlockAfter: number;
}

export const PACKS: WorldPack[] = [
  { id: 'tutorial', name: 'Tutorial', theme: 'intro',     levelIds: LEVELS.filter(l => l.pack === 'tutorial').map(l => l.id), unlockAfter: 0 },
  { id: 'hook',     name: 'Hook',     theme: 'wow',       levelIds: LEVELS.filter(l => l.pack === 'hook').map(l => l.id),     unlockAfter: 6 },
  { id: 'gears',    name: 'Gears',    theme: 'dependent', levelIds: LEVELS.filter(l => l.pack === 'gears').map(l => l.id),    unlockAfter: 20 },
  { id: 'stones',   name: 'Stones',   theme: 'obstacle',  levelIds: LEVELS.filter(l => l.pack === 'stones').map(l => l.id),   unlockAfter: 40 },
  { id: 'master',   name: 'Master',   theme: 'mixed',     levelIds: LEVELS.filter(l => l.pack === 'master').map(l => l.id),   unlockAfter: 60 },
  { id: 'fixture',  name: 'Finale',   theme: 'boss',      levelIds: LEVELS.filter(l => l.pack === 'fixture').map(l => l.id),  unlockAfter: 75 },
];

export const FIXTURE_IDS = LEVELS.filter((l) => l.id >= 73).map((l) => l.id);

export function getPackOf(levelId: number): WorldPack | undefined {
  return PACKS.find((p) => p.levelIds.includes(levelId));
}

export function starsFor(parMoves: number, moves: number): 1 | 2 | 3 {
  if (moves <= parMoves) return 3;
  if (moves <= Math.ceil(parMoves * 1.4)) return 2;
  return 1;
}
`;
  return header + body + '\n' + fixtures + footer;
}

// Main bake command (mirror of bake-v2): parse args, seed from existing Levels.ts if needed,
// bake target IDs via constructive scramble, save store, emit Levels.ts.
function runBake(repoRoot: string): void {
  const { ids: targetIds, description } = parseBakeArgs();
  console.log(`[constructive] Bake target: ${description} (${targetIds.length} levels)`);

  const store = loadStore(repoRoot);
  console.log(`[constructive] Store: loaded ${store.size} existing entries`);

  // Bootstrap from existing Levels.ts on first run
  let seeded = 0;
  for (const lvl of EXISTING_LEVELS) {
    if (lvl.id > TOTAL_BAKED) continue;
    if (store.has(lvl.id)) continue;
    const blocks: BlockSpec[] = lvl.blocks.map((b) => ({
      id: b.id,
      type: (b.type ?? 'simple') as BlockType,
      pos: b.position as [number, number],
      direction: b.direction,
      dependsOn: b.dependsOn,
    }));
    store.set(lvl.id, {
      id: lvl.id, cols: lvl.cols, rows: lvl.rows,
      blocks,
      exits: lvl.exits.map((e) => ({ side: e.side as ExitSide, index: e.index })),
      parMoves: lvl.parMoves,
      pack: lvl.pack ?? packOfId(lvl.id),
      solution: (EXISTING_SOLUTIONS[lvl.id] ?? []).map((m) => ({ blockId: m.blockId, dir: m.dir as Direction })),
    });
    seeded++;
  }
  if (seeded > 0) console.log(`[constructive] Store: seeded ${seeded} entries from Levels.ts`);

  // Bake target IDs via constructive
  const t0 = Date.now();
  for (const id of targetIds) {
    const par = PAR_TARGETS[id - 1];
    const pack = packOfId(id);
    const phaseRand = rng(id * 9301);
    const spec = generatePhase(id, par, pack, phaseRand);
    const result = bakeOne(spec, { seedsBudget: 300, tolerance: 2, verbose: false });
    if (!result) {
      console.error(`L${id}: bake FAILED (no scramble produced solvable layout)`);
      console.error('       keeping existing store entry if any');
      continue;
    }
    // Reject if any movable still exited (orphan dep refs would result)
    const anyExited = result.positions.some((p) => p === null);
    if (anyExited) {
      console.error(`L${id}: bake REJECTED (some movables stayed exited — dep chain broke)`);
      console.error('       keeping existing store entry if any');
      continue;
    }
    // Convert positions back to placed BlockSpec[]
    const placedBlocks: BlockSpec[] = [];
    for (let i = 0; i < spec.blocks.length; i++) {
      const b = spec.blocks[i];
      if (b.type === 'obstacle') {
        placedBlocks.push(b);
        continue;
      }
      const movableIdx = spec.blocks.filter((x) => x.type !== 'obstacle').findIndex((x) => x.id === b.id);
      const p = result.positions[movableIdx];
      if (!p) continue; // safety (should be unreachable after anyExited check)
      placedBlocks.push({ ...b, pos: [p[0], p[1]] });
    }
    const stored: StoredLevel = {
      id, cols: spec.cols, rows: spec.rows,
      blocks: placedBlocks,
      exits: spec.exits,
      parMoves: result.par,
      pack,
      solution: result.solution,
    };
    store.set(id, stored);
    const diff = par - result.par;
    const mark = diff === 0 ? '✓' : diff > 0 ? '~' : '!';
    console.log(`L${String(id).padStart(2)} (${spec.cols}x${spec.rows}, ${placedBlocks.length}b): par=${result.par}/${par} ${mark} (seed ${result.seedUsed}, ${result.attempts} attempts)`);
  }
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[constructive] Baked in ${dt}s`);

  saveStore(repoRoot, store);
  console.log(`[constructive] Store saved → ${STORE_PATH_REL}`);

  // Verify completeness for emit
  const missing: number[] = [];
  for (let i = 1; i <= TOTAL_BAKED; i++) if (!store.has(i)) missing.push(i);
  if (missing.length > 0) {
    console.error(`Cannot emit Levels.ts — store missing IDs: ${missing.join(', ')}`);
    process.exit(1);
  }

  const sortedEntries = [...store.values()].sort((a, b) => a.id - b.id);
  const out = emitLevelsTs(sortedEntries);
  const outPath = resolve(repoRoot, 'src', 'config', 'Levels.ts');
  writeFileSync(outPath, out, 'utf8');
  console.log(`[constructive] Wrote ${outPath}`);
}

// ============================================================
// CLI entry — guarded so module can be imported without auto-running.
// ============================================================
const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] === __filename;
if (isMain) {
  const cmd = process.argv[2];
  if (cmd === 'test') {
    const id = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;
    dryrunSample(id);
  } else if (cmd === 'bake') {
    const repoRoot = resolve(dirname(__filename), '..');
    runBake(repoRoot);
  } else if (cmd === 'solve') {
    const id = process.argv[3] ? parseInt(process.argv[3], 10) : 0;
    if (!id) { console.error('Usage: solve <levelId>'); process.exit(1); }
    const lvl = EXISTING_LEVELS.find((l) => l.id === id);
    if (!lvl) { console.error(`Level ${id} not found`); process.exit(1); }
    const blocks: BlockSpec[] = lvl.blocks.map((b) => ({
      id: b.id,
      type: (b.type ?? 'simple') as BlockType,
      pos: b.position as [number, number],
      direction: b.direction,
      dependsOn: b.dependsOn,
      unlockAt: b.unlockAt,
    }));
    const spec: PhaseSpec = {
      id: lvl.id, cols: lvl.cols, rows: lvl.rows,
      exits: lvl.exits.map((e) => ({ side: e.side as ExitSide, index: e.index })),
      blocks,
      obstacles: blocks.filter((b) => b.type === 'obstacle').map((b) => b.pos),
      iceCells: lvl.iceCells,
      targetPar: lvl.parMoves,
      pack: lvl.pack ?? 'fixture',
    };
    const { state, idMap } = initialState(spec);
    // Place movables at their actual positions (override "all exited" init)
    const movables = blocks.filter((b) => b.type !== 'obstacle');
    state.positions = movables.map((b) => [b.pos[0], b.pos[1]]);
    state.exitCount = 0;
    const t0 = Date.now();
    const r = forwardSolve(state, idMap, 1_000_000, 200);
    const dt = ((Date.now() - t0) / 1000).toFixed(2);
    if (!r.solvable) {
      console.error(`L${id}: unsolvable (visited ${r.visited} states, ${dt}s)`);
      process.exit(1);
    }
    const path = extractSolutionPath(state, idMap, 1_000_000, 200);
    console.log(`L${id}: optimal=${r.optimal} visited=${r.visited} (${dt}s)`);
    const pathStr = path.map((m) => `{blockId:'${m.blockId}',dir:'${m.dir}'}`).join(',');
    console.log(`  ${id}: [${pathStr}],`);
  } else {
    console.log('Usage:');
    console.log('  npx tsx scripts/bake-constructive.ts test [phaseIdx]               # dryrun samples');
    console.log('  npx tsx scripts/bake-constructive.ts bake                          # bake all 72');
    console.log('  npx tsx scripts/bake-constructive.ts bake --pack=stones            # only stones');
    console.log('  npx tsx scripts/bake-constructive.ts bake --ids=44-50              # range');
    console.log('  npx tsx scripts/bake-constructive.ts bake --ids=44,52,58           # specific');
    console.log('  npx tsx scripts/bake-constructive.ts solve <levelId>               # solve fixture level + print path');
  }
}
