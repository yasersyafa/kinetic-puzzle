import { test, expect } from '@playwright/test';

test('cached background and exits reuse textures; ambient effects reuse a bounded pool across animation cycles', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.kineticTest?.game.scene.isActive('MenuScene'));
  const result = await page.evaluate(async () => {
    const { game, store } = window.kineticTest;
    game.scene.stop('MenuScene'); store.getState().setCurrentLevel(2); game.scene.start('GameScene');
    const scene = game.scene.getScene('GameScene'), sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 1000 && !scene.restartBtn; i++) await sleep(10);
    scene.dialogue?.destroy(); scene.dialogue = undefined;
    const background = scene.children.getByName('cached-dot-background');
    const exit = scene.children.getByName('cached-exit');
    const texture = exit.texture;
    const objects = scene.children.list.filter((o: any) => o.name === 'pooled-effect');
    scene.time.timeScale = 20; scene.tweens.timeScale = 20;
    await sleep(1600);
    const after = scene.children.list.filter((o: any) => o.name === 'pooled-effect');
    const reused = after.length === objects.length && objects.every((o: any) => after.includes(o));
    const oldGrid = scene.grid; scene.scene.restart();
    for (let i = 0; i < 1000 && scene.grid === oldGrid; i++) await sleep(10);
    const nextExit = scene.children.getByName('cached-exit');
    return { backgroundType: background.type, exitType: exit.type, count: after.length, reused,
      textureReused: nextExit.texture === texture, oldDestroyed: objects.every((o: any) => !o.scene),
      poolSizeAfterRestart: scene.children.list.filter((o: any) => o.name === 'pooled-effect').length };
  });
  expect(result).toMatchObject({ backgroundType: 'TileSprite', exitType: 'Image', count: 32, reused: true, textureReused: true, oldDestroyed: true, poolSizeAfterRestart: 32 });
});
