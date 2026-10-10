import { playerTelemetry } from '../systems/PlayerTelemetry';
import { IS_GENERATED_CAMPAIGN, GENERATED_TUTORIALS, STAGES, getMoveLimit, getStage } from '../config/Levels';
import Phaser from "phaser";
import { SCENE_KEYS, COLORS } from "../config/Constants";
import { useGameStore } from "../managers/GameStateManager";
import {
  getLevel,
  getSolution,
  MAX_LEVEL_COLS,
  MAX_LEVEL_ROWS,
  SolutionMove,
} from "../config/Levels";
import { Grid } from "../entities/Grid";
import { Block } from "../entities/Block";
import { InputManager } from "../managers/InputManager";
import { MovementSystem } from "../systems/MovementSystem";
import { Direction } from "../types/Game";
import { AudioManager } from "../managers/AudioManager";
import { Analytics } from "../managers/AnalyticsManager";
import { SDKManager } from "../managers/SDKManager";
import { AdManager } from "../managers/AdManager";
import {
  burstParticles,
  fadeIn,
  fadeOutAndStart,
  screenshake,
  dustPuff,
  removalBloom,
  deadEndPulse,
  portalSuck,
} from "../utils/Effects";
import {
  TOKENS,
  FONT_NEO,
  neoButton,
  neoPill,
  dottedBackground,
  NeoButtonHandle,
} from "../ui/Theme";
import { LevelTutorial, LEVEL_TUTORIALS } from "../ui/LevelTutorial";
import { paletteUI } from "../config/Palettes";

import { DialogueTutorial, dialogueSteps, DIALOGUE_VERSION } from '../ui/DialogueTutorial';
import { resolveAttempt, type AttemptResult } from '../core/campaign/Stage';
import { findHint, hintFromSolution } from '../core/puzzle/HintSearch';
import { createState, type PuzzleState } from '../core/puzzle/GameRules';

export class GameScene extends Phaser.Scene {
  private grid!: Grid;
  private blocks: Block[] = [];
  private input2!: InputManager;
  private movement!: MovementSystem;

  private movesText!: Phaser.GameObjects.Text;
  private hintBtn!: NeoButtonHandle;
  private restartBtn!: NeoButtonHandle;

