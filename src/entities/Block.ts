import Phaser from 'phaser';
import { BlockData, Color, BlockType, ExitSide, Direction } from '../types/Game';
import { TOKENS } from '../ui/Theme';
import { Grid } from './Grid';
import { AudioManager } from '../managers/AudioManager';
import { getEquippedPalette } from '../config/Palettes';

export class Block extends Phaser.GameObjects.Container {
  public readonly blockId: string;
  public readonly color: Color;
  public gridPos: [number, number];
  public readonly size: [number, number];
  public readonly type: BlockType;
  public readonly direction?: Direction;
  public readonly dependsOn?: string;
  public readonly allowedExits: ExitSide[];
  public readonly unlockAt: number;
  public removed = false;

  private bodyG: Phaser.GameObjects.Graphics;
  private iconG?: Phaser.GameObjects.Graphics;
  private countdownText?: Phaser.GameObjects.Text;
  private locked = false;
  private hitW = 0;
  private hitH = 0;
  private hovered = false;
  private bodyW: number;
  private bodyH: number;

  constructor(scene: Phaser.Scene, data: BlockData, grid: Grid) {
    const [c, r] = data.position;
    const [w, h] = data.size;
    const px = grid.worldX(c) + ((w - 1) * grid.cellSize) / 2;
    const py = grid.worldY(r) + ((h - 1) * grid.cellSize) / 2;
    super(scene, px, py);

    this.blockId = data.id;
    this.color = data.color;
    this.gridPos = [c, r];
    this.size = [w, h];
    this.type = data.type ?? 'simple';
    this.direction = data.direction;
    this.dependsOn = data.dependsOn;
    this.allowedExits = data.allowedExits ?? ['TOP', 'BOTTOM', 'LEFT', 'RIGHT'];
    this.unlockAt = data.unlockAt ?? 0;

    const pxW = w * grid.cellSize - 14;
    const pxH = h * grid.cellSize - 14;
    this.bodyW = pxW;
    this.bodyH = pxH;
    const hitW = w * grid.cellSize;
    const hitH = h * grid.cellSize;
    this.hitW = hitW;
    this.hitH = hitH;

    this.bodyG = scene.add.graphics();
    this.add(this.bodyG);
    this.drawBody(this.fillColor());
    this.drawIcon();

    this.setSize(hitW, hitH);
    if (this.type !== 'obstacle') {
      const shadow = TOKENS.shadowOffset;
      // Container.displayOriginX/Y = w/2, h/2 — Phaser shifts hit-test by +displayOrigin,
      // so rect uses (0,0) origin to land centered on the block.
      this.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, hitW + shadow, hitH + shadow),
        Phaser.Geom.Rectangle.Contains,
      );
      if (this.input) {
        this.input.cursor = 'pointer';
      }
    }
    scene.add.existing(this);
  }

  private fillColor(): number {
    const p = getEquippedPalette();
    if (this.type === 'obstacle') return TOKENS.obstacleGray;
    if (this.type === 'constrained') return p.ui.accent;
    if (this.type === 'dependent') return p.ui.secondary;
    return p.colors[this.color];
  }

  public refreshLock(grid: Grid): void {
    if (this.type !== 'lock') return;
    const remaining = Math.max(0, this.unlockAt - grid.getExitCount());
    if (this.countdownText) {
      this.countdownText.setText(`${remaining}`);
      if (remaining === 0) {
        this.countdownText.setAlpha(0);
      }
    }
    if (this.locked && remaining === 0) this.unlock();
  }

  private drawBody(fill: number): void {
    const g = this.bodyG;
    const w = this.bodyW;
    const h = this.bodyH;
    const cornerR = TOKENS.cornerR;
    const shadowOffset = TOKENS.shadowOffset;
    const borderPx = TOKENS.borderPx;

    g.clear();
    g.fillStyle(TOKENS.ink, 1);
    g.fillRoundedRect(-w / 2 + shadowOffset, -h / 2 + shadowOffset, w, h, cornerR);
    g.fillStyle(TOKENS.ink, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, cornerR);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(
      -w / 2 + borderPx,
      -h / 2 + borderPx,
      w - borderPx * 2,
      h - borderPx * 2,
      Math.max(0, cornerR - borderPx / 2),
    );

    if (this.type === 'obstacle') {
      g.lineStyle(4, TOKENS.ink, 0.55);
      const inset = borderPx + 8;
      const minX = -w / 2 + inset;
      const maxX = w / 2 - inset;
      const minY = -h / 2 + inset;
      const maxY = h / 2 - inset;
      const span = Math.max(w, h);
      const step = 18;
      for (let off = -span; off <= span; off += step) {
        const x1 = minX + off;
        const y1 = minY;
        const x2 = x1 + (maxY - minY);
        const y2 = maxY;
        const cx1 = Math.max(minX, Math.min(maxX, x1));
        const cy1 = minY + (cx1 - x1);
        const cx2 = Math.max(minX, Math.min(maxX, x2));
        const cy2 = minY + (cx2 - x1);
        g.beginPath();
        g.moveTo(cx1, cy1);
        g.lineTo(cx2, cy2);
        g.strokePath();
      }
    }

  }

  private drawIcon(): void {
    if (this.iconG) {
      this.iconG.destroy();
      this.iconG = undefined;
    }
    if (this.type === 'simple' || this.type === 'obstacle') return;

    const g = this.scene.add.graphics();
    g.fillStyle(TOKENS.ink, 1);

    if (this.type === 'constrained') {
      const dir = this.direction ?? 'RIGHT';
      const s = Math.min(this.bodyW, this.bodyH) * 0.34;
      this.fillChevron(g, 0, 0, s, dir);
    } else if (this.type === 'dependent') {
      const r = Math.min(this.bodyW, this.bodyH) * 0.14;
      const sep = r * 1.6;
      g.lineStyle(Math.max(3, r * 0.45), TOKENS.ink, 1);
      g.strokeCircle(-sep, 0, r);
      g.strokeCircle(sep, 0, r);
      g.fillStyle(TOKENS.ink, 1);
      g.fillRect(-sep + r * 0.6, -r * 0.32, sep * 2 - r * 1.2, r * 0.6);
    } else if (this.type === 'lock') {
      // padlock: shackle (open arc) + body
      const size = Math.min(this.bodyW, this.bodyH);
      const bw = size * 0.42;
      const bh = size * 0.32;
      const sr = size * 0.18;
      g.lineStyle(Math.max(4, size * 0.05), TOKENS.ink, 1);
      g.beginPath();
      g.arc(0, -bh * 0.3, sr, Math.PI, 0, false);
      g.strokePath();
      g.fillStyle(TOKENS.ink, 1);
      g.fillRoundedRect(-bw / 2, -bh / 2 + sr * 0.4, bw, bh, 6);
      g.fillStyle(0xFFFFFF, 0.9);
      g.fillCircle(0, sr * 0.7, size * 0.05);
      // countdown number badge below padlock body
      const cd = this.scene.add.text(0, size * 0.32, `${this.unlockAt}`, {
        fontFamily: 'Arial Black',
        fontSize: `${Math.floor(size * 0.28)}px`,
        color: '#FFFFFF',
      }).setOrigin(0.5);
      this.add(cd);
      this.countdownText = cd;
    }

    this.add(g);
    this.iconG = g;
    if (this.type === 'dependent') {
      this.locked = true;
      this.setAlpha(0.62);
    } else if (this.type === 'lock' && this.unlockAt > 0) {
      this.locked = true;
      this.setAlpha(0.62);
    }
  }

  private fillChevron(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    size: number,
    direction: Direction,
  ): void {
    const half = size / 2;
    let p1x = 0; let p1y = 0; let p2x = 0; let p2y = 0; let p3x = 0; let p3y = 0;
    if (direction === 'RIGHT') {
      p1x = x - half; p1y = y - half; p2x = x - half; p2y = y + half; p3x = x + half; p3y = y;
    } else if (direction === 'LEFT') {
      p1x = x + half; p1y = y - half; p2x = x + half; p2y = y + half; p3x = x - half; p3y = y;
    } else if (direction === 'UP') {
      p1x = x - half; p1y = y + half; p2x = x + half; p2y = y + half; p3x = x; p3y = y - half;
    } else {
      p1x = x - half; p1y = y - half; p2x = x + half; p2y = y - half; p3x = x; p3y = y + half;
    }
    g.fillTriangle(p1x, p1y, p2x, p2y, p3x, p3y);
  }

  public refreshDependency(allBlocks: Block[]): void {
    if (this.type !== 'dependent' || !this.locked) return;
    if (!this.dependsOn) return;
    const dep = allBlocks.find((b) => b.blockId === this.dependsOn);
    if (!dep || dep.removed) {
      this.unlock();
    }
  }

  public unlock(): void {
    if (!this.locked) return;
    this.locked = false;
    this.scene.tweens.add({
      targets: this,
      alpha: { from: 0.62, to: 1 },
      duration: 220,
      ease: 'Sine.easeOut',
    });
    const flash = this.scene.add.graphics();
    flash.fillStyle(TOKENS.mint, 0.55);
    flash.fillRoundedRect(
      -this.bodyW / 2 + TOKENS.borderPx,
      -this.bodyH / 2 + TOKENS.borderPx,
      this.bodyW - TOKENS.borderPx * 2,
      this.bodyH - TOKENS.borderPx * 2,
      Math.max(0, TOKENS.cornerR - TOKENS.borderPx / 2),
    );
    this.add(flash);
    this.scene.tweens.add({
      targets: flash,
      alpha: { from: 0.55, to: 0 },
      duration: 320,
      onComplete: () => flash.destroy(),
    });
  }

  public setHover(state: boolean): void {
    if (this.removed || this.type === 'obstacle') return;
    if ((this.type === 'dependent' || this.type === 'lock') && this.locked) return;
    if (this.hovered === state) return;
    this.hovered = state;
    if (state) AudioManager.hover();
    this.scene.tweens.add({
      targets: this,
      scale: state ? 1.05 : 1,
      duration: 100,
      ease: 'Sine.easeOut',
    });
  }

  public squash(dir: Direction): void {
    const horiz = dir === 'LEFT' || dir === 'RIGHT';
    this.scene.tweens.chain({
      targets: this,
      tweens: [
        {
          scaleX: horiz ? 1.18 : 0.82,
          scaleY: horiz ? 0.82 : 1.18,
          duration: 60,
          ease: 'Sine.easeOut',
        },
        {
          scaleX: 1,
          scaleY: 1,
          duration: 110,
          ease: 'Back.easeOut',
        },
      ],
    });
  }

  public containsPointer(worldX: number, worldY: number): boolean {
    if (this.removed || this.type === 'obstacle') return false;
    if ((this.type === 'dependent' || this.type === 'lock') && this.locked) return false;
    const localX = worldX - this.x;
    const localY = worldY - this.y;

    const shadow = TOKENS.shadowOffset;
    const hw = this.hitW / 2;
    const hh = this.hitH / 2;

    return localX >= -hw && localX <= hw + shadow && localY >= -hh && localY <= hh + shadow;
  }

  public containsPointerForHint(worldX: number, worldY: number): boolean {
    if (this.removed) return false;
    if (!this.locked) return false;
    if (this.type !== 'dependent' && this.type !== 'lock') return false;
    const localX = worldX - this.x;
    const localY = worldY - this.y;
    const shadow = TOKENS.shadowOffset;
    const hw = this.hitW / 2;
    const hh = this.hitH / 2;
    return localX >= -hw && localX <= hw + shadow && localY >= -hh && localY <= hh + shadow;
  }

  public moveToCell(grid: Grid, col: number, row: number, animate = true, distance = 1): void {
    this.gridPos = [col, row];
    const [w, h] = this.size;
    const tx = grid.worldX(col) + ((w - 1) * grid.cellSize) / 2;
    const ty = grid.worldY(row) + ((h - 1) * grid.cellSize) / 2;
    if (animate) {
      const duration = Math.min(360, 90 + distance * 38);
      this.scene.tweens.add({
        targets: this,
        x: tx,
        y: ty,
        duration,
        ease: 'Cubic.easeOut',
        onComplete: () => this.scene.events.emit('block:settled'),
      });
    } else {
      this.x = tx;
      this.y = ty;
      this.scene.events.emit('block:settled');
    }
  }

  public exitTo(
    grid: Grid,
    lastInCol: number,
    lastInRow: number,
    dir: Direction,
    slideDistance: number,
    onArrival: () => void,
    onDone: () => void,
  ): void {
    this.disableInteractive();
    const [w, h] = this.size;
    const halfCell = grid.cellSize / 2;

    const playExit = (pastMul: number) => {
      onArrival();
      const past = grid.cellSize * pastMul;
      const dx = dir === 'LEFT' ? -past : dir === 'RIGHT' ? past : 0;
      const dy = dir === 'UP' ? -past : dir === 'DOWN' ? past : 0;
      this.scene.tweens.add({
        targets: this,
        x: this.x + dx,
        y: this.y + dy,
        alpha: 0,
        scale: 0.5,
        duration: 220,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          this.removed = true;
          onDone();
          this.destroy();
        },
      });
    };

    if (slideDistance <= 0) {
      // Already adjacent to portal — skip slide phase, exit straight away.
      playExit(0.95);
      return;
    }

    const edgeDx = dir === 'LEFT' ? -halfCell : dir === 'RIGHT' ? halfCell : 0;
    const edgeDy = dir === 'UP' ? -halfCell : dir === 'DOWN' ? halfCell : 0;
    const tx = grid.worldX(lastInCol) + ((w - 1) * grid.cellSize) / 2 + edgeDx;
    const ty = grid.worldY(lastInRow) + ((h - 1) * grid.cellSize) / 2 + edgeDy;
    const slideMs = Math.min(460, 120 + (slideDistance + 0.5) * 42);

    this.scene.tweens.add({
      targets: this,
      x: tx,
      y: ty,
      duration: slideMs,
      ease: 'Sine.easeOut',
      onComplete: () => playExit(0.45),
    });
  }

  public pulseRed(): void {
    this.scene.tweens.add({
      targets: this,
      scale: { from: 1, to: 1.08 },
      duration: 200,
      yoyo: true,
      repeat: 2,
    });
    const flash = this.scene.add.graphics();
    flash.fillStyle(TOKENS.danger, 0.55);
    flash.fillRoundedRect(
      -this.bodyW / 2 + TOKENS.borderPx,
      -this.bodyH / 2 + TOKENS.borderPx,
      this.bodyW - TOKENS.borderPx * 2,
      this.bodyH - TOKENS.borderPx * 2,
      Math.max(0, TOKENS.cornerR - TOKENS.borderPx / 2),
    );
    this.add(flash);
    this.scene.tweens.add({
      targets: flash,
      alpha: { from: 0.55, to: 0 },
      duration: 700,
      onComplete: () => flash.destroy(),
    });
  }

  public isLocked(): boolean {
    return this.locked;
  }

  public setVisualOffset(dx: number, dy: number): void {
    this.bodyG.x = dx;
    this.bodyG.y = dy;
    if (this.iconG) {
      this.iconG.x = dx;
      this.iconG.y = dy;
    }
  }

  public clearVisualOffsetSmooth(duration = 110): void {
    const targets: Phaser.GameObjects.GameObject[] = [this.bodyG];
    if (this.iconG) targets.push(this.iconG);
    this.scene.tweens.add({
      targets,
      x: 0,
      y: 0,
      duration,
      ease: 'Sine.easeOut',
    });
  }
}
