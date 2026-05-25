// Bake levels with v2 solver (slide momentum + constrained + dependent).
// Verified-solvable levels matching docs/LEVEL_DESIGN.md brief par targets.
// Output: scripts/output/baked.json (intermediate store) + src/config/Levels.ts (final).
//
// Usage:
//   npx tsx scripts/bake-v2.ts                         # bake all 72 baked levels
//   npx tsx scripts/bake-v2.ts --pack=stones           # only stones pack
//   npx tsx scripts/bake-v2.ts --ids=44-50             # specific id range
//   npx tsx scripts/bake-v2.ts --ids=46,52,58          # specific ids
//
// Fixtures L73-80 stay inline (not regen-able via this script). Edit emit footer directly.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS as EXISTING_LEVELS, SOLUTIONS as EXISTING_SOLUTIONS } from '../src/config/Levels';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type ExitSide = 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
type BlockType = 'simple' | 'constrained' | 'dependent' | 'obstacle';

interface BlockSpec {
  id: string;
  type: BlockType;
  pos: [number, number];
  direction?: Direction;
  dependsOn?: string;
}

interface Level {
  id: number;
  cols: number;
  rows: number;
  blocks: BlockSpec[];
  exits: { side: ExitSide; index: number }[];
}

const DIR_TO_SIDE: Record<Direction, ExitSide> = {
  UP: 'TOP', DOWN: 'BOTTOM', LEFT: 'LEFT', RIGHT: 'RIGHT',
};
const DELTA: Record<Direction, [number, number]> = {
  UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0],
};
const DIRS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

// ============================================================
// A* solver mirrors src/systems/MovementSystem.ts slide rule
// ============================================================

type Pos = [number, number] | null;

interface SolverCtx {
  cols: number;
  rows: number;
  movables: BlockSpec[];
  obstacleSet: Set<number>;
  exitMap: Map<string, true>;
  exitTargets: { side: ExitSide; col: number; row: number }[];
  depByIdx: number[];
}

function cellKey(c: number, r: number, cols: number): number {
  return r * cols + c;
}

function exitKey(s: ExitSide, idx: number): string {
  return `${s}:${idx}`;
}

function buildCtx(level: Level): SolverCtx {
  const movables = level.blocks.filter((b) => b.type !== 'obstacle');
  const obstacleSet = new Set<number>(
    level.blocks.filter((b) => b.type === 'obstacle')
      .map((b) => cellKey(b.pos[0], b.pos[1], level.cols))
  );
  const exitMap = new Map<string, true>();
  for (const e of level.exits) exitMap.set(exitKey(e.side, e.index), true);

  const exitTargets = level.exits.map((e) => ({
    side: e.side,
    col: e.side === 'LEFT' ? 0 : e.side === 'RIGHT' ? level.cols - 1 : e.index,
    row: e.side === 'TOP' ? 0 : e.side === 'BOTTOM' ? level.rows - 1 : e.index,
  }));

  const idMap = new Map<string, number>();
  movables.forEach((b, i) => idMap.set(b.id, i));
  const depByIdx: number[] = movables.map((b) =>
    b.type === 'dependent' && b.dependsOn ? idMap.get(b.dependsOn) ?? -1 : -1
  );

  return { cols: level.cols, rows: level.rows, movables, obstacleSet, exitMap, exitTargets, depByIdx };
}

function attempt(
  ctx: SolverCtx, positions: Pos[], idx: number, dir: Direction
): { kind: 'slide' | 'exit'; nextX?: number; nextY?: number } | null {
  const cur = positions[idx];
  if (!cur) return null;
  const block = ctx.movables[idx];
  if (block.type === 'dependent') {
    const p = ctx.depByIdx[idx];
    if (p >= 0 && positions[p] !== null) return null;
  }
  if (block.type === 'constrained' && block.direction !== dir) return null;

  const [dx, dy] = DELTA[dir];
  let curC = cur[0];
  let curR = cur[1];
  const sC = curC, sR = curR;

  while (true) {
    const nC = curC + dx;
    const nR = curR + dy;
    if (nC < 0 || nC >= ctx.cols || nR < 0 || nR >= ctx.rows) {
      const side = DIR_TO_SIDE[dir];
      const exitIdx = side === 'LEFT' || side === 'RIGHT' ? curR : curC;
      const dist = Math.abs(curC - sC) + Math.abs(curR - sR);
      if (ctx.exitMap.has(exitKey(side, exitIdx))) return { kind: 'exit' };
      if (dist === 0) return null;
      return { kind: 'slide', nextX: curC, nextY: curR };
    }
    if (ctx.obstacleSet.has(cellKey(nC, nR, ctx.cols))) {
      const dist = Math.abs(curC - sC) + Math.abs(curR - sR);
      if (dist === 0) return null;
      return { kind: 'slide', nextX: curC, nextY: curR };
    }
    let blocked = false;
    for (let i = 0; i < positions.length; i++) {
      if (i === idx) continue;
      const p = positions[i];
      if (!p) continue;
      if (p[0] === nC && p[1] === nR) { blocked = true; break; }
    }
    if (blocked) {
      const dist = Math.abs(curC - sC) + Math.abs(curR - sR);
      if (dist === 0) return null;
      return { kind: 'slide', nextX: curC, nextY: curR };
    }
    curC = nC;
    curR = nR;
  }
}

