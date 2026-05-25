import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/Constants';
import { useGameStore } from '../managers/GameStateManager';
import { AudioManager } from '../managers/AudioManager';
import { AdManager } from '../managers/AdManager';
import { SDKManager } from '../managers/SDKManager';
import { fadeIn, fadeOutAndStart } from '../utils/Effects';
import { PACKS, getPackOf } from '../config/Levels';
import {
  TOKENS,
  FONT_NEO,
  neoButton,
  neoPill,
  dottedBackground,
  drawLockIcon,
  floatingDecor,
  popIn,
  slideUpIn,
} from '../ui/Theme';

export class LevelSelectScene extends Phaser.Scene {
  private gridLayer?: Phaser.GameObjects.Container;
  private activePackId: string = 'tutorial';

  constructor() {
    super({ key: SCENE_KEYS.LevelSelect });
  }

  init(data?: { activePackId?: string }): void {
    if (data?.activePackId) {
      this.activePackId = data.activePackId;
    } else {
      const store = useGameStore.getState();
      const currentPack = getPackOf(store.currentLevel);
      this.activePackId = currentPack?.id ?? 'tutorial';
    }
  }

  create(): void {
    fadeIn(this);
    dottedBackground(this);
    AudioManager.menuOpen();
    this.spawnAmbientDecor();

    const { width, height } = this.scale;

    const back = neoPill(this, 120, 100, '<', () => {
      AudioManager.uiTap();
      fadeOutAndStart(this, SCENE_KEYS.Menu);
    }, { w: 140, h: 100, fill: TOKENS.white, textSize: 46 });
    slideUpIn(this, back.container, 60, -20);

    // Per-pack unlock button: unlocks only the ACTIVE pack via rewarded ad.
    const activePack = PACKS.find((p) => p.id === this.activePackId);
    const packLastId = activePack ? activePack.levelIds[activePack.levelIds.length - 1] : 0;
    const packAlreadyUnlocked = useGameStore.getState().unlockedLevel >= packLastId;
    if (activePack && !packAlreadyUnlocked && SDKManager.hasRewardedAds()) {
      const unlockBtn = neoButton(
        this,
        width - 260,
        100,
        420,
        86,
        `UNLOCK ${activePack.name.toUpperCase()} (AD)`,
        TOKENS.yellow,
        async () => {
          AudioManager.uiTap();
          unlockBtn.setEnabled(false);
          unlockBtn.setLabel('LOADING...');
          const ok = await AdManager.showRewarded('unlock_all');
          if (ok) {
            useGameStore.getState().unlockUpTo(packLastId);
            this.scene.restart();
          } else {
            unlockBtn.setEnabled(true);
            unlockBtn.setLabel(`UNLOCK ${activePack.name.toUpperCase()} (AD)`);
          }
        },
        { textSize: 24 },
      );
      slideUpIn(this, unlockBtn.container, 100, -20);
    }

    const header = this.add
      .text(width / 2, 100, 'SELECT LEVEL', {
        fontFamily: FONT_NEO,
        fontSize: '54px',
        color: TOKENS.inkHex,
        align: 'center',
      })
      .setOrigin(0.5);
    popIn(this, header, 100);

    // Pack tabs on left column, grid centered in remaining right area
    const tabsX = 230;
    const tabW = 340;
    const gridLeftBound = tabsX + tabW / 2; // right edge of tabs column
    this.drawPackTabs(tabsX, 250);
    this.gridLayer = this.add.container(0, 0);
    this.renderPackGrid(this.activePackId, width, height, gridLeftBound);
  }

  private drawPackTabs(x: number, startY: number): void {
    const tabW = 340;
    const tabH = 100;
    const gap = 20;
    const store = useGameStore.getState();

    PACKS.forEach((pack, i) => {
      const y = startY + i * (tabH + gap) + tabH / 2;
      const packUnlocked = store.unlockedLevel >= pack.unlockAfter + 1;
      const active = pack.id === this.activePackId;
      const fill = !packUnlocked ? TOKENS.lockGray : active ? TOKENS.sky : TOKENS.white;
      const stars = pack.levelIds.reduce((sum, id) => sum + store.starsFor(id), 0);
      const maxStars = pack.levelIds.length * 3;
      const label = `${pack.name.toUpperCase()}\n${stars}/${maxStars}★`;

      const btn = neoButton(
        this,
        x,
        y,
        tabW,
        tabH,
        label,
        fill,
        () => {
          if (!packUnlocked) return;
          AudioManager.uiTap();
          this.scene.start(SCENE_KEYS.LevelSelect, { activePackId: pack.id });
        },
        { textSize: 24 },
      );
      if (!packUnlocked) btn.setEnabled(false);
      slideUpIn(this, btn.container, 160 + i * 50);
    });
  }

