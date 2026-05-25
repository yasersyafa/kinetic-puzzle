import Phaser from 'phaser';
import { CELL_SIZE, HUD_HEIGHT } from '../config/Constants';
import { Block } from './Block';
import { ExitZone } from '../types/Game';
import { TOKENS } from '../ui/Theme';

export class Grid {
  public readonly cols: number;
  public readonly rows: number;
  public readonly originX: number;
  public readonly originY: number;
  public readonly cellSize: number;

  private occupancy: (Block | null)[][];
  private exits: ExitZone[] = [];
  private iceCells: Set<number> = new Set();
  private exitCount: number = 0;
  private iceGraphics?: Phaser.GameObjects.Graphics;
  private createdObjects: Phaser.GameObjects.GameObject[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];

  constructor(
    scene: Phaser.Scene,
    cols: number,
    rows: number,
    exits: ExitZone[] = [],
    sizingDim?: { cols: number; rows: number },
    iceCells: [number, number][] = [],
  ) {
    this.cols = cols;
    this.rows = rows;
    this.exits = exits;

    // For sizing, use sizingDim (worst-case grid) if provided so cellSize is consistent
    // across all levels. Falls back to actual cols/rows.
    const sCols = sizingDim?.cols ?? cols;
    const sRows = sizingDim?.rows ?? rows;
    const screenW = scene.scale.width;
    const screenH = scene.scale.height;
    const maxByW = (screenW - 120) / sCols;
    // Reserved vertical: HUD top (HUD_HEIGHT) + bottom UI band (150). Bottom HUD buttons
    // moved closer to the screen edge to free vertical room for bigger cells.
    const maxByH = (screenH - HUD_HEIGHT - 150) / sRows;
    this.cellSize = Math.min(CELL_SIZE, maxByW, maxByH);

    const boardW = this.cellSize * cols;
    const boardH = this.cellSize * rows;
    this.originX = (screenW - boardW) / 2;
    this.originY = HUD_HEIGHT + 50 + (screenH - HUD_HEIGHT - 50 - 150 - boardH) / 2;

    this.occupancy = Array.from({ length: rows }, () => Array(cols).fill(null));
    for (const [c, r] of iceCells) {
      this.iceCells.add(r * cols + c);
    }
    this.drawBoard(scene);
    this.drawIce(scene);
    this.drawExits(scene);
  }

  private drawIce(scene: Phaser.Scene): void {
    if (this.iceCells.size === 0) return;
    const g = scene.add.graphics();
    this.createdObjects.push(g);
    this.iceGraphics = g;
    for (const key of this.iceCells) {
      const c = key % this.cols;
      const r = Math.floor(key / this.cols);
      const x = this.originX + c * this.cellSize + 4;
      const y = this.originY + r * this.cellSize + 4;
      const s = this.cellSize - 8;
      g.fillStyle(0xBFE4FF, 0.55);
      g.fillRoundedRect(x, y, s, s, 8);
      g.lineStyle(2, 0x4A90D9, 0.6);
      g.strokeRoundedRect(x, y, s, s, 8);
      // diagonal frost lines
      g.lineStyle(2, 0x4A90D9, 0.35);
      g.beginPath();
      g.moveTo(x + 8, y + s - 8);
      g.lineTo(x + s - 8, y + 8);
      g.moveTo(x + s / 2, y + 6);
      g.lineTo(x + s / 2, y + s - 6);
      g.strokePath();
    }
  }

  public hasIce(col: number, row: number): boolean {
    return this.iceCells.has(row * this.cols + col);
  }

  public registerExit(): void {
    this.exitCount++;
  }

  public getExitCount(): number {
    return this.exitCount;
  }

  private drawBoard(scene: Phaser.Scene): void {
    const w = this.cellSize * this.cols;
    const h = this.cellSize * this.rows;
    const pad = 24;
    const bx = this.originX - pad;
    const by = this.originY - pad;
    const bw = w + pad * 2;
    const bh = h + pad * 2;
    const cornerR = 25;
    const shadowOffset = 6;
    const borderPx = 6;

    const g = scene.add.graphics();
    this.createdObjects.push(g);
    g.fillStyle(TOKENS.ink, 1);
    g.fillRoundedRect(bx + shadowOffset, by + shadowOffset, bw, bh, cornerR);
    g.fillStyle(TOKENS.ink, 1);
    g.fillRoundedRect(bx, by, bw, bh, cornerR);
    g.fillStyle(TOKENS.white, 1);
    g.fillRoundedRect(bx + borderPx, by + borderPx, bw - borderPx * 2, bh - borderPx * 2, cornerR - 2);

    const lines = scene.add.graphics();
    this.createdObjects.push(lines);
    lines.lineStyle(2, TOKENS.ink, 0.18);
    for (let r = 1; r < this.rows; r++) {
      const y = this.originY + r * this.cellSize;
      lines.beginPath();
      lines.moveTo(this.originX, y);
      lines.lineTo(this.originX + w, y);
      lines.strokePath();
    }
    for (let c = 1; c < this.cols; c++) {
      const x = this.originX + c * this.cellSize;
      lines.beginPath();
      lines.moveTo(x, this.originY);
      lines.lineTo(x, this.originY + h);
      lines.strokePath();
    }
  }