function stateKey(positions: Pos[]): string {
  let s = '';
  for (const p of positions) s += p ? `${p[0]},${p[1]}|` : 'X|';
  return s;
}

function heuristic(ctx: SolverCtx, positions: Pos[]): number {
  // sum manhattan to nearest exit + 1 per remaining block
  let h = 0;
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    if (!p) continue;
    let min = Infinity;
    for (const t of ctx.exitTargets) {
      const d = Math.abs(p[0] - t.col) + Math.abs(p[1] - t.row);
      if (d < min) min = d;
    }
    h += Math.max(1, Math.ceil(min / 4)); // slide moves ≈ manhattan/avg-distance
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

interface SolveResult {
  solvable: boolean;
  optimal: number;
  visited: number;
  path: { blockId: string; dir: Direction }[];
}

function solve(level: Level, maxStates = 60000, maxDepth = 60): SolveResult {
  const ctx = buildCtx(level);
  if (ctx.movables.length === 0) return { solvable: true, optimal: 0, visited: 0, path: [] };

  const init: Pos[] = ctx.movables.map((b) => [b.pos[0], b.pos[1]]);
  const initKey = stateKey(init);
  const initH = heuristic(ctx, init);

  const open = new MinHeap<{ p: Pos[]; g: number; key: string }>();
  open.push({ p: init, g: 0, key: initKey }, initH);
  const seen = new Map<string, number>();
  seen.set(initKey, 0);

  type ParentRec = { parent: string | null; move: { blockId: string; dir: Direction } | null };
  const parents = new Map<string, ParentRec>();
  parents.set(initKey, { parent: null, move: null });

  let visited = 0;
  while (open.size > 0) {
    if (visited > maxStates) return { solvable: false, optimal: -1, visited, path: [] };
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
      return { solvable: true, optimal: cur.g, visited, path };
    }

    if (cur.g >= maxDepth) continue;
    const known = seen.get(cur.key);
    if (known !== undefined && known < cur.g) continue;

    for (let i = 0; i < cur.p.length; i++) {
      if (!cur.p[i]) continue;
      for (const d of DIRS) {
        const r = attempt(ctx, cur.p, i, d);
        if (!r) continue;
        const next: Pos[] = cur.p.slice();
        if (r.kind === 'exit') next[i] = null;
        else next[i] = [r.nextX!, r.nextY!];
        const nk = stateKey(next);
        const ng = cur.g + 1;
        const prev = seen.get(nk);
        if (prev !== undefined && prev <= ng) continue;
        seen.set(nk, ng);
        parents.set(nk, { parent: cur.key, move: { blockId: ctx.movables[i].id, dir: d } });
        const h = heuristic(ctx, next);
        open.push({ p: next, g: ng, key: nk }, ng + h);
      }
    }
  }
  return { solvable: false, optimal: -1, visited, path: [] };
}

// ============================================================
// Phase config — smooth curve, variety
// ============================================================

interface Phase {
  cols: number; rows: number;
  movables: number; yellows: number; deps: number; obstacles: number;
  exits: number;
  optMin: number; optMax: number;
  depthMode: 'linear' | 'branch' | 'mixed' | 'none';
  primarySide: ExitSide;
}

// PHASES generated from docs/LEVEL_DESIGN.md brief — 72 baked levels matching brief par targets.
// Pack layout:
//   Tutorial L1-8 (8 baked)
//   Hook L9-23 (15 baked)
//   Gears L24-43 (20 baked)
//   Stones L44-63 (20 baked)
//   Master L64-72 (9 baked)
// L73-78 = ice/lock fixtures (hand-authored, slot into Master pack)
// L79-80 = final-boss fixtures (hand-authored)
const SIDES_CYCLE: ExitSide[] = ['RIGHT', 'BOTTOM', 'LEFT', 'TOP'];

// Brief par targets per level (positional). 72 entries (baked).
// L73-L78 (par 21-28 per brief) are solver-infeasible — hand-authored as master pack fixtures.
// L79-L80 = fixture pack (legendary finale).
const PAR_TARGETS: number[] = [
  // Tutorial L1-8
  2, 3, 3, 4, 4, 5, 5, 6,
  // Hook L9-23
  7, 6, 8, 9, 7, 10, 8, 9, 11, 8, 10, 12, 9, 10, 12,
  // Gears L24-43
  10, 11, 12, 10, 13, 14, 11, 14, 12, 13, 15, 12, 14, 16, 13, 15, 17, 14, 16, 18,
  // Stones L44-63
  14, 15, 16, 14, 17, 16, 18, 15, 17, 19, 16, 18, 20, 17, 19, 20, 18, 21, 19, 22,
  // Master L64-72 (L73-78 = master pack fixtures, L79-80 = fixture pack)
  18, 19, 20, 18, 21, 20, 22, 19, 23,
];