  private renderPackGrid(packId: string, width: number, height: number, _leftBound: number): void {
    const pack = PACKS.find((p) => p.id === packId);
    if (!pack) return;
    const store = useGameStore.getState();

    const cols = 6;
    const levelIds = pack.levelIds;
    const rows = Math.ceil(levelIds.length / cols);
    const tile = 110;
    const gapX = 30;
    const gapY = 32;
    const gridW = cols * tile + (cols - 1) * gapX;
    const gridH = rows * tile + (rows - 1) * gapY;
    const startX = (width - gridW) / 2 + tile / 2;
    const startY = 250 + tile / 2;
    const usableY = height - 120;
    const adjStartY = startY + gridH > usableY ? usableY - gridH + tile / 2 : startY;

    levelIds.forEach((lvl, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (tile + gapX);
      const y = adjStartY + row * (tile + gapY);
      const locked = lvl > store.unlockedLevel;
      const isCurrent = lvl === store.currentLevel;

      const fill = locked ? TOKENS.lockGray : isCurrent ? TOKENS.sky : TOKENS.mint;

      const btn = neoButton(
        this,
        x,
        y,
        tile,
        tile,
        locked ? '' : `${lvl}`,
        fill,
        () => {
          if (locked) return;
          AudioManager.uiTap();
          useGameStore.getState().setCurrentLevel(lvl);
          fadeOutAndStart(this, SCENE_KEYS.Game);
        },
        { textSize: 40, textColor: TOKENS.inkHex },
      );
      this.gridLayer?.add(btn.container);

      btn.container.setScale(0);
      this.tweens.add({
        targets: btn.container,
        scale: 1,
        duration: 280,
        delay: 240 + i * 14,
        ease: 'Back.easeOut',
      });

      if (locked) {
        btn.setEnabled(false);
        btn.container.setAlpha(0.85);
        const lock = drawLockIcon(this, 0, 0, 22, 0x9a9a9a);
        btn.container.add(lock);
      } else {
        const stars = store.starsFor(lvl);
        if (stars > 0) {
          const pips = this.makeStarPips(stars);
          pips.setPosition(0, tile / 2 - 14);
          btn.container.add(pips);
        }
        // Hover wobble — tilt left then right then settle.
        btn.container.on('pointerover', () => {
          this.tweens.add({
            targets: btn.container,
            angle: { from: -3, to: 3 },
            duration: 120,
            yoyo: true,
            ease: 'Sine.easeInOut',
            onComplete: () => btn.container.setAngle(0),
          });
        });
      }

      if (isCurrent && !locked) {
        this.time.delayedCall(240 + i * 14 + 280, () => {
          const halo = this.add.graphics();
          halo.lineStyle(6, TOKENS.ink, 1);
          halo.strokeCircle(0, 0, tile * 0.85);
          halo.setAlpha(0);
          btn.container.add(halo);
          this.tweens.add({
            targets: halo,
            scale: { from: 0.7, to: 1.4 },
            alpha: { from: 0.55, to: 0 },
            duration: 1100,
            repeat: -1,
            ease: 'Sine.easeOut',
          });
        });
      }
    });
  }

  private makeStarPips(earned: number): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const r = 6;
    const gap = 14;
    for (let i = 0; i < 3; i++) {
      const x = -gap + i * gap;
      const filled = i < earned;
      const dot = this.add.graphics();
      dot.fillStyle(filled ? 0xFFD23F : 0xCCCCCC, 1);
      dot.lineStyle(2, 0x222222, 1);
      dot.fillCircle(x, 0, r);
      dot.strokeCircle(x, 0, r);
      c.add(dot);
    }
    return c;
  }

  private spawnAmbientDecor(): void {
    const { width, height } = this.scale;
    const decor: Array<{
      x: number; y: number; size: number; fill: number;
      icon?: 'chevron' | 'chain' | 'cross';
      iconDir?: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
    }> = [
      { x: 54, y: height - 54, size: 50, fill: TOKENS.red },
      { x: width - 54, y: height - 72, size: 58, fill: TOKENS.yellow, icon: 'chevron', iconDir: 'LEFT' },
    ];
    decor.forEach((d, i) => {
      const node = floatingDecor(this, d.x, d.y, d.size, d.fill, {
        icon: d.icon,
        iconDir: d.iconDir,
        bobAmt: 4 + Math.random() * 3,
        bobDur: 1900 + Math.random() * 700,
      });
      node.container.setAlpha(0);
      this.tweens.add({
        targets: node.container,
        alpha: 0.85,
        duration: 400,
        delay: 80 * i,
        ease: 'Sine.easeOut',
      });
    });
  }
}