  private hovered: Block | null = null;
  private busy = false;
  private watchPlaying = false;
  private autoplayActive = false;
  private autoplayToken = 0;
  private lastRemovalAt = 0;
  private comboCount = 0;
  private prevLocked = new Map<string, boolean>();
  private tutorial?: LevelTutorial;
  private dialogue?: DialogueTutorial;
  private moveBudget?: number;
  private ended = false;
  private attemptIsAutoplay = false;
  private hintSearching = false;
  private hintMessage?: Phaser.GameObjects.Text;
  private hintRing?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: SCENE_KEYS.Game });
  }

  async create(): Promise<void> {
    fadeIn(this);
    const store = useGameStore.getState();
    store.resetMoves();
    this.busy = false;
    this.ended = false;
    this.hintSearching = false;
    this.hintMessage = undefined;
    this.hintRing = undefined;
    this.attemptIsAutoplay = !!this.registry.get("autoplaySolution");
    this.moveBudget = getMoveLimit(store.currentLevel);
    this.watchPlaying = false;
    this.autoplayActive = false;
    this.comboCount = 0;
    this.lastRemovalAt = 0;
    const creationToken = ++this.autoplayToken;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.autoplayToken++; });
    Analytics.log("level_started", { level: store.currentLevel });

    await AdManager.preLevelInterstitial();
    if (creationToken !== this.autoplayToken || !this.scene.isActive()) return;
    SDKManager.gameplayStart();
    playerTelemetry.setPaused(false);
    const pauseTelemetry=()=>playerTelemetry.setPaused(true);
    const resumeTelemetry=()=>playerTelemetry.setPaused(false);
    this.events.on(Phaser.Scenes.Events.PAUSE,pauseTelemetry);
    this.events.on(Phaser.Scenes.Events.RESUME,resumeTelemetry);
    playerTelemetry.start(store.currentLevel, !!this.registry.get("autoplaySolution"));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
      playerTelemetry.finish(false);
      this.events.off(Phaser.Scenes.Events.PAUSE,pauseTelemetry);
      this.events.off(Phaser.Scenes.Events.RESUME,resumeTelemetry);
    });

    dottedBackground(this);
    this.input.topOnly = true;
    this.hovered = null;
    this.input.on("pointermove", this.refreshHover, this);
    this.input.on("pointerdown", this.onPointerDownHint, this);
    this.events.on("block:settled", this.refreshHover, this);
    this.movement = new MovementSystem();

    const levelData = getLevel(store.currentLevel);
    this.grid = new Grid(
      this,
      levelData.cols,
      levelData.rows,
      levelData.exits,
      {
        cols: MAX_LEVEL_COLS,
        rows: MAX_LEVEL_ROWS,
      },
      levelData.iceCells ?? [],
    );

    this.blocks = [];
    this.input2 = new InputManager(this, (block, dir) =>
      this.handleSwipe(block, dir),
    );

    levelData.blocks.forEach((bd) => {
      const block = new Block(this, bd, this.grid);
      this.grid.place(block);
      this.blocks.push(block);
    });

    this.input2.setBlocks(this.blocks);

    // Snapshot initial locked state for unlockChime detection
    this.prevLocked.clear();
    for (const b of this.blocks) {
      if (b.type === "dependent" || b.type === "lock") this.prevLocked.set(b.blockId, b.isLocked());
    }

    this.drawHud();
    AudioManager.startAmbient();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.autoplayToken++;
      SDKManager.gameplayStop();
      this.input.off("pointermove", this.refreshHover, this);
      this.input.off("pointerdown", this.onPointerDownHint, this);
      this.events.off("block:settled", this.refreshHover, this);
      this.events.off("tutorial:moved", this.dismissTutorial, this);
      this.dialogue?.destroy();
      this.dialogue = undefined;
      this.tutorial?.destroy();
      this.tutorial = undefined;
      this.hovered = null;
      AudioManager.stopAmbient();
    });

    const willAutoplay = !!this.registry.get("autoplaySolution");
    if (willAutoplay) {
      this.registry.remove("autoplaySolution");
      this.time.delayedCall(400, () => this.runAutoplay());
    } else {
      this.maybeShowTutorial(!!this.registry.get("replayTutorial"));
      this.registry.remove("replayTutorial");
    }
  }

  private maybeShowTutorial(force = false): void {
    const store = useGameStore.getState();
    const level = store.currentLevel;
    const generatedTutorial = GENERATED_TUTORIALS[level];
    if (STAGES.length) {
      if (!generatedTutorial || (!force && store.hasSeenTutorial(level, DIALOGUE_VERSION))) return;
      this.dialogue?.destroy();
      this.dialogue = new DialogueTutorial(this, dialogueSteps(getLevel(level), getSolution(level), generatedTutorial.body), this.blocks, this.grid, getLevel(level), () => store.markTutorialSeen(level, DIALOGUE_VERSION));
      return;
    }
    const cfg = IS_GENERATED_CAMPAIGN ? generatedTutorial && { title: generatedTutorial.title, message: generatedTutorial.body } : LEVEL_TUTORIALS[level];
    if (!cfg) return;
    if (store.hasSeenTutorial(level)) return;
    this.tutorial = new LevelTutorial(this);
    this.tutorial.show(cfg, this.blocks, this.grid);
    this.events.on("tutorial:moved", this.dismissTutorial, this);
  }

  private dismissTutorial(): void {
    if (!this.tutorial) return;
    const level = useGameStore.getState().currentLevel;
    useGameStore.getState().markTutorialSeen(level);
    this.tutorial.dismiss(this.blocks, this.grid);
    this.events.off("tutorial:moved", this.dismissTutorial, this);
    // Keep `this.tutorial` reference so SHUTDOWN destroys follow-up overlays too.
  }

  private refreshHover(): void {
    const p = this.input.activePointer;
    let next: Block | null = null;
    for (const b of this.blocks) {
      if (b.removed || b.type === "obstacle") continue;
      if ((b.type === "dependent" || b.type === "lock") && b.isLocked()) continue;
      if (b.containsPointer(p.worldX, p.worldY)) {
        next = b;
        break;
      }
    }
    if (next === this.hovered) return;
    this.hovered?.setHover(false);
    this.hovered = next;
    this.hovered?.setHover(true);
  }

  private onPointerDownHint(pointer: Phaser.Input.Pointer): void {
    if (this.busy || this.watchPlaying) return;
    const { height } = this.scale;
    if (pointer.y < 144 || pointer.y > height - 144) return;
    for (const b of this.blocks) {
      if (b.containsPointerForHint(pointer.worldX, pointer.worldY)) {
        this.showDependencyHint(b);
        return;
      }
    }
  }

  private showDependencyHint(dep: Block): void {
    if (!dep.dependsOn) return;
    const parent = this.blocks.find((b) => b.blockId === dep.dependsOn);
    if (!parent || parent.removed) return;
    this.drawHintRing(parent);
    AudioManager.hover();
    // Advance tutorial tap-stage if currently awaiting an inspect tap
    if (this.tutorial?.isAwaitingTap()) {
      this.tutorial.advanceAfterTap(this.blocks, this.grid);
    }
  }

  private drawHintRing(target: Block): Phaser.GameObjects.Container {
    const cell = this.grid.cellSize;
    const halfW = (target.size[0] * cell - 14) / 2;
    const halfH = (target.size[1] * cell - 14) / 2;
    const radius = Math.max(halfW, halfH) + 22;

    const ring = this.add.graphics();
    const dashes = 14;
    const step = (Math.PI * 2) / dashes;
    const fill = step * 0.55;
    ring.lineStyle(8, TOKENS.exitGlow, 1);
    for (let i = 0; i < dashes; i++) {
      const start = i * step;
      ring.beginPath();
      ring.arc(0, 0, radius, start, start + fill);
      ring.strokePath();
    }

    const container = this.add.container(target.x, target.y, [ring]);
    container.setDepth(80);
    container.setScale(0.82);
    container.setAlpha(0);

    this.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: "Back.easeOut",
    });
    this.tweens.add({
      targets: container,
      angle: 60,
      duration: 1100,
      ease: "Sine.easeInOut",
    });
    this.tweens.add({
      targets: container,
      alpha: 0,
      scale: 1.18,
      duration: 700,
      delay: 400,
      ease: "Sine.easeIn",
      onComplete: () => container.destroy(),
    });
    return container;
  }

  private drawHud(): void {
    const { width } = this.scale;
    const store = useGameStore.getState();

    const headerY = 64;
    const ui = paletteUI();
    this.drawHudLabel(
      116,
      headerY,
      172,
      86,
      `LV ${store.currentLevel}`,
      ui.primary,
    );

    this.movesText = this.add
      .text(width / 2, headerY, this.movesLabel(), {
        fontFamily: FONT_NEO,
        fontSize: "32px",
        color: TOKENS.inkHex,
      })
      .setOrigin(0.5);

    neoPill(
      this,
      width - 64,
      headerY,
      "II",
      () => {
        AudioManager.pauseSwoosh();
        this.scene.launch(SCENE_KEYS.Pause);
        this.scene.pause();
      },
      { w: 100, h: 86, fill: TOKENS.white, textSize: 32 },
    );

    const stage = getStage(store.currentLevel);
    if (stage) this.add.text(240, 64, `STAGE ${stage.number} · ${this.moveBudget === undefined ? 'FREE MOVES' : 'MOVE LIMIT'}`, { fontFamily: FONT_NEO, fontSize: '18px', color: TOKENS.inkHex }).setOrigin(0, 0.5);
    if (STAGES.length && GENERATED_TUTORIALS[store.currentLevel]) neoPill(this, 150, this.scale.height - 55, 'TUTORIAL', () => {
      if (this.busy || this.ended || this.watchPlaying) return;
      playerTelemetry.increment('restartCount'); playerTelemetry.finish(false, 'RESTART'); this.registry.set('replayTutorial', true); this.scene.restart();
    }, { w: 240, h: 70, fill: TOKENS.white, textSize: 23 });
    const bottomY = this.scale.height - 55;
    const btnW = 240;
    const btnSpacing = 260;
    this.hintBtn = neoButton(
      this,
      width / 2 - btnSpacing / 2,
      bottomY,
      btnW,
      86,
      "HINT",
      ui.primary,
      () => this.requestHint(),
      { textSize: 30 },
    );
    this.refreshHintLabel();
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.refreshHintLabel(),
    });
    this.restartBtn = neoButton(
      this,
      width / 2 + btnSpacing / 2,
      bottomY,
      btnW,
      86,
      "RESTART",
      ui.danger,
      () => {
        if (this.watchPlaying || this.busy || this.ended) return;
        playerTelemetry.increment("restartCount");
        playerTelemetry.finish(false, "RESTART");
        this.scene.restart();
      },
      { textSize: 32 },
    );
  }

  private refreshHintLabel(): void {
    this.hintBtn.setLabel(this.hintSearching ? 'THINKING...' : 'HINT');
    this.hintBtn.setEnabled(!this.watchPlaying && !this.ended && !this.hintSearching);
  }

  private movesLabel(): string {
    const moves = useGameStore.getState().movesThisLevel;
    return this.moveBudget === undefined ? `MOVES: ${moves}` : `MOVES: ${moves} / ${this.moveBudget}`;
  }

  private async requestHint(): Promise<void> {
    if (this.watchPlaying || this.busy || this.ended || this.hintSearching) return;
    const token = this.autoplayToken;
    this.hintSearching = true;
    this.refreshHintLabel();
    playerTelemetry.increment('hintCount'); Analytics.log('hint_used', { type: 'next_action' });
    const initial = createState(getLevel(useGameStore.getState().currentLevel));
    const state: PuzzleState = { ...initial, exitCount: this.grid.getExitCount(), blocks: this.blocks.map(b => ({ blockId: b.blockId, gridPos: [...b.gridPos] as [number,number], size: b.size, type: b.type, direction: b.direction, dependsOn: b.dependsOn, unlockAt: b.unlockAt, removed: b.removed })) };
    const moves = useGameStore.getState().movesThisLevel;
    const remaining = this.moveBudget === undefined ? Infinity : this.moveBudget - moves;
    const action = hintFromSolution(state, getLevel(useGameStore.getState().currentLevel), getSolution(useGameStore.getState().currentLevel), remaining) ?? await findHint(state, remaining, () => token !== this.autoplayToken);
    if (token !== this.autoplayToken) return;
    this.hintSearching = false;
    this.refreshHintLabel();
    if (moves !== useGameStore.getState().movesThisLevel || this.ended) return;
    this.hintMessage?.destroy();
    const block = action && this.blocks.find(b => b.blockId === action.blockId);
    if (block && action) this.hintRing = this.drawHintRing(block);
    this.hintMessage = this.add.text(260, 830, action ? `TRY ${action.blockId.toUpperCase()} ${action.dir}` : 'No hint found within the search budget.\nTry a different order or restart.', { fontFamily: FONT_NEO, fontSize: '22px', color: TOKENS.inkHex, wordWrap: { width: 450 }, align: 'center' }).setOrigin(0.5).setDepth(110);
    const message = this.hintMessage; this.time.delayedCall(5000, () => message?.destroy());
  }

  private async runAutoplay(): Promise<void> {
    const token = this.autoplayToken;
    const store = useGameStore.getState();
    const moves: SolutionMove[] = getSolution(store.currentLevel);
    if (moves.length === 0) {
      this.watchPlaying = false;
      this.refreshHintLabel();
      return;
    }
    this.watchPlaying = true;
    this.hintBtn.setEnabled(false);
    this.restartBtn.setEnabled(false);
    this.refreshHintLabel();

    for (const mv of moves) {
      // wait for any in-flight animation
      await this.waitUntilIdle();
      if (token !== this.autoplayToken) return;
      const block = this.blocks.find((b) => b.blockId === mv.blockId);
      if (!block || block.removed) {
        console.error('Solution replay failed: missing/removed block', mv.blockId);
        break;
      }
      if (this.movement.slide(block, this.grid, mv.dir, this.blocks).kind === 'invalid') {
        console.error('Solution replay failed: invalid action', mv);
        break;
      }
      this.autoplayActive = true;
      AudioManager.aiStep();
      this.handleSwipe(block, mv.dir);
      this.autoplayActive = false;
      // small visual gap between moves
      await this.delay(120);
      if (token !== this.autoplayToken) return;
    }
    await this.waitUntilIdle();
    if (token !== this.autoplayToken) return;
    this.watchPlaying = false;
    this.restartBtn.setEnabled(true);
    this.refreshHintLabel();
  }

  private waitUntilIdle(): Promise<void> {
    return new Promise((resolve) => {
      const tick = () => {
        if (!this.busy) resolve();
        else this.time.delayedCall(40, tick);
      };
      tick();
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, () => resolve()));
  }

  private drawHudLabel(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    fill: number,
  ): void {
    const g = this.add.graphics();
    const cornerR = TOKENS.cornerR;
    const shadow = TOKENS.shadowOffset;
    const border = TOKENS.borderPx;
    g.fillStyle(TOKENS.ink, 1);
    g.fillRoundedRect(-w / 2 + shadow, -h / 2 + shadow, w, h, cornerR);
    g.fillStyle(TOKENS.ink, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, cornerR);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(
      -w / 2 + border,
      -h / 2 + border,
      w - border * 2,
      h - border * 2,
      cornerR - 4,
    );
    const txt = this.add
      .text(0, 0, label, {
        fontFamily: FONT_NEO,
        fontSize: "32px",
        color: TOKENS.inkHex,
      })
      .setOrigin(0.5);
    this.add.container(x, y, [g, txt]);
  }

  private handleSwipe(block: Block, dir: Direction): void {
    if (this.ended || this.busy) {
      AudioManager.bump();
      return;
    }
    if (this.watchPlaying && !this.autoplayActive) return;
    if (block.removed || block.type === "obstacle") return;

    if (this.dialogue && !this.dialogue.permits({ blockId: block.blockId, dir })) { AudioManager.thud(); return; }
    const result = this.movement.slide(block, this.grid, dir, this.blocks);

    if (result.kind === "invalid") {
      if (result.reason === "wrong_dir") AudioManager.constraintReject();
      else if (result.reason === "locked") AudioManager.thud();
      else AudioManager.bump();
      this.shake(block);
      Analytics.log("hint_used", { invalid: result.reason });
      return;
    }

    this.hintMessage?.destroy(); this.hintMessage = undefined;
    if (this.hintRing) { this.tweens.killTweensOf(this.hintRing); this.hintRing.destroy(true); this.hintRing = undefined; }
    const pan = this.computePan(block.gridPos[0]);

    Analytics.log("block_moved", {
      dir,
      color: block.color,
      kind: result.kind,
    });
    const store = useGameStore.getState();
    store.incMoves();
    playerTelemetry.increment("moveCount");
    this.movesText.setText(this.movesLabel());

    if (result.kind === "slide") {
      this.grid.clear(block);
      block.gridPos = [result.toCol, result.toRow];
      this.grid.place(block);
      this.busy = true;
      AudioManager.slideStart(result.distance, pan);
      block.moveToCell(
        this.grid,
        result.toCol,
        result.toRow,
        true,
        result.distance,
      );
      this.time.delayedCall(Math.min(360, 90 + result.distance * 38), () => {
        block.squash(dir);
        dustPuff(this, block.x, block.y, dir);
        screenshake(this, 0.003, 80);
        AudioManager.slideEnd(result.distance, this.computePan(result.toCol));
        this.busy = false;
        this.events.emit("tutorial:moved");
        this.dialogue?.moved({ blockId: block.blockId, dir });
        this.checkAttempt();
      });
      return;
    }

    // exit
    this.grid.clear(block);
    const startCol = block.gridPos[0];
    const startRow = block.gridPos[1];
    block.gridPos = [result.toCol, result.toRow];
    this.busy = true;
    AudioManager.slideStart(result.distance, pan);

    const lastInCol =
      dir === "RIGHT"
        ? result.toCol - 1
        : dir === "LEFT"
          ? result.toCol + 1
          : result.toCol;
    const lastInRow =
      dir === "DOWN"
        ? result.toRow - 1
        : dir === "UP"
          ? result.toRow + 1
          : result.toRow;
    const slideDist =
      Math.abs(lastInCol - startCol) + Math.abs(lastInRow - startRow);
    const exitColor = COLORS[block.color];

    block.exitTo(
      this.grid,
      lastInCol,
      lastInRow,
      dir,
      slideDist,
      () => {
        const portalX = this.grid.worldX(lastInCol);
        const portalY = this.grid.worldY(lastInRow);
        AudioManager.pop(this.computePan(result.toCol));
        this.handleCombo();
        removalBloom(this, portalX, portalY, exitColor);
        burstParticles(this, portalX, portalY, exitColor, 12);
        portalSuck(this, portalX, portalY, dir);
        screenshake(this, 0.005, 110);
      },
      () => {
        this.grid.registerExit();
        this.refreshDependents();
        this.busy = false;
        this.dialogue?.moved({ blockId: block.blockId, dir });
        this.afterRemove();
      },
    );
    this.events.emit("tutorial:moved");
  }

  private refreshDependents(): void {
    let unlockedAny = false;
    for (const b of this.blocks) {
      if (b.removed) continue;
      if (b.type === "dependent") {
        b.refreshDependency(this.blocks);
      } else if (b.type === "lock") {
        b.refreshLock(this.grid);
      } else {
        continue;
      }
      const wasLocked = this.prevLocked.get(b.blockId) ?? true;
      const nowLocked = b.isLocked();
      if (wasLocked && !nowLocked) unlockedAny = true;
      this.prevLocked.set(b.blockId, nowLocked);
    }
    if (unlockedAny) AudioManager.unlockChime();
  }

  private computePan(col: number): number {
    const cols = this.grid?.cols ?? 1;
    if (cols <= 1) return 0;
    const norm = (col / (cols - 1)) * 2 - 1;
    return Math.max(-0.7, Math.min(0.7, norm));
  }

  private handleCombo(): void {
    const now = performance.now();
    if (now - this.lastRemovalAt <= 800) {
      this.comboCount++;
      if (this.comboCount >= 2) AudioManager.combo(this.comboCount);
    } else {
      this.comboCount = 1;
    }
    this.lastRemovalAt = now;
  }

  private shake(block: Block): void {
    const ox = block.x;
    this.tweens.add({
      targets: block,
      x: ox - 8,
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => (block.x = ox),
    });
  }

  private afterRemove(): void { this.checkAttempt(); }

  private checkAttempt(): void {
    if (this.ended) return;
    const remaining = this.blocks.filter(b => !b.removed && b.type !== 'obstacle');
    const result = resolveAttempt(remaining.length === 0, useGameStore.getState().movesThisLevel, this.moveBudget, this.movement.anyValidMove(this.blocks, this.grid));
    if (result === 'STUCK') { playerTelemetry.increment('deadEndCount'); AudioManager.deadEnd(); deadEndPulse(this); remaining.forEach(b => b.pulseRed()); }
    if (result) this.endLevel(result);
  }

  private endLevel(result: AttemptResult): void {
    if (this.ended) return;
    this.ended = true;
    if (this.attemptIsAutoplay) {
      playerTelemetry.finish(result === 'WIN', result);
      this.time.delayedCall(800, () => this.scene.restart());
      return;
    }
    playerTelemetry.finish(result === "WIN", result);
    const store = useGameStore.getState();
    if (result === "WIN") {
      AudioManager.win();
      store.recordCompletion(store.currentLevel);
      store.unlockNext();
      SDKManager.happytime();
      Analytics.log("level_completed", {
        level: store.currentLevel,
        moves: store.movesThisLevel,
      });
    } else {
      Analytics.log("level_failed", { reason: result === "MOVE_LIMIT" ? "move_limit" : "dead_end", moves: store.movesThisLevel });
      AudioManager.levelFail();
    }
    AudioManager.stopAmbient();
    SDKManager.gameplayStop();
    this.time.delayedCall(500, () => {
      fadeOutAndStart(this, SCENE_KEYS.GameOver, { result });
    });
  }
}