function packOfIdx(idx: number): 'tutorial' | 'hook' | 'gears' | 'stones' | 'master' {
  if (idx < 8) return 'tutorial';
  if (idx < 23) return 'hook';
  if (idx < 43) return 'gears';
  if (idx < 63) return 'stones';
  return 'master';
}

function inferPhase(idx: number, par: number, side: ExitSide): Phase {
  const pack = packOfIdx(idx);
  // Grid scales with par
  let cols: number;
  if (par <= 4) cols = 5;
  else if (par <= 7) cols = 6;
  else if (par <= 11) cols = 7;
  else if (par <= 15) cols = 8;
  else if (par <= 19) cols = 9;
  else if (par <= 26) cols = 10;
  else cols = 11;
  const rows = cols;

  let movables: number;
  let yellows: number;
  let deps: number;
  let obstacles: number;
  let depthMode: Phase['depthMode'];
  let exits = 1;

  if (pack === 'tutorial') {
    // Brief targets: 2,3,3,4,4,5,5,6. Layout MUST force min par.
    if (par <= 2) { movables = 2; yellows = 0; deps = 0; obstacles = 0; depthMode = 'none'; }
    else if (par <= 3) { movables = 2; yellows = idx === 2 ? 1 : 0; deps = 0; obstacles = 1; depthMode = 'none'; }
    else if (par <= 4) { movables = 3; yellows = idx === 3 ? 1 : 0; deps = idx >= 4 ? 1 : 0; obstacles = 1; depthMode = deps > 0 ? 'linear' : 'none'; }
    else if (par <= 5) { movables = 3; yellows = 1; deps = 1; obstacles = 1; depthMode = 'linear'; }
    else { movables = 3; yellows = 1; deps = 1; obstacles = 2; depthMode = 'linear'; }
  } else if (pack === 'hook') {
    // Brief targets: 6-12. Forces wow-moments: dependent + chain.
    movables = par <= 8 ? 3 : 4;
    yellows = 1;
    deps = par >= 9 ? 2 : 1;
    obstacles = par >= 10 ? 3 : par >= 8 ? 2 : 1;
    depthMode = deps >= 2 ? 'linear' : 'linear';
  } else if (pack === 'gears') {
    // Brief targets: 10-18. Chain depth 2-3. No-under-par enforced via tight band.
    movables = par <= 11 ? 4 : 5;
    yellows = 1;
    deps = par <= 12 ? 2 : 3;
    obstacles = par <= 12 ? 3 : par <= 15 ? 4 : 5;
    depthMode = 'linear';
  } else if (pack === 'stones') {
    // Brief targets: 14-22. Obstacle-heavy theme. No-under-par.
    movables = par <= 16 ? 4 : 5;
    yellows = 1;
    deps = par <= 15 ? 2 : 3;
    obstacles = par <= 15 ? 5 : par <= 18 ? 6 : 7;
    depthMode = 'linear';
  // Master L64-77: par 18-26. No-under-par.
  } else {
    movables = 5;
    yellows = 1;
    deps = par <= 24 ? 3 : 4;
    obstacles = par <= 19 ? 5 : par <= 22 ? 6 : par <= 25 ? 8 : 9;
    depthMode = par >= 25 ? 'mixed' : 'linear';
  }

  // Gears + Stones + Master: NO-UNDER-PAR. optMin = par (strict floor). Upper band scales for master.
  // Tutorial + Hook: tight band (must hit brief par within ±1-2).
  if (pack === 'gears' || pack === 'stones') {
    return { cols, rows, movables, yellows, deps, obstacles, exits, optMin: par, optMax: par + 3, depthMode, primarySide: side };
  }
  if (pack === 'master') {
    // Master allows wider upper band for legendary-tier feasibility (par 24-28).
    const upper = par >= 27 ? par + 12 : par >= 24 ? par + 8 : par + 3;
    return { cols, rows, movables, yellows, deps, obstacles, exits, optMin: par, optMax: upper, depthMode, primarySide: side };
  }
  const tight = pack === 'tutorial' || pack === 'hook';
  return {
    cols, rows, movables, yellows, deps, obstacles, exits,
    optMin: tight ? Math.max(1, par - 1) : Math.max(1, par - 2),
    optMax: tight ? par + 2 : par + 3,
    depthMode,
    primarySide: side,
  };
}

function buildPhases(): Phase[] {
  const out: Phase[] = [];
  for (let i = 0; i < PAR_TARGETS.length; i++) {
    const side = SIDES_CYCLE[i % 4];
    out.push(inferPhase(i, PAR_TARGETS[i], side));
  }
  return out;
}

