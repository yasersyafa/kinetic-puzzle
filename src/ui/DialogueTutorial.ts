import Phaser from 'phaser';
import { TOKENS, FONT_NEO, neoButton } from './Theme';
import { BLOCK_FILLS } from '../config/BlockColors';
import type { Block } from '../entities/Block';
import type { Grid } from '../entities/Grid';
import type { LevelData } from '../types/Game';
import type { Action } from '../core/puzzle/GameRules';
import { TutorialSession, type DialogueStep } from '../core/campaign/TutorialSession';

export const DIALOGUE_VERSION = 'dialogue-1';
export function dialogueSteps(level: LevelData, solution: readonly Action[], body: string): DialogueStep[] {
  if (level.id === 1) return [
    { text: "Hi! I'm Red. We keep sliding until a block, obstacle, or board edge stops us. Everyone shares one exit.", highlightExit: true },
    ...solution.map((action, i) => ({ text: i === 0 ? 'Swipe this red block along the arrow. Watch it leave through our shared exit!' : 'Now send the other red block through the same exit. No move limit here!', action })),
  ];
  if (level.id === 3) {
    const yellowAt = solution.findIndex(a => level.blocks.find(b => b.id === a.blockId)?.type === 'constrained');
    return [
      { text: 'Meet Yellow! Yellow moves only in its arrow direction. Gray obstacles stay put. We can help each other line up the exit.' },
      ...solution.slice(0, yellowAt + 1).map(action => ({ action, text: level.blocks.find(b => b.id === action.blockId)?.type === 'constrained' ? 'The path is ready! Swipe Yellow in its arrow direction.' : 'First, move this red block along the arrow. Positioning and exit order make the difference.' })),
      { text: 'Great teamwork! Finish the puzzle yourself. If an order goes wrong, restart and try another plan.', highlightExit: true },
    ];
  }
  return [{ text: body, highlightExit: true }];
}

/** A dimmed backdrop focuses each step; the dialogue moves clear of the swipe lane. */
export class DialogueTutorial {
  readonly session: TutorialSession;
  private panel?: Phaser.GameObjects.Container;
  private overlay?: Phaser.GameObjects.Container;
  private highlights?: Phaser.GameObjects.Container;
  private timers: Phaser.Time.TimerEvent[] = [];
  private destroyed = false;
  constructor(private scene: Phaser.Scene, steps: readonly DialogueStep[], private blocks: Block[], private grid: Grid, private level: LevelData, private finished: () => void) {
    this.session = new TutorialSession(steps); this.render();
  }
  permits(action: Action): boolean {
    const step = this.session.current;
    return !step || !!step.action && step.action.blockId === action.blockId && step.action.dir === action.dir;
  }
  moved(action: Action): void {
    if (this.session.moved(action)) {
      this.render();
      const actor = this.panel?.getByName('red-speaker') as Phaser.GameObjects.Container | undefined;
      if (actor) { actor.setScale(1.15); this.scene.tweens.add({ targets: actor, scale: 1, duration: 250, ease: 'Back.easeOut' }); }
    }
  }
  skip(): void { this.session.skip(); this.render(); }
  next(): void { if (this.session.next()) this.render(); }
  private clear(): void {
    this.timers.forEach(t => t.remove(false)); this.timers = [];
    const kill = (object: Phaser.GameObjects.GameObject) => {
      this.scene.tweens.killTweensOf(object);
      if (object instanceof Phaser.GameObjects.Container) object.list.forEach(kill);
    };
    for (const object of [this.panel, this.highlights, this.overlay]) if (object) { kill(object); object.destroy(true); }
    this.panel = undefined; this.highlights = undefined; this.overlay = undefined;
  }
  destroy(): void { this.destroyed = true; this.clear(); }
  private stopPointerDown(_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData): void {
    event.stopPropagation();
  }

  private blockCenter(block: Block): { x: number; y: number } {
    // Tutorial steps advance on the move timer, which can run just before the
    // visual tween settles. Use the committed cell rather than its old pixels.
    return {
      x: this.grid.worldX(block.gridPos[0]) + (block.size[0] - 1) * this.grid.cellSize / 2,
      y: this.grid.worldY(block.gridPos[1]) + (block.size[1] - 1) * this.grid.cellSize / 2,
    };
  }

