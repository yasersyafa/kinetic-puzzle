import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { LevelData, BlockData, Color, ExitZone, ExitSide } from '../src/types/Game.ts';
import { solve } from '../src/utils/Solver.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TOTAL_LEVELS = 50;

const COLOR_POOL: Color[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
const ALL_SIDES: ExitSide[] = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT'];

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function buildLevel(id: number, seed: number): LevelData {
  const rand = rng(seed);
  const cols = id <= 10 ? 5 : id <= 25 ? 6 : 7;
  const rows = cols;

  const targetSimple = Math.min(11, 3 + Math.floor(id * 0.2));
  const targetObstacles =
    id <= 10
      ? 0
      : id <= 20
        ? Math.min(2, 1 + Math.floor((id - 10) * 0.3))
        : Math.min(5, 2 + Math.floor((id - 20) * 0.15));

  const occupied: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const blocks: BlockData[] = [];

  for (let i = 0; i < targetObstacles; i++) {
    let attempts = 0;
    while (attempts++ < 50) {
      const x = 1 + Math.floor(rand() * (cols - 2));
      const y = 1 + Math.floor(rand() * (rows - 2));
      if (occupied[y][x]) continue;
      occupied[y][x] = true;
      blocks.push({
        id: `obs${i}`,
        color: 'red',
        position: [x, y],
        size: [1, 1],
        type: 'obstacle',
      });
      break;
    }
  }

  let simpleCount = 0;
  let attempts = 0;
  while (simpleCount < targetSimple && attempts < 200) {
    attempts++;
    const x = Math.floor(rand() * cols);
    const y = Math.floor(rand() * rows);
    if (occupied[y][x]) continue;

    occupied[y][x] = true;

    const colorCount = id <= 5 ? 2 : id <= 20 ? 3 : id <= 40 ? 4 : 6;
    const color = COLOR_POOL[Math.floor(rand() * colorCount)];

    let allowedExits: ExitSide[] | undefined;
    if (id >= 16 && rand() < 0.3) {
      const set = new Set<ExitSide>();
      while (set.size < 2) set.add(pick(rand, ALL_SIDES));
      allowedExits = Array.from(set);
    }

    blocks.push({
      id: `b${simpleCount}`,
      color,
      position: [x, y],
      size: [1, 1],
      type: 'simple',
      allowedExits,
    });
    simpleCount++;
  }

  const exits: ExitZone[] = [];
  if (id <= 10) {
    for (let i = 0; i < cols; i++) {
      exits.push({ side: 'TOP', index: i });
      exits.push({ side: 'BOTTOM', index: i });
    }
    for (let i = 0; i < rows; i++) {
      exits.push({ side: 'LEFT', index: i });
      exits.push({ side: 'RIGHT', index: i });
    }
  } else {
    const exitCount = id <= 25 ? 3 : 2;
    for (const side of ALL_SIDES) {
      const max = side === 'TOP' || side === 'BOTTOM' ? cols : rows;
      const used = new Set<number>();
      while (used.size < Math.min(exitCount, max)) {
        used.add(Math.floor(rand() * max));
      }
      used.forEach((idx) => exits.push({ side, index: idx }));
    }
  }

  return { id, cols, rows, blocks, exits, optimalMoves: 0 };
}

function generateLevel(id: number): LevelData {
  const baseSeed = id * 9301 + 49297;
  let last: LevelData | null = null;
  const maxAttempts = 32;
  const solverBudget = id <= 10 ? 30000 : id <= 25 ? 200000 : 800000;
  const solverDepth = id <= 10 ? 80 : id <= 25 ? 130 : 220;

  for (let i = 0; i < maxAttempts; i++) {
    const level = buildLevel(id, baseSeed + i * 7919);
    last = level;
    const result = solve(level, { maxVisited: solverBudget, maxDepth: solverDepth });
    if (result.solvable) {
      level.optimalMoves = result.optimalMoves;
      console.log(
        `  level ${String(id).padStart(2)}: solved attempt ${i + 1}/${maxAttempts}, optimal=${result.optimalMoves}, visited=${result.visited}`
      );
      return level;
    }
  }
  console.warn(
    `  level ${id}: solver exhausted ${maxAttempts} attempts, falling back to last attempt`
  );
  return last as LevelData;
}

console.log(`Baking ${TOTAL_LEVELS} levels...`);
const t0 = Date.now();
const levels: LevelData[] = [];
for (let i = 1; i <= TOTAL_LEVELS; i++) {
  levels.push(generateLevel(i));
}
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

const outPath = resolve(__dirname, '..', 'src', 'config', 'levels-baked.json');
writeFileSync(outPath, JSON.stringify(levels, null, 2) + '\n', 'utf8');

console.log(`---`);
console.log(`Wrote ${levels.length} levels → ${outPath}`);
console.log(`Total time: ${elapsed}s`);
const totalOpt = levels.reduce((s, l) => s + l.optimalMoves, 0);
console.log(`Avg optimal: ${(totalOpt / levels.length).toFixed(1)} moves`);