  private drawExits(scene: Phaser.Scene): void {
    const thickness = 26;
    const inset = 12;
    for (const e of this.exits) {
      const exitCenter = this.exitCenter(e);
      const isHoriz = e.side === 'LEFT' || e.side === 'RIGHT';
      const len = this.cellSize - inset * 2;

      const portal = scene.add.graphics();
      this.createdObjects.push(portal);
      portal.fillStyle(TOKENS.ink, 1);
      if (e.side === 'TOP') {
        portal.fillRoundedRect(
          exitCenter.x - len / 2,
          this.originY - thickness - 2,
          len,
          thickness,
          4,
        );
        portal.fillStyle(TOKENS.exitGlow, 1);
        portal.fillRoundedRect(
          exitCenter.x - len / 2 + 6,
          this.originY - thickness + 4,
          len - 12,
          thickness - 10,
          3,
        );
      } else if (e.side === 'BOTTOM') {
        portal.fillRoundedRect(
          exitCenter.x - len / 2,
          this.originY + this.rows * this.cellSize + 2,
          len,
          thickness,
          4,
        );
        portal.fillStyle(TOKENS.exitGlow, 1);
        portal.fillRoundedRect(
          exitCenter.x - len / 2 + 6,
          this.originY + this.rows * this.cellSize + 8,
          len - 12,
          thickness - 12,
          3,
        );
      } else if (e.side === 'LEFT') {
        portal.fillRoundedRect(
          this.originX - thickness - 2,
          exitCenter.y - len / 2,
          thickness,
          len,
          4,
        );
        portal.fillStyle(TOKENS.exitGlow, 1);
        portal.fillRoundedRect(
          this.originX - thickness + 4,
          exitCenter.y - len / 2 + 6,
          thickness - 10,
          len - 12,
          3,
        );
      } else {
        portal.fillRoundedRect(
          this.originX + this.cols * this.cellSize + 2,
          exitCenter.y - len / 2,
          thickness,
          len,
          4,
        );
        portal.fillStyle(TOKENS.exitGlow, 1);
        portal.fillRoundedRect(
          this.originX + this.cols * this.cellSize + 8,
          exitCenter.y - len / 2 + 6,
          thickness - 12,
          len - 12,
          3,
        );
      }

      scene.tweens.add({
        targets: portal,
        alpha: { from: 1, to: 0.6 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      this.spawnExitParticles(scene, e, exitCenter, isHoriz);
    }
  }

  private exitCenter(e: ExitZone): { x: number; y: number } {
    if (e.side === 'TOP') {
      return {
        x: this.originX + e.index * this.cellSize + this.cellSize / 2,
        y: this.originY - 6,
      };
    }
    if (e.side === 'BOTTOM') {
      return {
        x: this.originX + e.index * this.cellSize + this.cellSize / 2,
        y: this.originY + this.rows * this.cellSize + 6,
      };
    }
    if (e.side === 'LEFT') {
      return {
        x: this.originX - 6,
        y: this.originY + e.index * this.cellSize + this.cellSize / 2,
      };
    }
    return {
      x: this.originX + this.cols * this.cellSize + 6,
      y: this.originY + e.index * this.cellSize + this.cellSize / 2,
    };
  }

  private spawnExitParticles(
    scene: Phaser.Scene,
    e: ExitZone,
    center: { x: number; y: number },
    isHoriz: boolean,
  ): void {
    const outward: { dx: number; dy: number } =
      e.side === 'TOP'
        ? { dx: 0, dy: -1 }
        : e.side === 'BOTTOM'
        ? { dx: 0, dy: 1 }
        : e.side === 'LEFT'
        ? { dx: -1, dy: 0 }
        : { dx: 1, dy: 0 };

    const emit = () => {
      for (let i = 0; i < 2; i++) {
        const jitter = (Math.random() - 0.5) * (this.cellSize * 0.6);
        const sx = center.x + (isHoriz ? 0 : jitter);
        const sy = center.y + (isHoriz ? jitter : 0);
        const size = 3 + Math.random() * 3;
        const color = Math.random() < 0.5 ? TOKENS.exitGlow : TOKENS.exitGlowAccent;
        const p = scene.add.rectangle(sx, sy, size, size, color);
        p.setStrokeStyle(1.2, TOKENS.ink, 1);
        const dist = 10 + Math.random() * 18;
        scene.tweens.add({
          targets: p,
          x: sx + outward.dx * dist,
          y: sy + outward.dy * dist,
          alpha: { from: 1, to: 0 },
          scale: { from: 1, to: 0.4 },
          duration: 600 + Math.random() * 300,
          ease: 'Cubic.easeOut',
          onComplete: () => p.destroy(),
        });
      }
    };

    const timer = scene.time.addEvent({
      delay: 380,
      loop: true,
      callback: emit,
    });
    this.timers.push(timer);
    emit();
  }

  public destroy(): void {
    this.timers.forEach((t) => t.remove(false));
    this.timers = [];
    this.createdObjects.forEach((o) => o.destroy());
    this.createdObjects = [];
  }

  public worldX(col: number): number {
    return this.originX + col * this.cellSize + this.cellSize / 2;
  }

  public worldY(row: number): number {
    return this.originY + row * this.cellSize + this.cellSize / 2;
  }

  public place(block: Block): void {
    const [x, y] = block.gridPos;
    const [w, h] = block.size;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.occupancy[y + dy][x + dx] = block;
      }
    }
  }

  public clear(block: Block): void {
    const [x, y] = block.gridPos;
    const [w, h] = block.size;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.occupancy[y + dy][x + dx] = null;
      }
    }
  }

  public getOccupant(col: number, row: number): Block | null {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
    return this.occupancy[row][col];
  }

  public isEmpty(col: number, row: number): boolean {
    return this.getOccupant(col, row) === null;
  }

  public hasExit(side: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT', index: number): boolean {
    return this.exits.some((e) => e.side === side && e.index === index);
  }
}
