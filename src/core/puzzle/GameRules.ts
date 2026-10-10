import type { BlockData, Direction, ExitSide, ExitZone, LevelData } from '../../types/Game';




export const RULES_VERSION = '1.0.0';
export interface RuleBlock {
  blockId: string; gridPos: [number, number]; size: [number, number];
  type: NonNullable<BlockData['type']>; direction?: Direction;
  dependsOn?: string; unlockAt: number; removed: boolean;
}
export interface RuleGrid {
  cols: number; rows: number;
  getExitCount(): number;
  hasExit(side: ExitSide, index: number): boolean;
  hasIce(col: number, row: number): boolean;
  getOccupant(col: number, row: number): RuleBlock | null;
}
export interface Action { blockId: string; dir: Direction }
export interface PuzzleState {
  readonly cols: number; readonly rows: number;
  readonly exits: readonly ExitZone[];
  readonly iceCells: readonly (readonly [number, number])[];
  readonly blocks: readonly RuleBlock[];
  readonly exitCount: number;
}
export interface TransitionResult {
  state: PuzzleState;
  result: SlideResult;
  trace: { icePush: boolean; stopperId?: string };
}
export const DIRECTIONS: readonly Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

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

export type SlideResult =
  | { kind: 'exit'; side: ExitSide; toCol: number; toRow: number; distance: number }
  | { kind: 'slide'; toCol: number; toRow: number; distance: number }
  | { kind: 'invalid'; reason: 'blocked' | 'wrong_dir' | 'locked' | 'no_exit' | 'ice_stop' };

export class SlideRules {
  public slide(block: RuleBlock, grid: RuleGrid, dir: Direction, allBlocks: RuleBlock[]): SlideResult {
    if (block.removed) return { kind: 'invalid', reason: 'blocked' };
    if (block.type === 'obstacle') return { kind: 'invalid', reason: 'blocked' };
    if (block.type === 'lock' && grid.getExitCount() < block.unlockAt) {
      return { kind: 'invalid', reason: 'locked' };
    }
    if (block.type === 'dependent' && !this.depsCleared(block, allBlocks)) {
      return { kind: 'invalid', reason: 'locked' };
    }
    if (block.type === 'constrained' && !this.constraintsOK(block, dir)) {
      return { kind: 'invalid', reason: 'wrong_dir' };
    }

    const [dx, dy] = DELTA[dir];
    let curCol = block.gridPos[0];
    let curRow = block.gridPos[1];
    const startCol = curCol;
    const startRow = curRow;

    while (true) {
      const nextCol = curCol + dx;
      const nextRow = curRow + dy;

      if (this.outOfGrid(nextCol, nextRow, grid)) {
        const side = DIR_TO_SIDE[dir];
        const exitIdx = side === 'LEFT' || side === 'RIGHT' ? curRow : curCol;
        const distance = Math.abs(curCol - startCol) + Math.abs(curRow - startRow);
        if (grid.hasExit(side, exitIdx)) {
          return { kind: 'exit', side, toCol: curCol, toRow: curRow, distance };
        }
        if (distance === 0) return { kind: 'invalid', reason: 'blocked' };
        // Ice push: try to skip past edge (no exit) — fails because no cell beyond
        if (grid.hasIce(curCol, curRow)) return { kind: 'invalid', reason: 'ice_stop' };
        return { kind: 'slide', toCol: curCol, toRow: curRow, distance };
      }

      const occ = grid.getOccupant(nextCol, nextRow);
      if (occ && occ !== block) {
        const distance = Math.abs(curCol - startCol) + Math.abs(curRow - startRow);
        if (distance === 0) return { kind: 'invalid', reason: 'blocked' };
        // Ice push: if natural stop is ice, try to skip past blocker
        if (grid.hasIce(curCol, curRow)) {
          const pushed = this.icePush(grid, curCol, curRow, nextCol, nextRow, dir, block, allBlocks);
          if (pushed) {
            const totalDist = Math.abs(pushed.toCol - startCol) + Math.abs(pushed.toRow - startRow);
            if (pushed.exit) {
              return { kind: 'exit', side: DIR_TO_SIDE[dir], toCol: pushed.toCol, toRow: pushed.toRow, distance: totalDist };
            }
            return { kind: 'slide', toCol: pushed.toCol, toRow: pushed.toRow, distance: totalDist };
          }
          return { kind: 'invalid', reason: 'ice_stop' };
        }
        return { kind: 'slide', toCol: curCol, toRow: curRow, distance };
      }

      curCol = nextCol;
      curRow = nextRow;
    }
  }

