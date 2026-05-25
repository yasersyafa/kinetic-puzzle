import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/Constants';
import { useGameStore } from '../managers/GameStateManager';
import { AudioManager } from '../managers/AudioManager';
import { fadeIn, fadeOutAndStart } from '../utils/Effects';
import { PALETTES, isPaletteUnlocked, unlockProgress, PaletteId } from '../config/Palettes';
import { Analytics } from '../managers/AnalyticsManager';
import { TOKENS, FONT_NEO, neoPill, dottedBackground, popIn, slideUpIn } from '../ui/Theme';

export class CosmeticsScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.Cosmetics });
  }

  create(): void {
    fadeIn(this);
    dottedBackground(this);
    AudioManager.menuOpen();

    const { width } = this.scale;

    const back = neoPill(this, 120, 100, '<', () => {
      AudioManager.uiTap();
      fadeOutAndStart(this, SCENE_KEYS.Menu);
    }, { w: 140, h: 100, fill: TOKENS.white, textSize: 46 });
    slideUpIn(this, back.container, 60, -20);

    const header = this.add
      .text(width / 2 + 36, 100, 'COLOR PALETTE', {
        fontFamily: FONT_NEO,
        fontSize: '54px',
        color: TOKENS.inkHex,
      })
      .setOrigin(0.5);
    popIn(this, header, 100);

    const tile = 480;
    const gap = 60;
    const cols = PALETTES.length;
    const totalW = cols * tile + (cols - 1) * gap;
    const startX = (width - totalW) / 2 + tile / 2;
    const y = 500;

    PALETTES.forEach((p, i) => {
      const x = startX + i * (tile + gap);
      const unlocked = isPaletteUnlocked(p.id);
      const equipped = useGameStore.getState().equippedPalette === p.id;

      const card = this.add.container(x, y);

      const cardShadow = this.add.graphics();
      cardShadow.fillStyle(TOKENS.ink, 1);
      cardShadow.fillRoundedRect(-tile / 2 + 6, -tile / 2 + 6, tile, tile, 22);
      const cardBg = this.add.graphics();
      cardBg.fillStyle(TOKENS.ink, 1);
      cardBg.fillRoundedRect(-tile / 2, -tile / 2, tile, tile, 22);
      cardBg.fillStyle(unlocked ? (equipped ? TOKENS.sky : TOKENS.white) : TOKENS.lockGray, 1);
      cardBg.fillRoundedRect(-tile / 2 + 6, -tile / 2 + 6, tile - 12, tile - 12, 20);
      card.add([cardShadow, cardBg]);

      // Color swatch row: 6 blocks of the palette
      const colorKeys: Array<keyof typeof p.colors> = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
      const swatchSize = 56;
      const swatchGap = 12;
      const swatchTotal = colorKeys.length * swatchSize + (colorKeys.length - 1) * swatchGap;
      const swatchStartX = -swatchTotal / 2 + swatchSize / 2;
      colorKeys.forEach((key, k) => {
        const sx = swatchStartX + k * (swatchSize + swatchGap);
        const sg = this.add.graphics();
        sg.fillStyle(TOKENS.ink, 1);
        sg.fillRoundedRect(sx - swatchSize / 2 + 3, -40 + 3, swatchSize, swatchSize, 8);
        sg.fillStyle(TOKENS.ink, 1);
        sg.fillRoundedRect(sx - swatchSize / 2, -40, swatchSize, swatchSize, 8);
        sg.fillStyle(p.colors[key], 1);
        sg.fillRoundedRect(sx - swatchSize / 2 + 4, -36, swatchSize - 8, swatchSize - 8, 6);
        if (!unlocked) sg.setAlpha(0.35);
        card.add(sg);
      });

      const nameTxt = this.add
        .text(0, 80, p.name.toUpperCase(), {
          fontFamily: FONT_NEO,
          fontSize: '42px',
          color: TOKENS.inkHex,
        })
        .setOrigin(0.5);
      card.add(nameTxt);

      const descTxt = this.add
        .text(0, 130, p.description, {
          fontFamily: FONT_NEO,
          fontSize: '22px',
          color: TOKENS.inkHex,
        })
        .setOrigin(0.5)
        .setAlpha(0.7);
      card.add(descTxt);

      let footLabel: string;
      if (!unlocked) {
        const prog = unlockProgress(p.id);
        footLabel = prog ? `LOCKED · ${prog.current}/${prog.total}` : 'LOCKED';
      } else if (equipped) {
        footLabel = 'EQUIPPED';
      } else {
        footLabel = 'TAP TO EQUIP';
      }
      const footTxt = this.add
        .text(0, 180, footLabel, {
          fontFamily: FONT_NEO,
          fontSize: '26px',
          color: TOKENS.inkHex,
        })
        .setOrigin(0.5)
        .setAlpha(0.85);
      card.add(footTxt);

      if (unlocked && !equipped) {
        const hit = this.add.rectangle(0, 0, tile, tile, 0xFFFFFF, 0);
        hit.setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => {
          AudioManager.uiTap();
          useGameStore.getState().setEquippedPalette(p.id as PaletteId);
          Analytics.track('skin_equipped', { paletteId: p.id });
          this.scene.restart();
        });
        card.add(hit);
      }

      card.setScale(0);
      this.tweens.add({
        targets: card,
        scale: 1,
        duration: 320,
        delay: 200 + i * 90,
        ease: 'Back.easeOut',
      });
    });

    const hint = this.add
      .text(width / 2, 880, 'CLEAR PACKS TO UNLOCK MORE PALETTES.', {
        fontFamily: FONT_NEO,
        fontSize: '24px',
        color: TOKENS.inkHex,
      })
      .setOrigin(0.5)
      .setAlpha(0.6);
    this.tweens.add({ targets: hint, alpha: 0.6, duration: 400, delay: 600 });
  }
}
