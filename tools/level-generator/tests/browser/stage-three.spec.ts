import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
const campaign = process.env.LEVEL_TEST_CAMPAIGN ? JSON.parse(readFileSync(process.env.LEVEL_TEST_CAMPAIGN, 'utf8')) : undefined;
test.beforeEach(() => test.skip(!campaign?.stageConfig || campaign.levels.length < 60, 'Complete Stage 3 snapshot required'));

test('Stage 2 save retains completion and unlocks Precision while unpublished Stage 4 stays locked', async ({ page }) => {
  const { levelContentVersion } = await import('../../../../src/core/puzzle/LevelVersion');
  const pointer = JSON.parse(readFileSync('generated/runs/stage-two/latest.json', 'utf8'));
  const old = JSON.parse(readFileSync(pointer.campaignPath, 'utf8'));
  const completedLevels = Object.fromEntries(old.levels.map((level: any) => [level.id, { levelVersion: levelContentVersion(level) }]));
  await page.addInitScript(({ old, completedLevels }) => {
    localStorage.setItem(`fpp-game-state-v3-${old.campaignId}`, JSON.stringify({ version: 3, state: {
      campaignId: old.campaignId, campaignVersion: old.campaignVersion, currentLevel: 40, completedLevels,
      tutorialSeen: [], audioEnabled: false, sfxEnabled: false,
    } }));
  }, { old, completedLevels });
  await page.goto('/'); await page.waitForFunction(() => window.kineticTest?.game.scene.isActive('MenuScene'));
  expect(await page.evaluate(() => {
    const { store, levels } = window.kineticTest, state = store.getState();
    return { count: levels.length, completed: levels.slice(0, 40).every((level: any) => state.isCompleted(level.id)),
      unlocked: state.unlockedLevel, stage3: state.canPlay(41), stage4: state.canPlay(61), muted: !state.audioEnabled };
  })).toEqual({ count: 60, completed: true, unlocked: 41, stage3: true, stage4: false, muted: true });
  await page.evaluate(() => window.kineticTest.game.scene.getScene('MenuScene').scene.start('LevelSelectScene', { activePackId: 'stage-3' }));
  await page.waitForFunction(() => window.kineticTest.game.scene.isActive('LevelSelectScene'));
  expect(await page.evaluate(() => window.kineticTest.game.scene.getScene('LevelSelectScene').cameras.main.backgroundColor.color)).toBe(0xffeed5);
  await page.evaluate(() => {
    const { game, store } = window.kineticTest;
    game.scene.stop('LevelSelectScene'); store.getState().setCurrentLevel(41); game.scene.start('GameScene');
  });
  await page.waitForFunction(() => window.kineticTest.game.scene.isActive('GameScene'));
  expect(await page.evaluate(() => {
    const scene = window.kineticTest.game.scene.getScene('GameScene');
    return { bg: scene.cameras.main.backgroundColor.color, limit: scene.moveBudget, tutorial: !!scene.dialogue };
  })).toEqual({ bg: 0xffeed5, limit: campaign.solutions[41].length + 1, tutorial: false });
});
