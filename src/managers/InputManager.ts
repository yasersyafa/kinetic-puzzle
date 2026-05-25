import Phaser from 'phaser';
import { Block } from '../entities/Block';
import { Direction } from '../types/Game';
import { DRAG_THRESHOLD } from '../config/Constants';
import { AudioManager } from './AudioManager';

export type SwipeAttempt = (block: Block, direction: Direction) => void;

const GHOST_LIMIT = 40;

export class InputManager {
  private dragStart: { x: number; y: number } | null = null;
  private dragBlock: Block | null = null;
  private blocks: Block[] = [];

  constructor(
    private scene: Phaser.Scene,
    private onSwipe: SwipeAttempt,
  ) {
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off('pointerdown', this.onPointerDown, this);
      scene.input.off('pointermove', this.onPointerMove, this);
      scene.input.off('pointerup', this.onPointerUp, this);
    });
  }

  public setBlocks(blocks: Block[]): void {
    this.blocks = blocks;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    for (const b of this.blocks) {
      if (b.removed || b.type === 'obstacle') continue;
      if (b.type === 'dependent' && b.isLocked()) continue;
      if (b.containsPointer(pointer.worldX, pointer.worldY)) {
        this.dragStart = { x: pointer.x, y: pointer.y };
        this.dragBlock = b;
        AudioManager.grab();
        return;
      }
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragStart || !this.dragBlock) return;
    const dx = pointer.x - this.dragStart.x;
    const dy = pointer.y - this.dragStart.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    let gx = 0;
    let gy = 0;
    if (adx > ady) {
      gx = Math.max(-GHOST_LIMIT, Math.min(GHOST_LIMIT, dx));
    } else {
      gy = Math.max(-GHOST_LIMIT, Math.min(GHOST_LIMIT, dy));
    }
    this.dragBlock.setVisualOffset(gx, gy);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.dragStart || !this.dragBlock) {
      this.reset();
      return;
    }
    const block = this.dragBlock;

    const dx = pointer.x - this.dragStart.x;
    const dy = pointer.y - this.dragStart.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    if (Math.max(adx, ady) >= DRAG_THRESHOLD) {
      let dir: Direction;
      if (adx > ady) dir = dx > 0 ? 'RIGHT' : 'LEFT';
      else dir = dy > 0 ? 'DOWN' : 'UP';
      // Smooth offset → 0 in parallel with the swipe tween. No rearward snap.
      block.clearVisualOffsetSmooth(90);
      this.onSwipe(block, dir);
    } else {
      block.clearVisualOffsetSmooth(120);
    }
    this.reset();
  }

  private reset(): void {
    this.dragStart = null;
    this.dragBlock = null;
  }
}
