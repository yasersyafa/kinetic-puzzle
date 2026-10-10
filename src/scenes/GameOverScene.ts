import Phaser from 'phaser';
import { SCENE_KEYS, TOTAL_LEVELS } from '../config/Constants';
import { useGameStore } from '../managers/GameStateManager';
import { confetti, fadeIn, fadeOutAndStart } from '../utils/Effects';
import { TOKENS, FONT_NEO, neoButton, dottedBackground, popIn, slideUpIn } from '../ui/Theme';
import { paletteUI } from '../config/Palettes';
import { getRandomQuote } from '../config/Quotes';
import { getMoveLimit, getStage, STAGE_CONFIG } from '../config/Levels';
import type { AttemptResult } from '../core/campaign/Stage';

interface GameOverData {
  result: AttemptResult;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.GameOver });
  }

  create(data: GameOverData): void {
    fadeIn(this);
    dottedBackground(this);
    const { width } = this.scale;
    const cx = width / 2;
    const win = data.result === 'WIN';

    if (win) {
      confetti(this);
      this.layoutWin();
    } else {
      this.layoutStuck(cx, data.result);
    }
  }

  private layoutWin(): void {
    const { width } = this.scale;
    const cx = width / 2;
    const store = useGameStore.getState();
    const isLast = store.currentLevel >= TOTAL_LEVELS;

    const headTxt = this.add
      .text(cx, 180, 'SUCCESS!', {
        fontFamily: FONT_NEO,
        fontSize: '94px',
        color: TOKENS.inkHex,
      })
      .setOrigin(0.5);
    popIn(this, headTxt, 0);

    const subTxt = this.add
      .text(cx, 282, `LEVEL ${store.currentLevel} · ${store.movesThisLevel} MOVES${getMoveLimit(store.currentLevel) === undefined ? "" : ` / ${getMoveLimit(store.currentLevel)}`}`, {
        fontFamily: FONT_NEO,
        fontSize: '32px',
        color: TOKENS.inkHex,
      })
      .setOrigin(0.5);
    this.fadeTextIn(subTxt, 140, 0.7);

    const stage = getStage(store.currentLevel);
    if (stage && store.currentLevel === stage.firstLevel + stage.levelCount - 1 && Array.from({ length: stage.levelCount }, (_, i) => stage.firstLevel + i).every(id => store.isCompleted(id))) {
      this.add.text(cx, 380, `STAGE ${stage.number} COMPLETE`, { fontFamily: FONT_NEO, fontSize: '36px', color: TOKENS.inkHex }).setOrigin(0.5);
    }

    this.drawQuotePanel(560, 680, 820, 460);

    const btnX = 1340;
    const btnW = 460;
    const btnH = 120;

    const ui = paletteUI();
    if (isLast) {
      const doneTxt = this.add
        .text(btnX, 540, STAGE_CONFIG && TOTAL_LEVELS < STAGE_CONFIG.targetLevels ? 'MORE LEVELS COMING SOON' : 'CAMPAIGN COMPLETE', {
          fontFamily: FONT_NEO,
          fontSize: '40px',
          color: TOKENS.inkHex,
        })
        .setOrigin(0.5);
      this.fadeTextIn(doneTxt, 380);
      const menuBtn = neoButton(this, btnX, 710, btnW, btnH, 'MAIN MENU', ui.danger, () => {
        fadeOutAndStart(this, SCENE_KEYS.Menu);
      });
      slideUpIn(this, menuBtn.container, 480);
    } else {
      const resumeBtn = neoButton(this, btnX, 560, btnW, btnH, store.canPlay(store.currentLevel + 1) ? 'NEXT LEVEL' : 'FINISH EARLIER LEVELS', ui.primary, () => {
        useGameStore.getState().setCurrentLevel(useGameStore.getState().currentLevel + 1);
        fadeOutAndStart(this, SCENE_KEYS.Game);
      });
      resumeBtn.setEnabled(store.canPlay(store.currentLevel + 1));
      slideUpIn(this, resumeBtn.container, 380);

      const restartBtn = neoButton(this, btnX, 710, btnW, btnH, 'RESTART', ui.accent, () => {
        fadeOutAndStart(this, SCENE_KEYS.Game);
      });
      slideUpIn(this, restartBtn.container, 480);

      const menuBtn = neoButton(this, btnX, 860, btnW, btnH, 'MAIN MENU', ui.danger, () => {
        fadeOutAndStart(this, SCENE_KEYS.Menu);
      });
      slideUpIn(this, menuBtn.container, 580);
    }
  }

  private fadeTextIn(t: Phaser.GameObjects.Text, delay: number, finalAlpha = 1, slide = 32): void {
    const baseY = t.y;
    t.y = baseY + slide;
    t.setAlpha(0);
    this.tweens.add({
      targets: t,
      y: baseY,
      alpha: finalAlpha,
      duration: 360,
      delay,
      ease: 'Sine.easeOut',
    });
  }

  private drawQuotePanel(x: number, y: number, w: number, _h: number): void {
    const q = getRandomQuote();

    const glyph = this.add
      .text(x, y - 180, '“', {
        fontFamily: FONT_NEO,
        fontSize: '160px',
        color: TOKENS.inkHex,
      })
      .setOrigin(0.5);
    glyph.setAlpha(0);
    glyph.setScale(0.6);
    this.tweens.add({
      targets: glyph,
      alpha: 0.25,
      scale: 1,
      duration: 420,
      delay: 220,
      ease: 'Back.easeOut',
    });

    const quoteTxt = this.add
      .text(x, y - 40, q.text, {
        fontFamily: FONT_NEO,
        fontSize: '34px',
        color: TOKENS.inkHex,
        align: 'center',
        wordWrap: { width: w - 40 },
      })
      .setOrigin(0.5);
    this.fadeTextIn(quoteTxt, 360);

    const authorTxt = this.add
      .text(x, y + 120, `— ${q.author.toUpperCase()}`, {
        fontFamily: FONT_NEO,
        fontSize: '24px',
        color: TOKENS.inkHex,
      })
      .setOrigin(0.5);
    this.fadeTextIn(authorTxt, 520, 0.6);
  }

  private layoutStuck(cx: number, result: AttemptResult): void {
    const cy = this.scale.height / 2;
    const store = useGameStore.getState();

    this.add
      .text(cx, cy - 324, 'FAILED', {
        fontFamily: FONT_NEO,
        fontSize: '94px',
        color: TOKENS.inkHex,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy - 216, result === 'MOVE_LIMIT' ? 'Move limit reached. Restart and try a new order.' : 'No legal moves remain. Restart and try a new order.', {
        fontFamily: FONT_NEO,
        fontSize: '26px',
        color: TOKENS.inkHex,
      })
      .setOrigin(0.5)
      .setAlpha(0.65);

    this.add
      .text(cx, cy - 126, `LEVEL ${store.currentLevel} · ${store.movesThisLevel} MOVES`, {
        fontFamily: FONT_NEO,
        fontSize: '32px',
        color: TOKENS.inkHex,
      })
      .setOrigin(0.5);

    const ui = paletteUI();
    neoButton(this, cx, cy + 154, 504, 108, 'RESTART', ui.accent, () => {
      fadeOutAndStart(this, SCENE_KEYS.Game);
    });

    neoButton(this, cx, cy + 290, 504, 108, 'MAIN MENU', ui.danger, () => {
      fadeOutAndStart(this, SCENE_KEYS.Menu);
    });
  }
}
