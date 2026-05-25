import Phaser from 'phaser';
import { TOKENS, FONT_NEO } from './Theme';
import { Direction } from '../types/Game';
import { Block } from '../entities/Block';
import { Grid } from '../entities/Grid';

export interface TutorialTapStage {
  title: string;
  message: string;
  blockId: string; // locked block to tap
}

export interface TutorialFollowUp {
  title: string;
  message: string;
  highlightBlockId?: string;
  durationMs?: number; // auto-fade after this; 0 = stay until tap
}

export interface LevelTutorialConfig {
  // Optional first stage: ask player to TAP a locked block. Dismissed on tutorial:inspected.
  tapFirst?: TutorialTapStage;
  // Main (swipe) stage. Shown initially, or after tapFirst dismissed.
  title: string;
  message: string;
  highlightBlockId?: string;
  hintDir?: Direction;
  iceHighlight?: boolean;
  followUp?: TutorialFollowUp;
}

export class LevelTutorial {
  private scene: Phaser.Scene;
  private bubble?: Phaser.GameObjects.Container;
  private highlightContainer?: Phaser.GameObjects.Container;
  private arrowContainer?: Phaser.GameObjects.Container;
  private iceHighlightContainer?: Phaser.GameObjects.Graphics;
  private followUpBubble?: Phaser.GameObjects.Container;
  private followUpHighlight?: Phaser.GameObjects.Container;
  private followUpTimer?: Phaser.Time.TimerEvent;
  private cfg?: LevelTutorialConfig;
  private dismissed = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(cfg: LevelTutorialConfig, blocks: Block[], grid: Grid): void {
    this.cfg = cfg;
    if (cfg.tapFirst) {
      this.showTapStage(cfg.tapFirst, blocks, grid);
    } else {
      this.showMainStage(cfg, blocks, grid);
    }
  }

  // Stage 1: ask player to TAP locked block. Caller invokes advanceAfterTap on
  // tutorial:inspected event.
  private showTapStage(stage: TutorialTapStage, blocks: Block[], grid: Grid): void {
    this.drawBubble(stage.title, stage.message);
    const block = blocks.find((b) => b.blockId === stage.blockId);
    if (block) this.drawHighlight(block, grid, 0x55B4FF); // blue ring = inspect target
  }

  // Stage 2: swipe direction with arrow.
  private showMainStage(cfg: LevelTutorialConfig, blocks: Block[], grid: Grid): void {
    this.drawBubble(cfg.title, cfg.message);
    if (cfg.highlightBlockId) {
      const block = blocks.find((b) => b.blockId === cfg.highlightBlockId);
      if (block) {
        this.drawHighlight(block, grid);
        if (cfg.hintDir) this.drawGhostArrow(block, cfg.hintDir);
      }
    }
    if (cfg.iceHighlight) this.drawIceHighlight(grid);
  }

  // Called when player taps locked block during tap-first stage.
  // Transitions to main swipe stage.
  advanceAfterTap(blocks: Block[], grid: Grid): void {
    if (!this.cfg || !this.cfg.tapFirst || this.dismissed) return;
    // Fade out tap-stage overlays then show main stage
    const targets: Phaser.GameObjects.GameObject[] = [];
    if (this.bubble) targets.push(this.bubble);
    if (this.highlightContainer) targets.push(this.highlightContainer);
    if (targets.length > 0) {
      this.scene.tweens.add({
        targets, alpha: 0, duration: 220, ease: 'Sine.easeOut',
        onComplete: () => targets.forEach((t) => t.destroy()),
      });
    }
    this.bubble = undefined;
    this.highlightContainer = undefined;
    // Clear tapFirst so dismiss() doesn't try to re-show
    const mainCfg = { ...this.cfg, tapFirst: undefined };
    this.cfg = mainCfg;
    this.scene.time.delayedCall(280, () => this.showMainStage(mainCfg, blocks, grid));
  }

