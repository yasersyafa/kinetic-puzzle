import Phaser from 'phaser';
import { SCENE_KEYS, TOTAL_LEVELS } from '../config/Constants';
import { useGameStore } from '../managers/GameStateManager';
import { AdManager } from '../managers/AdManager';
import { confetti, fadeIn, fadeOutAndStart } from '../utils/Effects';
import { TOKENS, FONT_NEO, neoButton, dottedBackground, popIn, slideUpIn } from '../ui/Theme';
import { paletteUI } from '../config/Palettes';
import { getRandomQuote } from '../config/Quotes';
import { getLevel, starsFor } from '../config/Levels';
import { Analytics } from '../managers/AnalyticsManager';

interface GameOverData {
  result: 'WIN' | 'STUCK';
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
      this.layoutStuck(cx);
    }
  }

  private layoutWin(): void {
    const { width } = this.scale;
    const cx = width / 2;
    const store = useGameStore.getState();
    const isLast = store.currentLevel >= TOTAL_LEVELS;

    const level = getLevel(store.currentLevel);
    const par = level.parMoves;
    const stars = starsFor(par, store.movesThisLevel);
    const prevBest = store.starsFor(store.currentLevel);
    store.recordStars(store.currentLevel, stars);
    Analytics.track('star_earned', { levelId: store.currentLevel, stars, par, moves: store.movesThisLevel });

    const headTxt = this.add
      .text(cx, 180, 'CLEARED!', {
        fontFamily: FONT_NEO,
        fontSize: '94px',
        color: TOKENS.inkHex,
      })
      .setOrigin(0.5);
    popIn(this, headTxt, 0);

    const subTxt = this.add
      .text(cx, 282, `LEVEL ${store.currentLevel} · ${store.movesThisLevel} MOVES · PAR ${par}`, {
        fontFamily: FONT_NEO,
        fontSize: '32px',
        color: TOKENS.inkHex,
      })
      .setOrigin(0.5);
    this.fadeTextIn(subTxt, 140, 0.7);

    this.drawStarRow(cx, 380, stars, prevBest);

    this.drawQuotePanel(560, 680, 820, 460);

    const btnX = 1340;
    const btnW = 460;
    const btnH = 120;

    const ui = paletteUI();
    if (isLast) {
      const doneTxt = this.add
        .text(btnX, 540, 'ALL LEVELS DONE', {
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
      const resumeBtn = neoButton(this, btnX, 560, btnW, btnH, 'RESUME', ui.primary, () => {
        useGameStore.getState().setCurrentLevel(useGameStore.getState().currentLevel + 1);
        fadeOutAndStart(this, SCENE_KEYS.Game);
      });
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

  private drawStarRow(cx: number, cy: number, earned: 1 | 2 | 3, prevBest: number): void {
    const size = 70;
    const gap = 32;
    const total = 3;
    const startX = cx - ((size + gap) * (total - 1)) / 2;
    for (let i = 0; i < total; i++) {
      const x = startX + i * (size + gap);
      const filled = i < earned;
      const isNew = filled && i >= prevBest;
      const star = this.drawStar(x, cy, size, filled ? 0xFFD23F : 0xD9D9D9);
      star.setAlpha(0);
      star.setScale(0);
      this.tweens.add({
        targets: star,
        alpha: 1,
        scale: 1,
        duration: 320,
        delay: 220 + i * 140,
        ease: 'Back.easeOut',
      });
      if (isNew) {
        this.tweens.add({
          targets: star,
          scale: { from: 1.3, to: 1 },
          duration: 480,
          delay: 220 + i * 140 + 320,
          ease: 'Sine.easeOut',
        });
      }
    }
  }

  private drawStar(x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.lineStyle(4, 0x222222, 1);
    const outer = size / 2;
    const inner = outer * 0.45;
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      pts.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    g.fillPoints(pts, true);
    g.strokePoints(pts, true);
    g.setPosition(x, y);
    return g;
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

  private layoutStuck(cx: number): void {
    const cy = this.scale.height / 2;
    const store = useGameStore.getState();

    this.add
      .text(cx, cy - 324, 'STUCK!', {
        fontFamily: FONT_NEO,
        fontSize: '94px',
        color: TOKENS.inkHex,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy - 216, 'No more moves available', {
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

    let busy = false;
    const ui = paletteUI();
    neoButton(this, cx, cy + 18, 504, 108, 'CONTINUE (AD)', ui.secondary, async () => {
      if (busy) return;
      busy = true;
      try {
        const ok = await AdManager.showRewarded('continue');
        if (ok) fadeOutAndStart(this, SCENE_KEYS.Game);
      } finally {
        busy = false;
      }
    });

    neoButton(this, cx, cy + 154, 504, 108, 'RETRY', ui.accent, () => {
      fadeOutAndStart(this, SCENE_KEYS.Game);
    });

    neoButton(this, cx, cy + 290, 504, 108, 'MAIN MENU', ui.danger, () => {
      fadeOutAndStart(this, SCENE_KEYS.Menu);
    });
  }
}
