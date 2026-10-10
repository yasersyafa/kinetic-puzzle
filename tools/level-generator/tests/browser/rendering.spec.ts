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

test('all five block bodies share sharp cached textures while icons, unlocks and offsets remain independent', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.kineticTest?.game.scene.isActive('MenuScene'));
  const result = await page.evaluate(async () => {
    const { game, store } = window.kineticTest;
    game.scene.stop('MenuScene'); store.getState().setCurrentLevel(2); game.scene.start('GameScene');
    const scene = game.scene.getScene('GameScene'), sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 1000 && !scene.restartBtn; i++) await sleep(10);
    const Block = scene.blocks[0].constructor, grid = scene.grid;
    scene.time.timeScale = 20; scene.tweens.timeScale = 20;
    const fixtures = ['simple', 'constrained', 'dependent', 'lock', 'obstacle'].map((type, i) => ({
      id: `cache-test-${i}`, type, position: [0, 0], size: [1, 1], direction: type === 'constrained' ? 'LEFT' : undefined,
      dependsOn: type === 'dependent' ? 'cache-test-0' : undefined, unlockAt: type === 'lock' ? 2 : undefined,
    }));
    const pairs = fixtures.map(data => [new Block(scene, data, grid), new Block(scene, { ...data, id: `${data.id}-copy` }, grid)]);
    const details = pairs.map(([first, second]) => {
      const body = first.bodyImage, canvas = body.texture.getSourceImage(), context = canvas.getContext('2d');
      const pixel = Array.from(context.getImageData(Math.floor(body.originX * canvas.width), Math.floor(body.originY * canvas.height), 1, 1).data);
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data, fill = first.fillColor();
      let hasFill = false, hasBorder = false;
      for (let i = 0; i < rgba.length; i += 4) {
        if (rgba[i] === (fill >> 16 & 255) && rgba[i + 1] === (fill >> 8 & 255) && rgba[i + 2] === (fill & 255) && rgba[i + 3] === 255) hasFill = true;
        if (rgba[i] === 17 && rgba[i + 1] === 17 && rgba[i + 2] === 17 && rgba[i + 3] === 255) hasBorder = true;
      }
      return { type: first.type, bodyType: body.type, shared: body.texture === second.bodyImage.texture, pixel, hasFill, hasBorder,
        icon: !!first.iconG, displayWidth: body.displayWidth, expectedWidth: Math.ceil((grid.cellSize - 14 + 10) * 2) / 2,
        density: canvas.width / body.displayWidth, originError: body.displayOriginX * body.scaleX - (grid.cellSize - 14) / 2 - 2 };
    });
    const red = pairs[0][0], blue = pairs[2][0], purple = pairs[3][0];
    red.setVisualOffset(5, -4); const offset = [red.bodyImage.x, red.bodyImage.y];
    red.clearVisualOffsetSmooth(20); blue.refreshDependency([{ blockId: 'cache-test-0', removed: true }]);
    grid.registerExit(); grid.registerExit(); purple.refreshLock(grid);
    const wide = new Block(scene, { ...fixtures[0], id: 'wide-cache-test', size: [2, 1] }, grid);
    const distinctSize = wide.bodyImage.texture !== red.bodyImage.texture;
    const sharedTexture = pairs[0][1].bodyImage.texture; red.destroy();
    await sleep(150);
    return { details, offset, independent: pairs[0][1].bodyImage.x === 0 && pairs[0][1].bodyImage.y === 0,
      blueUnlocked: !blue.isLocked(), purpleUnlocked: !purple.isLocked(), countdownHidden: purple.countdownText.alpha === 0,
      textureSurvives: game.textures.exists(sharedTexture.key), distinctSize };
  });
  const expectedColors: Record<string, number[]> = { simple: [229, 107, 111, 255], constrained: [255, 217, 106, 255], dependent: [127, 183, 232, 255], lock: [201, 164, 216, 255] };
  for (const detail of result.details) {
    expect(detail.hasFill).toBe(true); expect(detail.hasBorder).toBe(true);
    expect(detail.bodyType).toBe('Image'); expect(detail.shared).toBe(true); expect(detail.density).toBe(2);
    expect(detail.displayWidth).toBeCloseTo(detail.expectedWidth); expect(detail.originError).toBeCloseTo(0);
    expect(detail.icon).toBe(!['simple', 'obstacle'].includes(detail.type));
    if (expectedColors[detail.type]) expect(detail.pixel).toEqual(expectedColors[detail.type]);
  }
  expect(result).toMatchObject({ offset: [5, -4], independent: true, blueUnlocked: true, purpleUnlocked: true, countdownHidden: true, textureSurvives: true, distinctSize: true });
});