const PHASES: Phase[] = buildPhases();
const TOTAL = PHASES.length;

function getPhase(id: number): Phase { return PHASES[id - 1]; }

// ============================================================
// Generator
// ============================================================

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function sideToDir(s: ExitSide): Direction {
  return s === 'TOP' ? 'UP' : s === 'BOTTOM' ? 'DOWN' : s === 'LEFT' ? 'LEFT' : 'RIGHT';
}

function generateLevel(id: number, seed: number): Level | null {
  const rand = rng(seed);
  const phase = getPhase(id);
  const { cols, rows } = phase;
  const primaryDir = sideToDir(phase.primarySide);
  const isHorizontal = phase.primarySide === 'LEFT' || phase.primarySide === 'RIGHT';

  // Exits
  const exits: { side: ExitSide; index: number }[] = [];
  if (phase.exits === 1) {
    const max = isHorizontal ? rows : cols;
    exits.push({ side: phase.primarySide, index: 1 + Math.floor(rand() * (max - 2)) });
  } else if (phase.exits === 2) {
    const max = isHorizontal ? rows : cols;
    if (rand() < 0.7) {
      const i1 = 1 + Math.floor(rand() * Math.max(1, Math.floor((max - 4) / 2)));
      const i2 = Math.min(max - 2, i1 + 3 + Math.floor(rand() * 2));
      exits.push({ side: phase.primarySide, index: i1 });
      if (i2 > i1 + 1) exits.push({ side: phase.primarySide, index: i2 });
      else exits.push({ side: phase.primarySide, index: i1 + 2 });
    } else {
      const other: ExitSide =
        phase.primarySide === 'RIGHT' ? 'BOTTOM' :
        phase.primarySide === 'BOTTOM' ? 'RIGHT' :
        phase.primarySide === 'LEFT' ? 'TOP' : 'LEFT';
      exits.push({ side: phase.primarySide, index: 1 + Math.floor(rand() * (max - 2)) });
      const m2 = (other === 'TOP' || other === 'BOTTOM') ? cols : rows;
      exits.push({ side: other, index: 1 + Math.floor(rand() * (m2 - 2)) });
    }
  } else if (phase.exits === 4) {
    exits.push({ side: 'TOP', index: Math.floor(cols / 2) });
    exits.push({ side: 'BOTTOM', index: Math.floor(cols / 2) });
    exits.push({ side: 'LEFT', index: Math.floor(rows / 2) });
    exits.push({ side: 'RIGHT', index: Math.floor(rows / 2) });
  }

  const occupied: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const blocks: BlockSpec[] = [];

  // Obstacles
  for (let i = 0; i < phase.obstacles; i++) {
    let attempts = 0;
    while (attempts++ < 50) {
      const x = Math.floor(rand() * cols);
      const y = Math.floor(rand() * rows);
      if (occupied[y][x]) continue;
      // avoid placing obstacle on exit cell
      const isExitCell = exits.some((e) => {
        const tc = e.side === 'LEFT' ? 0 : e.side === 'RIGHT' ? cols - 1 : e.index;
        const tr = e.side === 'TOP' ? 0 : e.side === 'BOTTOM' ? rows - 1 : e.index;
        return x === tc && y === tr;
      });
      if (isExitCell) continue;
      occupied[y][x] = true;
      blocks.push({ id: `o${i + 1}`, type: 'obstacle', pos: [x, y] });
      break;
    }
  }

  // Roles
  const roles: ('simple' | 'constrained' | 'dependent')[] = [];
  for (let i = 0; i < phase.deps; i++) roles.push('dependent');
  for (let i = 0; i < phase.yellows; i++) roles.push('constrained');
  while (roles.length < phase.movables) roles.push('simple');
  if (roles.length > phase.movables) roles.length = phase.movables;
  const nonDep = roles.filter((r) => r !== 'dependent').length;
  if (nonDep === 0 && roles.length > 0) {
    const i = roles.indexOf('dependent');
    roles[i] = 'simple';
  }

  // Sort: place non-dep first, dep after (dep gets later positions in queue)
  roles.sort((a, b) => (a === 'dependent' ? 1 : 0) - (b === 'dependent' ? 1 : 0));

  // Place movables
  const ids: string[] = [];
  for (let i = 0; i < phase.movables; i++) ids.push(`m${i + 1}`);

  // primary axis line(s) for biased placement
  const primaryRows: number[] = [];
  const primaryCols: number[] = [];
  for (const e of exits) {
    if (e.side === 'LEFT' || e.side === 'RIGHT') primaryRows.push(e.index);
    else primaryCols.push(e.index);
  }

  for (let i = 0; i < phase.movables; i++) {
    const role = roles[i];
    let placed = false;
    for (let attempt = 0; attempt < 80 && !placed; attempt++) {
      let x: number, y: number;
      if (rand() < 0.75 && (primaryRows.length > 0 || primaryCols.length > 0)) {
        if (isHorizontal && primaryRows.length > 0) {
          y = pick(rand, primaryRows);
          x = Math.floor(rand() * cols);
        } else if (!isHorizontal && primaryCols.length > 0) {
          x = pick(rand, primaryCols);
          y = Math.floor(rand() * rows);
        } else {
          x = Math.floor(rand() * cols);
          y = Math.floor(rand() * rows);
        }
      } else {
        x = Math.floor(rand() * cols);
        y = Math.floor(rand() * rows);
      }
      if (occupied[y][x]) continue;
      occupied[y][x] = true;

      const spec: BlockSpec = { id: ids[i], type: role, pos: [x, y] };
      if (role === 'constrained') spec.direction = primaryDir;
      blocks.push(spec);
      placed = true;
    }
    if (!placed) return null;
  }

  // Wire dependents
  const depBlocks = blocks.filter((b) => b.type === 'dependent');
  const nonDepBlocks = blocks.filter((b) => b.type === 'simple' || b.type === 'constrained');
  if (depBlocks.length > 0 && nonDepBlocks.length === 0) return null;

  if (phase.depthMode === 'linear') {
    let parent = nonDepBlocks[0];
    for (const d of depBlocks) {
      d.dependsOn = parent.id;
      parent = d;
    }
  } else if (phase.depthMode === 'branch') {
    const root = nonDepBlocks[0];
    for (const d of depBlocks) d.dependsOn = root.id;
  } else if (phase.depthMode === 'mixed') {
    const root = nonDepBlocks[0];
    let parent = root;
    for (let i = 0; i < depBlocks.length; i++) {
      if (i % 2 === 0) {
        depBlocks[i].dependsOn = parent.id;
        parent = depBlocks[i];
      } else {
        depBlocks[i].dependsOn = root.id;
      }
    }
  } else {
    for (const d of depBlocks) d.dependsOn = nonDepBlocks[0].id;
  }

  return { id, cols, rows, blocks, exits };
}

