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

/** A side-panel speaker leaves the board and bottom controls fully accessible. */
export class DialogueTutorial {
  readonly session: TutorialSession;
  private panel?: Phaser.GameObjects.Container;
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
    for (const object of [this.panel, this.highlights]) if (object) { kill(object); object.destroy(true); }
    this.panel = undefined; this.highlights = undefined;
  }
  destroy(): void { this.destroyed = true; this.clear(); }
  private render(): void {
    if (this.destroyed) return;
    this.clear();
    const step = this.session.current;
    if (!step) { this.finished(); this.destroyed = true; return; }
    const x = Math.min(280, this.grid.originX / 2), w = Math.min(460, this.grid.originX - 50);
    const panel = this.scene.add.container(x, 440).setDepth(110).setName('dialogue-tutorial'); this.panel = panel;
    const bg = this.scene.add.graphics();
    bg.fillStyle(TOKENS.ink).fillRoundedRect(-w / 2 + 5, -235 + 5, w, 470, 18);
    bg.fillStyle(TOKENS.white).fillRoundedRect(-w / 2, -235, w, 470, 18);
    bg.lineStyle(5, TOKENS.ink).strokeRoundedRect(-w / 2, -235, w, 470, 18); panel.add(bg);
    const actor = this.scene.add.container(-w / 2 + 82, -155).setName('red-speaker');
    const face = this.scene.add.graphics(); face.fillStyle(BLOCK_FILLS.red).fillRoundedRect(-50, -50, 100, 100, 12); face.lineStyle(5,TOKENS.ink).strokeRoundedRect(-50,-50,100,100,12);
    const eyes = this.scene.add.graphics(); eyes.fillStyle(TOKENS.ink).fillEllipse(-18, -12, 10, 16).fillEllipse(18, -12, 10, 16);
    const mouth = this.scene.add.graphics(); mouth.lineStyle(5,TOKENS.ink).beginPath().arc(0, 10, 17, 0, Math.PI).strokePath();
    actor.add([face, eyes, mouth]); panel.add(actor);
    this.scene.tweens.add({ targets: actor, y: '-=4', duration: 900, yoyo: true, repeat: -1 });
    this.scene.tweens.add({ targets: mouth, scaleY: {from:1,to:0.45}, duration:180, yoyo:true, repeat:9 });
    this.timers.push(this.scene.time.addEvent({ delay: 2200, loop:true, callback: () => this.scene.tweens.add({targets:eyes,scaleY:0.1,duration:90,yoyo:true}) }));
    panel.add(this.scene.add.text(-w / 2 + 150, -170, 'RED', {fontFamily:FONT_NEO,fontSize:'30px',color:TOKENS.inkHex}));
    panel.add(this.scene.add.text(-w / 2 + 150, -128, 'YOUR PUZZLE PAL', {fontFamily:FONT_NEO,fontSize:'17px',color:TOKENS.inkHex}));
    panel.add(this.scene.add.text(-w / 2 + 24, -60, step.text, {fontFamily:FONT_NEO,fontSize:'24px',color:TOKENS.inkHex,wordWrap:{width:w-48},lineSpacing:7}));
    panel.add(this.scene.add.text(0, 138, `${this.session.index + 1} / ${this.session.steps.length}${step.action ? ' · YOUR TURN' : ''}`, {fontFamily:FONT_NEO,fontSize:'17px',color:TOKENS.inkHex}).setOrigin(0.5));
    const skip = neoButton(this.scene, -w / 4, 193, w / 2 - 30, 58, 'SKIP', TOKENS.white, () => this.skip(), {textSize:20}); panel.add(skip.container);
    if (!step.action) { const next = neoButton(this.scene, w / 4, 193, w / 2 - 30, 58, 'NEXT', TOKENS.mint, () => this.next(), {textSize:20}); panel.add(next.container); }
    const g = this.scene.add.graphics(), highlight = this.scene.add.container(0, 0, [g]).setDepth(60); this.highlights = highlight;
    if (step.action) {
      const block = this.blocks.find(b => b.blockId === step.action!.blockId);
      if (block && !block.removed) {
        const size = this.grid.cellSize; g.lineStyle(6,TOKENS.exitGlow).strokeRoundedRect(block.x-size/2-5,block.y-size/2-5,size+10,size+10,14);
        const dir = step.action.dir, dx = dir === 'RIGHT' ? 70 : dir === 'LEFT' ? -70 : 0, dy = dir === 'DOWN' ? 70 : dir === 'UP' ? -70 : 0;
        g.lineStyle(7,TOKENS.ink).beginPath().moveTo(block.x,block.y).lineTo(block.x+dx,block.y+dy).strokePath();
        g.fillStyle(TOKENS.ink);
        if (dx) g.fillTriangle(block.x+dx,block.y,block.x+dx-Math.sign(dx)*18,block.y-14,block.x+dx-Math.sign(dx)*18,block.y+14);
        else g.fillTriangle(block.x,block.y+dy,block.x-14,block.y+dy-Math.sign(dy)*18,block.x+14,block.y+dy-Math.sign(dy)*18);
      }
    } else if (step.highlightExit) {
      const exit = this.level.exits[0]; const col = exit.side === 'LEFT' ? 0 : exit.side === 'RIGHT' ? this.grid.cols-1 : exit.index;
      const row = exit.side === 'TOP' ? 0 : exit.side === 'BOTTOM' ? this.grid.rows-1 : exit.index;
      g.lineStyle(7,TOKENS.exitGlow).strokeCircle(this.grid.worldX(col),this.grid.worldY(row),this.grid.cellSize/2);
    }
    this.scene.tweens.add({targets:highlight,alpha:0.4,duration:700,yoyo:true,repeat:-1});
  }
}