  // Ice push: starting from ice cell at (curCol, curRow), try to jump past the blocker
  // at (skipCol, skipRow). Lands at (skipCol+dx, skipRow+dy). Recurses if landing is ice.
  // Returns null if push impossible.
  private icePush(
    grid: RuleGrid,
    curCol: number, curRow: number,
    skipCol: number, skipRow: number,
    dir: Direction,
    self: RuleBlock, allBlocks: RuleBlock[],
  ): { toCol: number; toRow: number; exit: boolean } | null {
    void curCol; void curRow;
    const [dx, dy] = DELTA[dir];
    const landCol = skipCol + dx;
    const landRow = skipRow + dy;
    if (this.outOfGrid(landCol, landRow, grid)) {
      const side = DIR_TO_SIDE[dir];
      const exitIdx = side === 'LEFT' || side === 'RIGHT' ? skipRow : skipCol;
      if (grid.hasExit(side, exitIdx)) {
        return { toCol: skipCol, toRow: skipRow, exit: true };
      }
      return null;
    }
    const occ = grid.getOccupant(landCol, landRow);
    if (occ && occ !== self) return null;
    if (grid.hasIce(landCol, landRow)) {
      // Recurse: from ice landing, try another push if there's another blocker ahead
      const nextCol = landCol + dx;
      const nextRow = landRow + dy;
      if (this.outOfGrid(nextCol, nextRow, grid)) {
        const side = DIR_TO_SIDE[dir];
        const exitIdx = side === 'LEFT' || side === 'RIGHT' ? landRow : landCol;
        if (grid.hasExit(side, exitIdx)) return { toCol: landCol, toRow: landRow, exit: true };
        return null;
      }
      const nextOcc = grid.getOccupant(nextCol, nextRow);
      if (nextOcc && nextOcc !== self) {
        // chain push
        return this.icePush(grid, landCol, landRow, nextCol, nextRow, dir, self, allBlocks);
      }
      // free cell after ice: normal slide would continue. End of push — return ice landing.
      return { toCol: landCol, toRow: landRow, exit: false };
    }
    return { toCol: landCol, toRow: landRow, exit: false };
  }

  public constraintsOK(block: RuleBlock, dir: Direction): boolean {
    if (block.type !== 'constrained') return true;
    return block.direction === dir;
  }

  public depsCleared(block: RuleBlock, allBlocks: RuleBlock[]): boolean {
    if (block.type !== 'dependent' || !block.dependsOn) return true;
    const dep = allBlocks.find((b) => b.blockId === block.dependsOn);
    if (!dep) return true;
    return dep.removed;
  }

  public anyValidMove(blocks: RuleBlock[], grid: RuleGrid): boolean {
    const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    for (const b of blocks) {
      if (b.removed || b.type === 'obstacle') continue;
      for (const d of dirs) {
        const r = this.slide(b, grid, d, blocks);
        if (r.kind === 'exit') return true;
        if (r.kind === 'slide' && r.distance > 0) return true;
      }
    }
    return false;
  }

  public findAnyExit(blocks: RuleBlock[], grid: RuleGrid): { block: RuleBlock; dir: Direction } | null {
    const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    for (const b of blocks) {
      if (b.removed || b.type === 'obstacle') continue;
      for (const d of dirs) {
        const r = this.slide(b, grid, d, blocks);
        if (r.kind === 'exit') return { block: b, dir: d };
      }
    }
    return null;
  }

  private outOfGrid(col: number, row: number, grid: RuleGrid): boolean {
    return col < 0 || col >= grid.cols || row < 0 || row >= grid.rows;
  }
}