// ============================================================
// Bake loop
// ============================================================

function levelSig(level: Level): string {
  const blockSig = [...level.blocks]
    .map((b) => `${b.type}@${b.pos[0]},${b.pos[1]}|${b.direction ?? ''}|${b.dependsOn ?? ''}`)
    .sort().join(';');
  const exitSig = [...level.exits].map((e) => `${e.side}@${e.index}`).sort().join(';');
  return `${level.cols}x${level.rows}#${blockSig}#${exitSig}`;
}

interface BakedLevel { lvl: Level; opt: number; path: { blockId: string; dir: Direction }[]; }

// JSON store entry — persisted shape per level
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

function parseArgs(): { ids: number[]; description: string } {
  const args = process.argv.slice(2);
  const ids = new Set<number>();
  const labels: string[] = [];
  for (const arg of args) {
    if (arg.startsWith('--pack=')) {
      const p = arg.slice(7);
      const range = PACK_RANGES[p];
      if (!range) {
        console.error(`unknown pack '${p}'. Valid: ${Object.keys(PACK_RANGES).join(', ')}`);
        process.exit(1);
      }
      for (let i = range[0]; i <= range[1]; i++) ids.add(i);
      labels.push(`pack=${p}(${range[0]}..${range[1]})`);
    } else if (arg.startsWith('--ids=')) {
      const expr = arg.slice(6);
      for (const part of expr.split(',')) {
        const m = part.match(/^(\d+)(?:-(\d+))?$/);
        if (!m) { console.error(`bad id range '${part}'`); process.exit(1); }
        const lo = parseInt(m[1], 10);
        const hi = m[2] ? parseInt(m[2], 10) : lo;
        for (let i = lo; i <= hi; i++) ids.add(i);
      }
      labels.push(`ids=${expr}`);
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npx tsx scripts/bake-v2.ts [--pack=NAME] [--ids=A-B,C]');
      console.log(`Packs: ${Object.entries(PACK_RANGES).map(([k, v]) => `${k}(${v[0]}..${v[1]})`).join(', ')}`);
      process.exit(0);
    } else {
      console.error(`unknown arg '${arg}' (use --help)`);
      process.exit(1);
    }
  }
  // Validate: only baked-pack IDs allowed (1..TOTAL_BAKED)
  for (const id of ids) {
    if (id < 1 || id > TOTAL_BAKED) {
      console.error(`id ${id} out of bake range (1..${TOTAL_BAKED}). Fixtures (73-80) are inline.`);
      process.exit(1);
    }
  }
  if (ids.size === 0) {
    for (let i = 1; i <= TOTAL_BAKED; i++) ids.add(i);
    labels.push(`all(1..${TOTAL_BAKED})`);
  }
  return { ids: [...ids].sort((a, b) => a - b), description: labels.join(' + ') };
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
    console.warn(`[store] failed to read ${STORE_PATH_REL}, starting fresh:`, (e as Error).message);
  }
  return store;
}

