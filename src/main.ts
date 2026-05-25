import Phaser from 'phaser';
import { gameConfig } from './config/GameConfig';
import { SDKManager } from './managers/SDKManager';
import { Analytics } from './managers/AnalyticsManager';
import { AudioManager } from './managers/AudioManager';
import { useGameStore, PERSIST_KEY, persistedSlice, mergeCloudSnapshot } from './managers/GameStateManager';

declare const __BUILD_TARGET__: string;
declare const __DEV__: boolean;

async function waitForFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  try {
    await document.fonts.load('700 32px "Bungee"');
    await document.fonts.ready;
  } catch (e) {
    console.warn('[font] Bungee load failed', e);
  }
}

function patchTextResolution(): void {
  const dpr = window.devicePixelRatio || 1;
  // Phaser Text rasterizes glyphs to its own texture at resolution=1 by default.
  // When parent canvas is upscaled, text becomes blurry. Override factory to
  // set high resolution on every text object created via scene.add.text().
  const factoryProto = (Phaser.GameObjects as unknown as {
    GameObjectFactory: { prototype: Record<string, unknown> };
  }).GameObjectFactory?.prototype;
  if (!factoryProto) return;
  const origText = factoryProto.text as unknown as (
    x: number,
    y: number,
    text: string | string[],
    style?: object
  ) => Phaser.GameObjects.Text;
  if (!origText) return;
  const targetRes = Math.min(4, dpr * 2);
  factoryProto.text = function (
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    text: string | string[],
    style?: object
  ): Phaser.GameObjects.Text {
    const t = origText.call(this, x, y, text, style);
    t.setResolution(targetRes);
    return t;
  } as typeof factoryProto.text;
}

function emitProgress(pct: number, status: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('fpp:progress', { detail: { pct, status } }));
}

function emitReady(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('fpp:ready'));
}

function installFullscreenAutoTrigger(game: Phaser.Game): void {
  if (typeof __BUILD_TARGET__ === 'undefined' || __BUILD_TARGET__ !== 'itch') return;
  if (!game.device.fullscreen.available) return;

  let triggered = false;
  const trigger = (): void => {
    if (triggered) return;
    triggered = true;
    try {
      game.scale.startFullscreen();
    } catch (e) {
      console.warn('[fullscreen] request failed', e);
    }
  };

  ['pointerdown', 'touchstart', 'keydown'].forEach((ev) => {
    document.addEventListener(ev, trigger, { capture: true, passive: true, once: true });
  });
}

function installCloudWriter(): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  useGameStore.subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const slice = persistedSlice(useGameStore.getState());
      // Wrap in zustand-persist-shaped envelope so reload merges cleanly.
      SDKManager.cloudSave(PERSIST_KEY, { state: slice, version: 0 });
    }, 800);
  });
}

function installPlaygamaListeners(game: Phaser.Game): void {
  SDKManager.onPauseChanged((paused) => {
    AudioManager.duckForAd(paused);
    if (paused) {
      game.scene.scenes.forEach((s) => {
        if (s.scene.isActive()) game.scene.pause(s.scene.key);
      });
    } else {
      game.scene.scenes.forEach((s) => {
        if (s.scene.isPaused()) game.scene.resume(s.scene.key);
      });
    }
  });
  SDKManager.onAudioChanged((enabled) => {
    AudioManager.duckForAd(!enabled);
  });
}

function installAudioUnlock(): void {
  const unlock = (): void => {
    AudioManager.unlock();
  };
  ['pointerdown', 'touchstart', 'keydown'].forEach((ev) => {
    document.addEventListener(ev, unlock, { capture: true, passive: true });
  });
  // Also unlock on visibility-restore so a backgrounded ctx wakes immediately on next gesture.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) AudioManager.unlock();
  });
  (window as unknown as { AudioManager?: typeof AudioManager }).AudioManager = AudioManager;
}

window.addEventListener('load', async () => {
  emitProgress(20, 'Initializing...');
  patchTextResolution();
  installAudioUnlock();

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // Dev cheats: unlock all levels + zero watch cooldown.
    useGameStore.getState().unlockAll();
    console.info('[dev] all levels unlocked + watch cooldown disabled');
  }

  emitProgress(35, 'Connecting SDK...');
  const sdkPromise = SDKManager.init().then(() => emitProgress(60, 'Loading fonts...'));
  const fontPromise = waitForFonts().then(() => emitProgress(75, 'Preparing assets...'));
  await Promise.all([sdkPromise, fontPromise]);

  if (SDKManager.hasCloudStorage()) {
    try {
      const cloud = await SDKManager.cloudLoad(PERSIST_KEY);
      if (cloud && mergeCloudSnapshot(cloud)) {
        console.info('[cloud] merged remote save');
      }
    } catch (e) {
      console.warn('[cloud] load skipped', e);
    }
    installCloudWriter();
  }

  emitProgress(90, 'Starting game...');
  Analytics.log('session_start', { platform: SDKManager.getPlatform() });
  const game = new Phaser.Game(gameConfig);
  installFullscreenAutoTrigger(game);
  installPlaygamaListeners(game);

  game.events.once('ready', () => emitReady());
  // Fallback: emit ready when first scene becomes active.
  game.events.once(Phaser.Core.Events.STEP, () => emitReady());
});
