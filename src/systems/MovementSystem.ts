import type { Direction } from '../types/Game';
import type { Block } from '../entities/Block';
import type { Grid } from '../entities/Grid';
import { SlideRules } from '../core/puzzle/GameRules';
export type { SlideResult } from '../core/puzzle/GameRules';

// Phaser entities satisfy the pure rules ports. Animation and Undo remain in GameScene.
export class MovementSystem extends SlideRules {
  override anyValidMove(blocks: Block[], grid: Grid): boolean {
    return super.anyValidMove(blocks, grid);
  }
  override findAnyExit(blocks: Block[], grid: Grid): { block: Block; dir: Direction } | null {
    return super.findAnyExit(blocks, grid) as { block: Block; dir: Direction } | null;
  }
}
