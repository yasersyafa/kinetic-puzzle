import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
const campaign = process.env.LEVEL_TEST_CAMPAIGN ? JSON.parse(readFileSync(process.env.LEVEL_TEST_CAMPAIGN, 'utf8')) : undefined;

test.beforeEach(() => test.skip(!campaign?.stageConfig || campaign.levels.length < 40, 'Complete Stage 2 snapshot required'));

async function openLevel(page: any, id: number) {
  await page.evaluate((id: number) => {
    const { game, store } = window.kineticTest;
    game.scene.scenes.forEach((scene: any) => { if (scene.scene.isActive() || scene.scene.isPaused()) game.scene.stop(scene.sys.settings.key); });
    store.getState().setCurrentLevel(id); game.scene.start('GameScene');
  }, id);
  await page.waitForFunction(() => window.kineticTest.game.scene.isActive('GameScene'));
}

test('stage palettes follow replayed levels and selected tabs; manual palette controls are removed', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fpp-shared-preferences-v1', JSON.stringify({ audioEnabled: true, sfxEnabled: true, equippedPalette: 'sunset' })));
  await page.goto('/'); await page.waitForFunction(() => window.kineticTest?.game.scene.isActive('MenuScene'));
  expect(await page.evaluate(() => {
    const { game, store } = window.kineticTest;
    const scene = game.scene.getScene('MenuScene');
    return { cosmetics: game.scene.scenes.some((s: any) => s.sys.settings.key === 'CosmeticsScene'),
      button: scene.children.list.some((o: any) => o.list?.some((c: any) => c.text === 'PALETTE')),
      manualState: 'equippedPalette' in store.getState(), bg: scene.cameras.main.backgroundColor.color };
  })).toEqual({ cosmetics: false, button: false, manualState: false, bg: 0xfbf3d5 });
  await openLevel(page, 21);
  expect(await page.evaluate(() => {
    const scene = window.kineticTest.game.scene.getScene('GameScene');
    return { bg: scene.cameras.main.backgroundColor.color, limit: scene.moveBudget,
      red: scene.blocks.find((b: any) => b.type === 'simple').fillColor() };
  })).toMatchObject({ bg: 0xe0f0f5, red: 0xe56b6f, limit: campaign.solutions[21].length + 2 });
  await openLevel(page, 1);
  expect(await page.evaluate(() => window.kineticTest.game.scene.getScene('GameScene').cameras.main.backgroundColor.color)).toBe(0xfbf3d5);
  await page.evaluate(() => window.kineticTest.game.scene.getScene('GameScene').scene.start('LevelSelectScene', { activePackId: 'stage-2' }));
  await page.waitForFunction(() => window.kineticTest.game.scene.isActive('LevelSelectScene'));
  expect(await page.evaluate(() => window.kineticTest.game.scene.getScene('LevelSelectScene').cameras.main.backgroundColor.color)).toBe(0xe0f0f5);
});

test('append preserves Stage 1 progress and requires Connections completion before Stage 3', async ({ page }) => {
  const { levelContentVersion } = await import('../../../../src/core/puzzle/LevelVersion');
  const old = JSON.parse(readFileSync('generated/runs/stage-one/approved/kinetic-stages-3bacc398317c-192dac966e1b/campaign.json', 'utf8'));
  const completedLevels = Object.fromEntries(old.levels.map((level: any) => [level.id, { levelVersion: levelContentVersion(level) }]));
  await page.addInitScript(({ old, completedLevels }) => {
    localStorage.setItem(`fpp-game-state-v3-${old.campaignId}`, JSON.stringify({ version: 3, state: {
      campaignId: old.campaignId, campaignVersion: old.campaignVersion, currentLevel: 20, completedLevels, tutorialSeen: [], equippedPalette: 'sunset', audioEnabled: false, sfxEnabled: false,
    } }));
  }, { old, completedLevels });
  await page.goto('/'); await page.waitForFunction(() => window.kineticTest?.game.scene.isActive('MenuScene'));
  expect(await page.evaluate(() => {
    const { store, levels } = window.kineticTest, state = store.getState();
    return { count: levels.length, completed: levels.slice(0, 20).every((level: any) => state.isCompleted(level.id)),
      unlocked: state.unlockedLevel, stage2: state.canPlay(21), stage3: state.canPlay(41), muted: !state.audioEnabled };
  })).toEqual({ count: campaign.levels.length, completed: true, unlocked: 21, stage2: true, stage3: false, muted: true });
});