  isAwaitingTap(): boolean {
    return !!this.cfg?.tapFirst && !this.dismissed;
  }

  dismiss(blocks?: Block[], grid?: Grid): void {
    if (this.dismissed) return;
    this.dismissed = true;
    const primary: Phaser.GameObjects.GameObject[] = [];
    if (this.bubble) primary.push(this.bubble);
    if (this.highlightContainer) primary.push(this.highlightContainer);
    if (this.arrowContainer) primary.push(this.arrowContainer);
    if (this.iceHighlightContainer) primary.push(this.iceHighlightContainer);
    if (primary.length > 0) {
      this.scene.tweens.add({
        targets: primary,
        alpha: 0,
        duration: 220,
        ease: 'Sine.easeOut',
        onComplete: () => primary.forEach((c) => c.destroy()),
      });
    }
    this.bubble = undefined;
    this.highlightContainer = undefined;
    this.arrowContainer = undefined;
    this.iceHighlightContainer = undefined;

    // Show follow-up after primary dismiss
    if (this.cfg?.followUp && blocks && grid) {
      this.scene.time.delayedCall(280, () => this.drawFollowUp(this.cfg!.followUp!, blocks, grid));
    }
  }

  destroy(): void {
    this.bubble?.destroy();
    this.highlightContainer?.destroy();
    this.arrowContainer?.destroy();
    this.iceHighlightContainer?.destroy();
    this.followUpBubble?.destroy();
    this.followUpHighlight?.destroy();
    this.followUpTimer?.remove(false);
    this.bubble = undefined;
    this.highlightContainer = undefined;
    this.arrowContainer = undefined;
    this.iceHighlightContainer = undefined;
    this.followUpBubble = undefined;
    this.followUpHighlight = undefined;
    this.followUpTimer = undefined;
    this.dismissed = true;
  }