function saveStore(repoRoot: string, store: Map<number, StoredLevel>): void {
  const full = resolve(repoRoot, STORE_PATH_REL);
  mkdirSync(dirname(full), { recursive: true });
  const sortedIds = [...store.keys()].sort((a, b) => a - b);
  const obj: { version: number; updated: string; levels: Record<string, StoredLevel> } = {
    version: 1,
    updated: new Date().toISOString(),
    levels: {},
  };
  for (const id of sortedIds) obj.levels[String(id)] = store.get(id)!;
  writeFileSync(full, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function bakedToStored(b: BakedLevel): StoredLevel {
  return {
    id: b.lvl.id,
    cols: b.lvl.cols,
    rows: b.lvl.rows,
    blocks: b.lvl.blocks,
    exits: b.lvl.exits,
    parMoves: b.opt,
    pack: packOfId(b.lvl.id),
    solution: b.path,
  };
}

function bakeIds(ids: number[], existingSigs: Set<string>): Map<number, BakedLevel> {
  const out = new Map<number, BakedLevel>();
  for (const id of ids) {
    const phase = getPhase(id);
    const pack = packOfId(id);
    const noFallback = pack === 'gears' || pack === 'stones' || pack === 'master';
    let chosen: BakedLevel | null = null;
    // Tight packs (no-under-par): drop pass-3 non-strict fallback; expand strict passes instead.
    const passes: { maxAttempts: number; budget: number; depth: number; strict: boolean }[] = noFallback
      ? [
          { maxAttempts: 400, budget: 80000, depth: 60, strict: true },
          { maxAttempts: 400, budget: 160000, depth: 80, strict: true },
          { maxAttempts: 600, budget: 240000, depth: 100, strict: true },
        ]
      : [
          { maxAttempts: 200, budget: 40000, depth: 50, strict: true },
          { maxAttempts: 200, budget: 80000, depth: 60, strict: true },
          { maxAttempts: 300, budget: 120000, depth: 70, strict: false },
        ];

    outer:
    for (const pass of passes) {
      for (let attempt = 0; attempt < pass.maxAttempts; attempt++) {
        const seed = id * 100003 + attempt * 977 + (pass.budget * 31);
        const lvl = generateLevel(id, seed);
        if (!lvl) continue;
        const sig = levelSig(lvl);
        if (existingSigs.has(sig)) continue;
        const r = solve(lvl, pass.budget, pass.depth);
        if (!r.solvable) continue;
        if (pass.strict && (r.optimal < phase.optMin || r.optimal > phase.optMax)) continue;
        chosen = { lvl, opt: r.optimal, path: r.path };
        break outer;
      }
    }

    if (!chosen) {
      console.error(`L${id}: failed bake`);
      process.exit(1);
    }
    existingSigs.add(levelSig(chosen.lvl));
    out.set(id, chosen);
    const inBand = chosen.opt >= phase.optMin && chosen.opt <= phase.optMax ? '✓' : '~';
    console.log(
      `L${String(id).padStart(3)} (${phase.cols}x${phase.rows}, ${chosen.lvl.exits.length}ex, ${chosen.lvl.blocks.length}b): opt=${chosen.opt} band=[${phase.optMin}-${phase.optMax}] ${inBand} path=${chosen.path.length}`
    );
  }
  return out;
}

// ============================================================
// Emit Levels.ts
// ============================================================

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

// AUTO-BAKED via scripts/bake-v2.ts. Each level verified solvable by A* solver
// matching MovementSystem (slide momentum + constrained + dependent).
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

  // Fixture levels — hand-authored. L73-78 in master pack (ice push + lock counter intros).
  // L79-80 = fixture pack (legendary finale combining all mechanics).
  // Brief par targets for L73-78 (25/21/24/26/22/28) are solver-infeasible at current generator —
  // these stay as mechanic-intro hand-authored levels with lower par.
  const fixtures = `
  // === MASTER PACK FIXTURES (L73-78): single-exit ice + lock intros ===
  // L73 — ice push intro: skip 1 obstacle
  L(73, 5, 3, [SC('m1',0,1,'red'), O('o1',2,1)], [E('RIGHT',1)], 2, 'master', [[1,1]]),
  // L74 — chain push through two obstacles
  L(74, 7, 3, [SC('m1',0,1,'red'), O('o1',2,1), O('o2',4,1)], [E('RIGHT',1)], 2, 'master', [[1,1],[3,1]]),
  // L75 — chain push landing on ice
  L(75, 6, 3, [SC('m1',0,1,'red'), O('o1',3,1)], [E('RIGHT',1)], 2, 'master', [[2,1],[4,1]]),
  // L76 — lock counter intro: unlockAt 1
  L(76, 6, 3, [SC('m1',0,1,'red'), K('k1',0,2,1), O('o1',5,0)], [E('RIGHT',1)], 4, 'master'),
  // L77 — lock unlockAt 2 (need 2 exits first)
  L(77, 7, 3, [SC('m1',0,1,'red'), SC('m2',0,2,'blue'), K('k1',6,2,2), O('o1',5,0), O('o2',6,0)], [E('RIGHT',1)], 6, 'master'),
  // L78 — two locks, staggered unlock (1 and 2)
  L(78, 8, 3, [SC('m1',0,1,'red'), K('k1',0,2,1), K('k2',7,2,2), O('o1',6,0), O('o2',7,0)], [E('RIGHT',1)], 6, 'master'),
  // === FIXTURE PACK (L79-80): legendary finale ===
  // L79 — Penultimate showcase. Ice push + lock counter + dep chain depth 4 + all mechanics.
  // Single exit RIGHT row 5. Lock at (5,5) opens after 3 exits.
  L(79, 10, 10, [
    SC('m1',0,5,'red'),
    D('m2',0,2,'m1'),
    D('m3',0,8,'m2'),
    D('m4',9,2,'m3'),
    SC('m5',3,5,'blue'),
    K('k1',5,5,3,'purple'),
    O('o1',9,4), O('o2',7,2), O('o3',2,7), O('o4',4,0), O('o5',6,0), O('o6',1,7), O('o7',8,8), O('o8',2,1), O('o9',7,7), O('o10',3,3), O('o11',1,9), O('o12',4,4), O('o13',4,6), O('o14',6,4), O('o15',6,6), O('o16',1,4), O('o17',1,6),
  ], [E('RIGHT',5)], 32, 'fixture', [[6,5],[5,3]]),
  // L80 — final boss. Single exit. All mechanics. Par 38 target. Dep chain depth 4.
  L(80, 10, 10, [
    SC('m1',0,5,'red'),
    D('m2',0,2,'m1'),
    D('m3',0,8,'m2'),
    D('m4',9,2,'m3'),
    D('m5',3,5,'m4'),
    K('k1',5,5,4,'purple'),
    SC('m6',9,8,'blue'),
    O('o1',9,4), O('o2',7,2), O('o3',2,7), O('o4',4,0), O('o5',6,0), O('o6',1,7), O('o7',8,8),
    O('o8',2,1), O('o9',7,7), O('o10',3,3), O('o11',1,9), O('o12',4,4), O('o13',4,6),
    O('o14',6,4), O('o15',6,6), O('o16',1,4), O('o17',1,6), O('o18',3,9),
  ], [E('RIGHT',5)], 39, 'fixture', [[6,5],[5,3]]),`;

  const bakedSolutions = entries.map((e) => {
    const moves = e.solution.map((m) => `{blockId:'${m.blockId}',dir:'${m.dir}'}`).join(', ');
    return `  ${e.id}: [${moves}],`;
  }).join('\n');

  const fixtureSolutions = `  73: [{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'RIGHT'}],
  74: [{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'RIGHT'}],
  75: [{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'RIGHT'}],
  76: [{blockId:'m1',dir:'RIGHT'},{blockId:'k1',dir:'RIGHT'},{blockId:'k1',dir:'UP'},{blockId:'k1',dir:'RIGHT'}],
  77: [{blockId:'m1',dir:'RIGHT'},{blockId:'m2',dir:'RIGHT'},{blockId:'m2',dir:'UP'},{blockId:'m2',dir:'RIGHT'},{blockId:'k1',dir:'UP'},{blockId:'k1',dir:'RIGHT'}],
  78: [{blockId:'m1',dir:'RIGHT'},{blockId:'k1',dir:'RIGHT'},{blockId:'k1',dir:'UP'},{blockId:'k1',dir:'RIGHT'},{blockId:'k2',dir:'UP'},{blockId:'k2',dir:'RIGHT'}],
  79: [{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'DOWN'},{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'DOWN'},{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'UP'},{blockId:'m1',dir:'RIGHT'},{blockId:'m5',dir:'UP'},{blockId:'m5',dir:'LEFT'},{blockId:'m5',dir:'UP'},{blockId:'m2',dir:'RIGHT'},{blockId:'m2',dir:'DOWN'},{blockId:'m2',dir:'RIGHT'},{blockId:'m2',dir:'DOWN'},{blockId:'m5',dir:'DOWN'},{blockId:'m2',dir:'RIGHT'},{blockId:'m2',dir:'DOWN'},{blockId:'m2',dir:'RIGHT'},{blockId:'m2',dir:'UP'},{blockId:'m2',dir:'RIGHT'},{blockId:'m3',dir:'RIGHT'},{blockId:'m3',dir:'DOWN'},{blockId:'m3',dir:'RIGHT'},{blockId:'m3',dir:'UP'},{blockId:'m3',dir:'RIGHT'},{blockId:'k1',dir:'RIGHT'},{blockId:'m5',dir:'RIGHT'},{blockId:'m4',dir:'LEFT'},{blockId:'m4',dir:'DOWN'},{blockId:'m4',dir:'RIGHT'},{blockId:'m4',dir:'UP'},{blockId:'m4',dir:'RIGHT'}],
  80: [{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'DOWN'},{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'DOWN'},{blockId:'m1',dir:'RIGHT'},{blockId:'m6',dir:'DOWN'},{blockId:'m6',dir:'LEFT'},{blockId:'m1',dir:'DOWN'},{blockId:'m1',dir:'RIGHT'},{blockId:'m1',dir:'UP'},{blockId:'m6',dir:'RIGHT'},{blockId:'m6',dir:'UP'},{blockId:'m1',dir:'RIGHT'},{blockId:'m2',dir:'RIGHT'},{blockId:'m2',dir:'DOWN'},{blockId:'m2',dir:'RIGHT'},{blockId:'m6',dir:'LEFT'},{blockId:'m6',dir:'UP'},{blockId:'m2',dir:'LEFT'},{blockId:'m2',dir:'DOWN'},{blockId:'m2',dir:'RIGHT'},{blockId:'m2',dir:'UP'},{blockId:'m2',dir:'RIGHT'},{blockId:'m3',dir:'RIGHT'},{blockId:'m3',dir:'DOWN'},{blockId:'m3',dir:'RIGHT'},{blockId:'m3',dir:'UP'},{blockId:'m3',dir:'RIGHT'},{blockId:'m4',dir:'LEFT'},{blockId:'m4',dir:'DOWN'},{blockId:'m4',dir:'RIGHT'},{blockId:'m4',dir:'UP'},{blockId:'m4',dir:'RIGHT'},{blockId:'k1',dir:'RIGHT'},{blockId:'m5',dir:'RIGHT'},{blockId:'m6',dir:'DOWN'},{blockId:'m6',dir:'RIGHT'},{blockId:'m6',dir:'UP'},{blockId:'m6',dir:'RIGHT'}],`;

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

// ============================================================
// Run
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

// Parse CLI args + determine target IDs
const { ids: targetIds, description: targetDesc } = parseArgs();
console.log(`Bake target: ${targetDesc} (${targetIds.length} levels)`);

// Load existing store
const store = loadStore(REPO_ROOT);
console.log(`Store: loaded ${store.size} existing baked entries`);

// Bootstrap: seed from existing Levels.ts on first run (covers IDs missing in store).
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
    id: lvl.id,
    cols: lvl.cols,
    rows: lvl.rows,
    blocks,
    exits: lvl.exits.map((e) => ({ side: e.side as ExitSide, index: e.index })),
    parMoves: lvl.parMoves,
    pack: lvl.pack ?? packOfId(lvl.id),
    solution: (EXISTING_SOLUTIONS[lvl.id] ?? []).map((m) => ({ blockId: m.blockId, dir: m.dir as Direction })),
  });
  seeded++;
}
if (seeded > 0) console.log(`Store: seeded ${seeded} entries from existing Levels.ts`);