for (const id of [22, 31]) test(`new mechanic tutorial L${id} highlights its locked block then guides a valid prefix`, async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => window.kineticTest?.game.scene.isActive('MenuScene'));
  if (id === 22) await page.evaluate(() => window.kineticTest.store.getState().markTutorialSeen(22, 'dialogue-1'));
  await openLevel(page, id);
  if (id === 22) {
    await page.waitForFunction(() => !window.kineticTest.game.scene.getScene('GameScene').cameras.main.fadeEffect.isRunning);
    const next = await page.evaluate(() => {
      const { game } = window.kineticTest, dialogue = game.scene.getScene('GameScene').dialogue;
      const panel = dialogue.panel, button = panel.getByName('tutorial-next'), rect = game.canvas.getBoundingClientRect();
      return { x: rect.left + (panel.x + button.x) / 1920 * rect.width, y: rect.top + (panel.y + button.y) / 1080 * rect.height };
    });
    // Use the player's real NEXT click, including the browser's first-gesture fullscreen transition.
    await page.mouse.click(next.x, next.y);
    await page.waitForFunction(() => window.kineticTest.game.scene.getScene('GameScene').dialogue.session.index === 1);
    const point = await page.evaluate(() => {
      const { game, store } = window.kineticTest, scene = game.scene.getScene('GameScene'), dialogue = scene.dialogue;
      const target = scene.blocks.find((b: any) => b.blockId === dialogue.session.current.inspectBlockId);
      if (dialogue.panel.getByName('tutorial-next')) throw new Error('Inspect step must require a tap');
      dialogue.next();
      if (dialogue.session.index !== 1) throw new Error('NEXT bypassed the inspect step');
      const rect = game.canvas.getBoundingClientRect();
      return { x: rect.left + target.x / 1920 * rect.width, y: rect.top + target.y / 1080 * rect.height, parent: target.dependsOn, moves: store.getState().movesThisLevel };
    });
    await page.waitForFunction(() => !window.kineticTest.game.scene.getScene('GameScene').cameras.main.fadeEffect.isRunning);
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => window.kineticTest.game.scene.getScene('GameScene').dialogue.session.index === 2, undefined, { timeout: 15000 });
    expect(await page.evaluate(() => {
      const { game, store } = window.kineticTest, scene = game.scene.getScene('GameScene');
      return { parent: scene.dialogue.session.current.highlightParentId, ring: !!scene.children.getByName('tutorial-parent-ring'), moves: store.getState().movesThisLevel };
    })).toEqual({ parent: point.parent, ring: true, moves: point.moves });
  }
  const result = await page.evaluate(async () => {
    const scene = window.kineticTest.game.scene.getScene('GameScene'), dialogue = scene.dialogue;
    scene.time.timeScale = 20; scene.tweens.timeScale = 20;
    const target = scene.blocks.find((b: any) => b.blockId === dialogue.session.steps[0].highlightBlockId);
    const highlighted = !!target && target.isLocked();
    dialogue.next(); let count = 0;
    while (dialogue.session.current?.action && count++ < 25) {
      const action = dialogue.session.current.action;
      const panel = dialogue.panel, focus = dialogue.focusArea(dialogue.session.current);
      if (panel.x - panel.width / 2 < focus.right && panel.x + panel.width / 2 > focus.left && panel.y - panel.height / 2 < focus.bottom && panel.y + panel.height / 2 > focus.top) throw new Error('Tutorial covers swipe lane');
      scene.handleSwipe(scene.blocks.find((b: any) => b.blockId === action.blockId), action.dir);
      while (scene.busy) await new Promise(resolve => setTimeout(resolve, 10));
    }
    const unlocked = !target.isLocked(); dialogue.skip();
    return { highlighted, count, unlocked, overlay: !!scene.children.getByName('tutorial-overlay') };
  });
  expect(result.highlighted).toBe(true); expect(result.unlocked).toBe(true); expect(result.count).toBeGreaterThan(0); expect(result.overlay).toBe(false);
});