export function createState(level: LevelData): PuzzleState {
  return {
    cols: level.cols, rows: level.rows,
    exits: level.exits.map(e => ({ ...e })),
    iceCells: (level.iceCells ?? []).map(p => [...p] as [number, number]),
    blocks: level.blocks.map(b => ({
      blockId: b.id, gridPos: [...b.position], size: [...b.size],
      type: b.type ?? 'simple', direction: b.direction, dependsOn: b.dependsOn,
      unlockAt: b.unlockAt ?? 0, removed: false,
    })), exitCount: 0,
  };
}
export function stateGrid(state: PuzzleState): RuleGrid {
  const occupancy = new Map<number, RuleBlock>();
  for (const b of state.blocks) {
    if (b.removed) continue;
    for (let y = 0; y < b.size[1]; y++) for (let x = 0; x < b.size[0]; x++)
      occupancy.set((b.gridPos[1] + y) * state.cols + b.gridPos[0] + x, b);
  }
  const ice = new Set(state.iceCells.map(([x,y]) => y * state.cols + x));
  return {
    cols: state.cols, rows: state.rows,
    getExitCount: () => state.exitCount,
    hasExit: (side, index) => state.exits.some(e => e.side === side && e.index === index),
    hasIce: (x, y) => ice.has(y * state.cols + x),
    getOccupant: (x,y) => x < 0 || y < 0 || x >= state.cols || y >= state.rows
      ? null : occupancy.get(y * state.cols + x) ?? null,
  };
}
export class GameRules {
  private readonly movement = new SlideRules();
  applyAction(state: PuzzleState, action: Action): TransitionResult {
    if (!action || typeof action !== 'object') return { state, result: { kind: 'invalid', reason: 'blocked' }, trace: { icePush: false } };
    const block = state.blocks.find(b => b.blockId === action.blockId);
    if (!block || !DIRECTIONS.includes(action.dir))
      return { state, result: { kind: 'invalid', reason: 'blocked' }, trace: { icePush: false } };
    const grid = stateGrid(state);
    const result = this.movement.slide(block, grid, action.dir, [...state.blocks]);
    if (result.kind === 'invalid') return { state, result, trace: { icePush: false } };
    // Trace natural stop separately: ice can jump past a blocker without moving it.
    const [dx,dy] = DELTA[action.dir];
    let x = block.gridPos[0], y = block.gridPos[1];
    let stopper: RuleBlock | null = null;
    while (x + dx >= 0 && y + dy >= 0 && x + dx < state.cols && y + dy < state.rows) {
      stopper = grid.getOccupant(x + dx, y + dy);
      if (stopper && stopper !== block) break;
      x += dx; y += dy;
    }
    const blocks = state.blocks.map(b => b === block
      ? { ...b, gridPos: [result.toCol, result.toRow] as [number,number], removed: result.kind === 'exit' }
      : b);
    return {
      state: { ...state, blocks, exitCount: state.exitCount + (result.kind === 'exit' ? 1 : 0) },
      result,
      trace: { icePush: !!stopper && grid.hasIce(x,y), stopperId: stopper?.blockId },
    };
  }
  getLegalActions(state: PuzzleState): Action[] {
    const actions: Action[] = [];
    for (const b of [...state.blocks].sort((a,b) => a.blockId < b.blockId ? -1 : a.blockId > b.blockId ? 1 : 0)) {
      if (b.removed || b.type === 'obstacle') continue;
      for (const dir of DIRECTIONS) {
        const action = { blockId: b.blockId, dir };
        if (this.applyAction(state, action).result.kind !== 'invalid') actions.push(action);
      }
    }
    return actions;
  }
  isWin(state: PuzzleState): boolean { return state.blocks.every(b => b.type === 'obstacle' || b.removed); }
  serializeState(state: PuzzleState): string { return serializeState(state); }
}
export function serializeState(state: PuzzleState): string {
  return JSON.stringify([RULES_VERSION, state.cols, state.rows,
    [...state.exits].map(e => `${e.side}:${e.index}`).sort(),
    state.iceCells.map(p => `${p[0]},${p[1]}`).sort(), state.exitCount,
    [...state.blocks].sort((a,b) => a.blockId < b.blockId ? -1 : a.blockId > b.blockId ? 1 : 0).map(b =>
      [b.blockId,b.type,b.direction ?? '',b.dependsOn ?? '',b.unlockAt,b.size,
       b.removed ? null : b.gridPos])]);
}
export const gameRules = new GameRules();