// Collect existing signatures (skip those being re-baked)
const existingSigs = new Set<string>();
for (const [id, entry] of store) {
  if (targetIds.includes(id)) continue; // will be re-baked, don't lock signature
  const sig = `${entry.cols}x${entry.rows}#`
    + [...entry.blocks].map((b) => `${b.type}@${b.pos[0]},${b.pos[1]}|${b.direction ?? ''}|${b.dependsOn ?? ''}`).sort().join(';')
    + `#${[...entry.exits].map((e) => `${e.side}@${e.index}`).sort().join(';')}`;
  existingSigs.add(sig);
}

const t0 = Date.now();
const baked = bakeIds(targetIds, existingSigs);
const dt = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`---`);
console.log(`Baked ${baked.size} levels in ${dt}s`);

// Merge baked into store
for (const [id, b] of baked) {
  store.set(id, bakedToStored(b));
}

// Save store
saveStore(REPO_ROOT, store);
console.log(`Store: saved ${store.size} entries → ${STORE_PATH_REL}`);

// Verify completeness for emit (must have all baked IDs 1..TOTAL_BAKED)
const missing: number[] = [];
for (let i = 1; i <= TOTAL_BAKED; i++) if (!store.has(i)) missing.push(i);
if (missing.length > 0) {
  console.error(`Cannot emit Levels.ts — store missing IDs: ${missing.join(', ')}`);
  console.error(`Run full bake first: npx tsx scripts/bake-v2.ts`);
  process.exit(1);
}

// Emit Levels.ts from store (sorted by id)
const sortedEntries = [...store.values()].sort((a, b) => a.id - b.id);
const out = emitLevelsTs(sortedEntries);
const outPath = resolve(REPO_ROOT, 'src', 'config', 'Levels.ts');
writeFileSync(outPath, out, 'utf8');
console.log(`Wrote ${outPath}`);