  private focusArea(step: DialogueStep): Phaser.Geom.Rectangle | undefined {
    const { cellSize: size, originX, originY, cols, rows } = this.grid;
    if (step.action) {
      const block = this.blocks.find(b => b.blockId === step.action!.blockId && !b.removed);
      if (!block) return;
      const center = this.blockCenter(block);
      const horizontal = step.action.dir === 'LEFT' || step.action.dir === 'RIGHT';
      return horizontal
        ? new Phaser.Geom.Rectangle(originX - 28, center.y - block.size[1] * size / 2 - 18, cols * size + 56, block.size[1] * size + 36)
        : new Phaser.Geom.Rectangle(center.x - block.size[0] * size / 2 - 18, originY - 28, block.size[0] * size + 36, rows * size + 56);
    }
    if (step.highlightExit) {
      const exit = this.level.exits[0];
      const col = exit.side === 'LEFT' ? 0 : exit.side === 'RIGHT' ? cols - 1 : exit.index;
      const row = exit.side === 'TOP' ? 0 : exit.side === 'BOTTOM' ? rows - 1 : exit.index;
      return new Phaser.Geom.Rectangle(this.grid.worldX(col) - size / 2 - 28, this.grid.worldY(row) - size / 2 - 28, size + 56, size + 56);
    }
  }

  private drawOverlay(focus?: Phaser.Geom.Rectangle): void {
    const { width, height } = this.scene.scale;
    const overlay = this.scene.add.container(0, 0).setDepth(100).setName('tutorial-overlay');
    this.overlay = overlay;
    const shade = (x: number, y: number, w: number, h: number) => {
      if (w <= 0 || h <= 0) return;
      const region = this.scene.add.rectangle(x, y, w, h, 0x000000, 0.68).setOrigin(0).setInteractive();
      // Block new drags behind the shade, but allow a swipe already in progress
      // to finish even when its pointer crosses outside the spotlight.
      region.on('pointerdown', this.stopPointerDown);
      overlay.add(region);
    };
    if (!focus) { shade(0, 0, width, height); return; }
    const left = Phaser.Math.Clamp(focus.left, 0, width), right = Phaser.Math.Clamp(focus.right, 0, width);
    const top = Phaser.Math.Clamp(focus.top, 0, height), bottom = Phaser.Math.Clamp(focus.bottom, 0, height);
    shade(0, 0, width, top); shade(0, bottom, width, height - bottom);
    shade(0, top, left, bottom - top); shade(right, top, width - right, bottom - top);
  }