  private drawIceHighlight(grid: Grid): void {
    const g = this.scene.add.graphics();
    g.lineStyle(4, 0x4A90D9, 0.9);
    for (let c = 0; c < grid.cols; c++) {
      for (let r = 0; r < grid.rows; r++) {
        if (!grid.hasIce(c, r)) continue;
        const x = grid.worldX(c);
        const y = grid.worldY(r);
        const s = grid.cellSize - 12;
        g.strokeRoundedRect(x - s / 2, y - s / 2, s, s, 8);
      }
    }
    g.setDepth(45);
    this.scene.tweens.add({
      targets: g,
      alpha: { from: 1, to: 0.4 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.iceHighlightContainer = g;
  }

  private drawFollowUp(fu: TutorialFollowUp, blocks: Block[], grid: Grid): void {
    const w = 920;
    const h = 110;
    const g = this.scene.add.graphics();
    g.fillStyle(TOKENS.ink, 1);
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w, h, TOKENS.cornerR);
    g.fillStyle(TOKENS.ink, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, TOKENS.cornerR);
    g.fillStyle(TOKENS.white, 1);
    g.fillRoundedRect(-w / 2 + TOKENS.borderPx, -h / 2 + TOKENS.borderPx, w - TOKENS.borderPx * 2, h - TOKENS.borderPx * 2, TOKENS.cornerR - 2);

    const titleTxt = this.scene.add
      .text(0, -20, fu.title, { fontFamily: FONT_NEO, fontSize: '20px', color: TOKENS.inkHex })
      .setOrigin(0.5);
    const bodyTxt = this.scene.add
      .text(0, 12, fu.message, {
        fontFamily: FONT_NEO, fontSize: '18px', color: TOKENS.inkHex,
        align: 'center', wordWrap: { width: w - 48 },
      })
      .setOrigin(0.5)
      .setAlpha(0.85);

    const c = this.scene.add.container(this.scene.scale.width / 2, this.scene.scale.height - 180, [g, titleTxt, bodyTxt]);
    c.setDepth(110);
    c.setAlpha(0);
    this.scene.tweens.add({ targets: c, alpha: 1, duration: 260, ease: 'Sine.easeOut' });
    this.followUpBubble = c;

    if (fu.highlightBlockId) {
      const block = blocks.find((b) => b.blockId === fu.highlightBlockId);
      if (block) {
        const hg = this.scene.add.graphics();
        hg.lineStyle(6, 0x55B4FF, 1);
        const halfW = block.size[0] * (grid.cellSize / 2);
        const halfH = block.size[1] * (grid.cellSize / 2);
        hg.strokeRoundedRect(-halfW - 6, -halfH - 6, halfW * 2 + 12, halfH * 2 + 12, 14);
        const hc = this.scene.add.container(block.x, block.y, [hg]);
        hc.setDepth(50);
        this.scene.tweens.add({
          targets: hc,
          scale: { from: 1, to: 1.12 },
          alpha: { from: 1, to: 0.5 },
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        this.followUpHighlight = hc;
      }
    }

    const duration = fu.durationMs ?? 6000;
    if (duration > 0) {
      this.followUpTimer = this.scene.time.delayedCall(duration, () => this.dismissFollowUp());
    }
  }

  dismissFollowUp(): void {
    const targets: Phaser.GameObjects.GameObject[] = [];
    if (this.followUpBubble) targets.push(this.followUpBubble);
    if (this.followUpHighlight) targets.push(this.followUpHighlight);
    if (targets.length === 0) return;
    this.scene.tweens.add({
      targets,
      alpha: 0,
      duration: 240,
      ease: 'Sine.easeOut',
      onComplete: () => targets.forEach((t) => t.destroy()),
    });
    this.followUpBubble = undefined;
    this.followUpHighlight = undefined;
    this.followUpTimer?.remove(false);
    this.followUpTimer = undefined;
  }

  private drawBubble(title: string, message: string): void {
    const w = 1040;
    const h = 138;
    const g = this.scene.add.graphics();
    const cornerR = TOKENS.cornerR;
    const shadow = TOKENS.shadowOffset;
    const border = TOKENS.borderPx;
    g.fillStyle(TOKENS.ink, 1);
    g.fillRoundedRect(-w / 2 + shadow, -h / 2 + shadow, w, h, cornerR);
    g.fillStyle(TOKENS.ink, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, cornerR);
    g.fillStyle(TOKENS.white, 1);
    g.fillRoundedRect(-w / 2 + border, -h / 2 + border, w - border * 2, h - border * 2, cornerR - 2);

    const titleTxt = this.scene.add
      .text(0, -22, title, {
        fontFamily: FONT_NEO,
        fontSize: '24px',
        color: TOKENS.inkHex,
      })
      .setOrigin(0.5);

    const bodyTxt = this.scene.add
      .text(0, 14, message, {
        fontFamily: FONT_NEO,
        fontSize: '20px',
        color: TOKENS.inkHex,
        align: 'center',
        wordWrap: { width: w - 64 },
      })
      .setOrigin(0.5)
      .setAlpha(0.85);

    const c = this.scene.add.container(this.scene.scale.width / 2, 200, [g, titleTxt, bodyTxt]);
    c.setDepth(110);
    c.setAlpha(0);
    this.scene.tweens.add({
      targets: c,
      alpha: 1,
      y: 200,
      duration: 260,
      ease: 'Sine.easeOut',
    });
    this.bubble = c;
  }

  private drawHighlight(block: Block, grid: Grid, color: number = TOKENS.exitGlow): void {
    const g = this.scene.add.graphics();
    g.lineStyle(8, color, 1);
    const halfW = block.size[0] * (grid.cellSize / 2);
    const halfH = block.size[1] * (grid.cellSize / 2);
    g.strokeRoundedRect(-halfW - 6, -halfH - 6, halfW * 2 + 12, halfH * 2 + 12, 14);
    const c = this.scene.add.container(block.x, block.y, [g]);
    c.setDepth(50);
    this.scene.tweens.add({
      targets: c,
      scale: { from: 1, to: 1.1 },
      alpha: { from: 1, to: 0.4 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.highlightContainer = c;
  }

  private drawGhostArrow(block: Block, dir: Direction): void {
    const len = 108;
    const dx = dir === 'RIGHT' ? len : dir === 'LEFT' ? -len : 0;
    const dy = dir === 'DOWN' ? len : dir === 'UP' ? -len : 0;
    const sx = block.x;
    const sy = block.y;
    const ex = sx + dx;
    const ey = sy + dy;

    const g = this.scene.add.graphics();
    g.lineStyle(10, TOKENS.ink, 1);
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(ex, ey);
    g.strokePath();

    g.fillStyle(TOKENS.yellow, 1);
    g.lineStyle(6, TOKENS.ink, 1);
    const headLen = 28;
    let p1x = 0, p1y = 0, p2x = 0, p2y = 0, p3x = 0, p3y = 0;
    if (dir === 'RIGHT') {
      p1x = ex; p1y = ey - 18; p2x = ex; p2y = ey + 18; p3x = ex + headLen; p3y = ey;
    } else if (dir === 'LEFT') {
      p1x = ex; p1y = ey - 18; p2x = ex; p2y = ey + 18; p3x = ex - headLen; p3y = ey;
    } else if (dir === 'UP') {
      p1x = ex - 18; p1y = ey; p2x = ex + 18; p2y = ey; p3x = ex; p3y = ey - headLen;
    } else {
      p1x = ex - 18; p1y = ey; p2x = ex + 18; p2y = ey; p3x = ex; p3y = ey + headLen;
    }
    g.fillTriangle(p1x, p1y, p2x, p2y, p3x, p3y);
    g.beginPath();
    g.moveTo(p1x, p1y);
    g.lineTo(p3x, p3y);
    g.lineTo(p2x, p2y);
    g.strokePath();

    const c = this.scene.add.container(0, 0, [g]);
    c.setDepth(60);
    this.scene.tweens.add({
      targets: c,
      alpha: { from: 0.3, to: 1 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.arrowContainer = c;
  }
}

export const LEVEL_TUTORIALS: Record<number, LevelTutorialConfig> = {
  1: {
    title: 'SLIDE',
    message: 'SWIPE THE BLOCK TOWARD THE GLOWING EXIT.',
    highlightBlockId: 'm1',
    hintDir: 'RIGHT',
  },
  3: {
    title: 'CONSTRAINED',
    message: 'YELLOW BLOCKS ONLY EXIT IN THE ARROW DIRECTION. SWIPE THAT WAY.',
    highlightBlockId: 'm1',
    hintDir: 'LEFT',
  },
  5: {
    tapFirst: {
      title: 'INSPECT',
      message: 'TAP THE LOCKED BLUE BLOCK TO SEE WHICH BLOCK BLOCKS IT.',
      blockId: 'm3',
    },
    title: 'SLIDE',
    message: 'NOW SLIDE THE RED BLOCK OUT TO UNLOCK THE BLUE.',
    highlightBlockId: 'm1',
    hintDir: 'RIGHT',
  },
  73: {
    title: 'ICE',
    message: 'BLOCKS CANNOT STOP ON ICE. IF YOUR SLIDE WOULD END HERE, ICE PUSHES YOU PAST THE BLOCKER.',
    highlightBlockId: 'm1',
    hintDir: 'RIGHT',
    iceHighlight: true,
  },
  76: {
    title: 'LOCK',
    message: 'PADLOCK BLOCKS WAIT. THE NUMBER COUNTS DOWN AS OTHER BLOCKS EXIT — ONLY THEN CAN IT MOVE.',
    highlightBlockId: 'm1',
    hintDir: 'RIGHT',
  },
};
