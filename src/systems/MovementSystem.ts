import { Direction, ExitSide } from '../types/Game';
import { Block } from '../entities/Block';
import { Grid } from '../entities/Grid';

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

export class MovementSystem {
  public slide(block: Block, grid: Grid, dir: Direction, allBlocks: Block[]): SlideResult {
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
    grid: Grid,
    curCol: number, curRow: number,
    skipCol: number, skipRow: number,
    dir: Direction,
    self: Block, allBlocks: Block[],
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

  public constraintsOK(block: Block, dir: Direction): boolean {
    if (block.type !== 'constrained') return true;
    return block.direction === dir;
  }

  public depsCleared(block: Block, allBlocks: Block[]): boolean {
    if (block.type !== 'dependent' || !block.dependsOn) return true;
    const dep = allBlocks.find((b) => b.blockId === block.dependsOn);
    if (!dep) return true;
    return dep.removed;
  }

  public anyValidMove(blocks: Block[], grid: Grid): boolean {
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

  public findAnyExit(blocks: Block[], grid: Grid): { block: Block; dir: Direction } | null {
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

  private outOfGrid(col: number, row: number, grid: Grid): boolean {
    return col < 0 || col >= grid.cols || row < 0 || row >= grid.rows;
  }
}
