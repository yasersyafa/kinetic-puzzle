import { test, expect } from '@playwright/test';

test('one music track continues across results, menus and pause while respecting mute', async ({ page }) => {
  await page.addInitScript(() => {
    const tracks: HTMLAudioElement[] = [];
    const OriginalAudio = window.Audio;
    (window as any).kineticMusicTracks = tracks;
    (window as any).Audio = function (src?: string) {
      const audio = new OriginalAudio(src);
      if (src?.endsWith('bgm.mp3')) tracks.push(audio);
      return audio;
    };
    (window as any).Audio.prototype = OriginalAudio.prototype;
  });
  await page.goto('/');
  await page.waitForFunction(() => window.kineticTest?.game.scene.isActive('MenuScene'));
  await page.mouse.click(10, 10);
  await page.waitForFunction(() => {
    const track = (window as any).kineticMusicTracks[0];
    return track && !track.paused && track.currentTime > 0;
  });
  await page.evaluate(() => {
    const track = (window as any).kineticMusicTracks[0];
    (window as any).kineticMusicPauses = 0;
    track.addEventListener('pause', () => (window as any).kineticMusicPauses++);
  });
  const assertPlaying = async () => {
    expect(await page.evaluate(() => {
      const tracks = (window as any).kineticMusicTracks;
      return { count: tracks.length, paused: tracks[0].paused, muted: tracks[0].muted,
        loop: tracks[0].loop, pauses: (window as any).kineticMusicPauses };
    })).toEqual({ count: 1, paused: false, muted: false, loop: true, pauses: 0 });
  };
  const startGame = async () => {
    await page.evaluate(() => {
      const { game, store } = window.kineticTest;
      game.scene.scenes.forEach((scene: any) => {
        if (scene.scene.isActive() || scene.scene.isPaused()) game.scene.stop(scene.sys.settings.key);
      });
      store.getState().setCurrentLevel(1);
      game.scene.start('GameScene');
    });
    await page.waitForFunction(() => window.kineticTest.game.scene.isActive('GameScene'));
  };
  for (const result of ['WIN', 'STUCK']) {
    await startGame();
    const before = await page.evaluate(() => (window as any).kineticMusicTracks[0].currentTime);
    await page.evaluate(result => window.kineticTest.game.scene.getScene('GameScene').endLevel(result), result);
    await page.waitForFunction(() => window.kineticTest.game.scene.isActive('GameOverScene'));
    await assertPlaying();
    expect(await page.evaluate(() => (window as any).kineticMusicTracks[0].currentTime)).toBeGreaterThan(before);
  }
  await startGame();
  await page.evaluate(() => {
    const { game } = window.kineticTest;
    game.scene.pause('GameScene'); game.scene.getScene('GameScene').scene.launch('PauseScene');
  });
  await page.waitForFunction(() => window.kineticTest.game.scene.isActive('PauseScene'));
  await assertPlaying();
  await page.evaluate(() => {
    const scene = window.kineticTest.game.scene.getScene('PauseScene');
    const button = scene.children.list.find((object: any) => object.list?.some((child: any) => child.text === 'MAIN MENU'));
    button.emit('pointerdown'); button.emit('pointerup');
  });
  await page.waitForFunction(() => window.kineticTest.game.scene.isActive('MenuScene'));
  await assertPlaying();
  for (const key of ['LevelSelectScene', 'CosmeticsScene']) {
    await page.evaluate(key => window.kineticTest.game.scene.getScenes(true)[0].scene.start(key), key);
    await page.waitForFunction(key => window.kineticTest.game.scene.isActive(key), key);
    await assertPlaying();
  }
  expect(await page.evaluate(() => {
    const { store } = window.kineticTest, manager = (window as any).AudioManager;
    const track = (window as any).kineticMusicTracks[0];
    store.getState().toggleAudio(); manager.refreshEnabledBuses(); const off = track.muted;
    store.getState().toggleAudio(); manager.refreshEnabledBuses(); const on = !track.muted;
    manager.duckForAd(true); const ad = track.muted;
    manager.duckForAd(false); const restored = !track.muted;
    return { off, on, ad, restored };
  })).toEqual({ off: true, on: true, ad: true, restored: true });
  await assertPlaying();
});