  private render(): void {
    if (this.destroyed) return;
    this.clear();
    const step = this.session.current;
    if (!step) { this.finished(); this.destroyed = true; return; }
    const { width, height } = this.scene.scale;
    const w = Math.min(760, width - 64);
    const body = this.scene.add.text(-w / 2 + 156, 0, step.text, {
      fontFamily: FONT_NEO, fontSize: '24px', color: TOKENS.inkHex,
      wordWrap: { width: w - 184 }, lineSpacing: 7,
    });
    const h = Math.max(244, body.height + 150);
    body.y = -h / 2 + 64;
    const focus = this.focusArea(step);
    // Prefer the middle for explanations, and top/bottom for practice. Choose a
    // position that leaves the highlighted block's entire swipe lane uncovered.
    const candidates = step.action
      ? [h / 2 + 24, height - h / 2 - 24, height / 2]
      : [height / 2, h / 2 + 24, height - h / 2 - 24];
    const positions = [
      ...candidates.map(y => ({ x: width / 2, y })),
      ...candidates.flatMap(y => [{ x: w / 2 + 24, y }, { x: width - w / 2 - 24, y }]),
    ];
    const { x, y } = positions.find(position => !focus || !Phaser.Geom.Intersects.RectangleToRectangle(
      new Phaser.Geom.Rectangle(position.x - w / 2 - 16, position.y - h / 2 - 16, w + 32, h + 32), focus,
    )) ?? positions[0];
    this.drawOverlay(focus);
    const panel = this.scene.add.container(x, y).setSize(w, h).setDepth(110).setName('dialogue-tutorial'); this.panel = panel;
    panel.setInteractive();
    panel.on('pointerdown', this.stopPointerDown);
    const bg = this.scene.add.graphics();
    bg.fillStyle(TOKENS.ink).fillRoundedRect(-w / 2 + 5, -h / 2 + 5, w, h, 18);
    bg.fillStyle(TOKENS.white).fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.lineStyle(5, TOKENS.ink).strokeRoundedRect(-w / 2, -h / 2, w, h, 18); panel.add(bg);
    const actor = this.scene.add.container(-w / 2 + 78, -24).setName('red-speaker');
    const face = this.scene.add.graphics(); face.fillStyle(BLOCK_FILLS.red).fillRoundedRect(-50, -50, 100, 100, 12); face.lineStyle(5,TOKENS.ink).strokeRoundedRect(-50,-50,100,100,12);
    const eyes = this.scene.add.graphics(); eyes.fillStyle(TOKENS.ink).fillEllipse(-18, -12, 10, 16).fillEllipse(18, -12, 10, 16);
    const mouth = this.scene.add.graphics(); mouth.lineStyle(5,TOKENS.ink).beginPath().arc(0, 10, 17, 0, Math.PI).strokePath();
    actor.add([face, eyes, mouth]); panel.add(actor);
    this.scene.tweens.add({ targets: actor, y: '-=4', duration: 900, yoyo: true, repeat: -1 });
    this.scene.tweens.add({ targets: mouth, scaleY: {from:1,to:0.45}, duration:180, yoyo:true, repeat:9 });
    this.timers.push(this.scene.time.addEvent({ delay: 2200, loop:true, callback: () => this.scene.tweens.add({targets:eyes,scaleY:0.1,duration:90,yoyo:true}) }));
    panel.add(this.scene.add.text(-w / 2 + 156, -h / 2 + 22, 'RED', {fontFamily:FONT_NEO,fontSize:'26px',color:TOKENS.inkHex}));
    panel.add(body);
    panel.add(this.scene.add.text(w / 2 - 24, -h / 2 + 28, `${this.session.index + 1} / ${this.session.steps.length}${step.action ? ' · YOUR TURN' : ''}`, {fontFamily:FONT_NEO,fontSize:'17px',color:TOKENS.inkHex}).setOrigin(1, 0));
    const skip = neoButton(this.scene, -w / 2 + 104, h / 2 - 42, 150, 58, 'SKIP', TOKENS.white, () => this.skip(), {textSize:20});
    skip.container.setName('tutorial-skip').on('pointerdown', this.stopPointerDown); panel.add(skip.container);
    if (!step.action) {
      const next = neoButton(this.scene, w / 2 - 104, h / 2 - 42, 150, 58, 'NEXT', TOKENS.mint, () => this.next(), {textSize:20});
      next.container.setName('tutorial-next').on('pointerdown', this.stopPointerDown); panel.add(next.container);
    }
    const g = this.scene.add.graphics(), highlight = this.scene.add.container(0, 0, [g]).setDepth(105); this.highlights = highlight;
    if (step.action) {
      const block = this.blocks.find(b => b.blockId === step.action!.blockId);
      if (block && !block.removed) {
        const center = this.blockCenter(block);
        const size = this.grid.cellSize; g.lineStyle(6,TOKENS.exitGlow).strokeRoundedRect(center.x-size/2-5,center.y-size/2-5,size+10,size+10,14);
        const dir = step.action.dir, dx = dir === 'RIGHT' ? 70 : dir === 'LEFT' ? -70 : 0, dy = dir === 'DOWN' ? 70 : dir === 'UP' ? -70 : 0;
        g.lineStyle(7,TOKENS.ink).beginPath().moveTo(center.x,center.y).lineTo(center.x+dx,center.y+dy).strokePath();
        g.fillStyle(TOKENS.ink);
        if (dx) g.fillTriangle(center.x+dx,center.y,center.x+dx-Math.sign(dx)*18,center.y-14,center.x+dx-Math.sign(dx)*18,center.y+14);
        else g.fillTriangle(center.x,center.y+dy,center.x-14,center.y+dy-Math.sign(dy)*18,center.x+14,center.y+dy-Math.sign(dy)*18);
      }
    } else if (step.highlightExit) {
      const exit = this.level.exits[0]; const col = exit.side === 'LEFT' ? 0 : exit.side === 'RIGHT' ? this.grid.cols-1 : exit.index;
      const row = exit.side === 'TOP' ? 0 : exit.side === 'BOTTOM' ? this.grid.rows-1 : exit.index;
      g.lineStyle(7,TOKENS.exitGlow).strokeCircle(this.grid.worldX(col),this.grid.worldY(row),this.grid.cellSize/2);
    }
    this.scene.tweens.add({targets:highlight,alpha:0.4,duration:700,yoyo:true,repeat:-1});
  }
}
