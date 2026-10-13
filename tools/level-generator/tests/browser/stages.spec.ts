import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
const campaign = process.env.LEVEL_TEST_CAMPAIGN ? JSON.parse(readFileSync(process.env.LEVEL_TEST_CAMPAIGN,'utf8')) : undefined;
test.beforeEach(async ({page}) => {
  test.skip(!campaign?.stageConfig, 'Staged campaign integration suite');
  await page.goto('/'); await page.waitForFunction(() => window.kineticTest?.game.scene.isActive('MenuScene'));
});
async function start(page:Page,id:number,dialogue=false) {
  await page.evaluate(async ({id,dialogue}) => {
    const {game,store}=window.kineticTest, oldGrid=game.scene.getScene('GameScene').grid;
    for(const scene of game.scene.scenes)if(scene.scene.isActive()||scene.scene.isPaused())game.scene.stop(scene.sys.settings.key);
    store.getState().setCurrentLevel(id); game.scene.start('GameScene');
    const sleep=()=>new Promise(r=>setTimeout(r,10)),scene=game.scene.getScene('GameScene');
    for(let i=0;i<1000;i++){if(scene.grid&&scene.grid!==oldGrid&&scene.restartBtn&&scene.blocks.length)break;await sleep();}
    if(!dialogue){scene.dialogue?.destroy();scene.dialogue=undefined;}
    scene.time.timeScale=20;scene.tweens.timeScale=20;
  },{id,dialogue});
}
test('spotlight tutorial keeps its target clear, responds to correct actions, and can be replayed',async({page})=>{
  await start(page,1,true);
  const layout=await page.evaluate(()=>{
    const scene=window.kineticTest.game.scene.getScene('GameScene'), panel=scene.dialogue.panel;
    return {speaker:panel.list.some((o:any)=>o.name==='red-speaker'), overlay:!!scene.children.getByName('tutorial-overlay'), panelX:panel.x,index:scene.dialogue.session.index,moves:window.kineticTest.store.getState().movesThisLevel};
  });
  expect(layout.speaker).toBe(true);expect(layout.overlay).toBe(true);expect(layout.panelX).toBe(960);expect(layout.moves).toBe(0);
  const next=await page.evaluate(()=>{
    const scene=window.kineticTest.game.scene.getScene('GameScene'),rect=window.kineticTest.game.canvas.getBoundingClientRect();
    const button=scene.dialogue.panel.getByName('tutorial-next');
    return {x:rect.left+(scene.dialogue.panel.x+button.x)/1920*rect.width,y:rect.top+(scene.dialogue.panel.y+button.y)/1080*rect.height};
  });
  await page.mouse.click(next.x,next.y);
  await page.waitForFunction(()=>window.kineticTest.game.scene.getScene('GameScene').dialogue.session.index===1);
  const state=await page.evaluate(async()=>{
    const {game,store}=window.kineticTest,scene=game.scene.getScene('GameScene'),expected=scene.dialogue.session.current.action;
    const wrong=scene.blocks.find((b:any)=>b.type==='simple'&&b.blockId!==expected.blockId);
    scene.handleSwipe(wrong,expected.dir);
    const indexAfterWrong=scene.dialogue.session.index,movesAfterWrong=store.getState().movesThisLevel;
    scene.handleSwipe(scene.blocks.find((b:any)=>b.blockId===expected.blockId),expected.dir);
    while(scene.busy)await new Promise(r=>setTimeout(r,10));
    const indexAfterCorrect=scene.dialogue.session.index;
    scene.dialogue.skip();
    const seen=store.getState().hasSeenTutorial(1,'dialogue-1');
    const oldGrid=scene.grid;scene.registry.set('replayTutorial',true);scene.scene.restart();
    for(let i=0;i<1000;i++){if(scene.grid!==oldGrid&&scene.dialogue?.panel&&scene.restartBtn)break;await new Promise(r=>setTimeout(r,10));}
    return {indexAfterWrong,movesAfterWrong,indexAfterCorrect,seen,replayIndex:scene.dialogue.session.index,moves:store.getState().movesThisLevel};
  });
  expect(state).toEqual({indexAfterWrong:1,movesAfterWrong:0,indexAfterCorrect:2,seen:true,replayIndex:0,moves:0});
  await page.screenshot({path:test.info().outputPath('tutorial-overlay.png')});
});
test('spotlight tutorial allows real swipes in every guided direction and cleans up on skip', async ({page}) => {
  await start(page, 3, true);
  await page.waitForFunction(() => !window.kineticTest.game.scene.getScene('GameScene').cameras.main.fadeEffect.isRunning);
  const clickButton = async (name: string) => {
    const point = await page.evaluate(name => {
      const { game } = window.kineticTest, scene = game.scene.getScene('GameScene');
      const panel = scene.dialogue.panel, button = panel.getByName(name), rect = game.canvas.getBoundingClientRect();
      return { x: rect.left + (panel.x + button.x) / 1920 * rect.width, y: rect.top + (panel.y + button.y) / 1080 * rect.height };
    }, name);
    await page.mouse.click(point.x, point.y);
  };
  await clickButton('tutorial-next');
  await page.screenshot({path: test.info().outputPath('tutorial-after-next.png')});
  await page.waitForFunction(() => window.kineticTest.game.scene.getScene('GameScene').dialogue.session.index === 1, undefined, { timeout: 15000 });
  for (let i = 0; i < 20; i++) {
    await page.waitForFunction(() => {
      const scene = window.kineticTest.game.scene.getScene('GameScene');
      return scene.blocks.every((block: any) => {
        const center = scene.dialogue.blockCenter(block);
        return block.removed || Math.abs(block.x - center.x) < 1 && Math.abs(block.y - center.y) < 1;
      });
    });
    const step = await page.evaluate(() => {
      const { game } = window.kineticTest, scene = game.scene.getScene('GameScene'), dialogue = scene.dialogue;
      const current = dialogue.session.current;
      if (!current?.action) return null;
      const block = scene.blocks.find((b: any) => b.blockId === current.action.blockId);
      const panel = dialogue.panel, focus = dialogue.focusArea(current), rect = game.canvas.getBoundingClientRect();
      const overlaps = panel.x - panel.width / 2 < focus.right && panel.x + panel.width / 2 > focus.left && panel.y - panel.height / 2 < focus.bottom && panel.y + panel.height / 2 > focus.top;
      return { index: dialogue.session.index, dir: current.action.dir, overlaps,
        onScreen: panel.x - panel.width / 2 >= 0 && panel.x + panel.width / 2 <= 1920 && panel.y - panel.height / 2 >= 0 && panel.y + panel.height / 2 <= 1080,
        x: rect.left + block.x / 1920 * rect.width, y: rect.top + block.y / 1080 * rect.height };
    });
    if (!step) break;
    expect(step.overlaps).toBe(false); expect(step.onScreen).toBe(true);
    const dx = step.dir === 'LEFT' ? -90 : step.dir === 'RIGHT' ? 90 : 0;
    const dy = step.dir === 'UP' ? -90 : step.dir === 'DOWN' ? 90 : 0;
    await page.mouse.move(step.x, step.y); await page.mouse.down();
    await page.mouse.move(step.x + dx, step.y + dy, { steps: 5 }); await page.mouse.up();
    await page.waitForFunction(index => {
      const scene = window.kineticTest.game.scene.getScene('GameScene');
      return scene.dialogue.session.index > index && !scene.busy;
    }, step.index, { timeout: 15000 }).catch(async error => {
      await page.screenshot({ path: test.info().outputPath(`tutorial-step-${step.index}.png`) });
      throw new Error(`Tutorial swipe ${step.index} (${step.dir}) did not advance: ${error}`);
    });
  }
  expect(await page.evaluate(() => window.kineticTest.game.scene.getScene('GameScene').dialogue.session.current?.action)).toBeUndefined();
  await clickButton('tutorial-skip');
  await page.waitForFunction(() => !window.kineticTest.game.scene.getScene('GameScene').children.getByName('tutorial-overlay'));
  expect(await page.evaluate(() => {
    const { game, store } = window.kineticTest, scene = game.scene.getScene('GameScene');
    return { panel: !!scene.dialogue.panel, highlights: !!scene.dialogue.highlights, seen: store.getState().hasSeenTutorial(3, 'dialogue-1') };
  })).toEqual({ panel: false, highlights: false, seen: true });
});
test('success has no stars, persists completion after reload, and retains future stage locks',async({page})=>{
  await start(page,1);
  await page.evaluate(async()=>{
    const {game,solutions}=window.kineticTest,scene=game.scene.getScene('GameScene');
    for(const action of solutions[1]){scene.handleSwipe(scene.blocks.find((b:any)=>b.blockId===action.blockId),action.dir);while(scene.busy)await new Promise(r=>setTimeout(r,10));}
  });
  await page.waitForFunction(()=>window.kineticTest.game.scene.isActive('GameOverScene'));
  const result=await page.evaluate(()=>{
    const {game,store}=window.kineticTest,scene=game.scene.getScene('GameOverScene');
    const texts=scene.children.list.filter((o:any)=>typeof o.text==='string').map((o:any)=>o.text);
    return {texts,completed:store.getState().isCompleted(1),unlocked:store.getState().unlockedLevel,unpublishedCompleted:store.getState().isCompleted(21)};
  });
  expect(result.texts).toContain('SUCCESS!');expect(result.texts.join(' ')).not.toMatch(/★|STAR|PAR /);expect(result.completed).toBe(true);expect(result.unlocked).toBe(2);expect(result.unpublishedCompleted).toBe(false);
  await page.reload();await page.waitForFunction(()=>window.kineticTest?.game.scene.isActive('MenuScene'));
  expect(await page.evaluate(()=>window.kineticTest.store.getState().isCompleted(1))).toBe(true);
  await page.evaluate(()=>window.kineticTest.game.scene.start('LevelSelectScene'));
  await page.waitForFunction(()=>window.kineticTest.game.scene.isActive('LevelSelectScene'));
  const labels=await page.evaluate(()=>{
    const scene=window.kineticTest.game.scene.getScene('LevelSelectScene'), texts:string[]=[];
    const walk=(o:any)=>{if(typeof o.text==='string')texts.push(o.text);if(o.list)o.list.forEach(walk);};scene.children.list.forEach(walk);return texts;
  });
  expect(labels.join(' ')).toContain('SOON');expect(labels.join(' ')).toContain('1/20');
});
test('move cap rejects unfinished last move and accepts a win at the cap; invalid swipe uses no move',async({page})=>{
  await start(page,3);
  const invalid=await page.evaluate(()=>{
    const {game,store}=window.kineticTest,scene=game.scene.getScene('GameScene'),yellow=scene.blocks.find((b:any)=>b.type==='constrained');
    scene.handleSwipe(yellow,yellow.direction==='UP'?'DOWN':'UP');return store.getState().movesThisLevel;
  });expect(invalid).toBe(0);
  await start(page,2);
  await page.evaluate(async()=>{
    const {game,solutions}=window.kineticTest,scene=game.scene.getScene('GameScene'),action=solutions[2][0];
    scene.moveBudget=1;scene.handleSwipe(scene.blocks.find((b:any)=>b.blockId===action.blockId),action.dir);while(scene.busy)await new Promise(r=>setTimeout(r,10));
  });
  await page.waitForFunction(()=>window.kineticTest.game.scene.isActive('GameOverScene'));
  const failed=await page.evaluate(()=>{
    const {game,store}=window.kineticTest,scene=game.scene.getScene('GameOverScene');return {texts:scene.children.list.filter((o:any)=>typeof o.text==='string').map((o:any)=>o.text),completed:store.getState().isCompleted(2)};
  });expect(failed.texts).toContain('FAILED');expect(failed.texts.join(' ')).toContain('Move limit reached');expect(failed.completed).toBe(false);
  await start(page,1);
  await page.evaluate(async()=>{
    const {game,solutions}=window.kineticTest,scene=game.scene.getScene('GameScene');scene.moveBudget=solutions[1].length;
    for(const action of solutions[1]){scene.handleSwipe(scene.blocks.find((b:any)=>b.blockId===action.blockId),action.dir);while(scene.busy)await new Promise(r=>setTimeout(r,10));}
  });
  await page.waitForFunction(()=>window.kineticTest.game.scene.isActive('GameOverScene'));
  expect(await page.evaluate(()=>window.kineticTest.store.getState().isCompleted(1))).toBe(true);
});
test('hint never moves blocks, increments moves, or completes the level',async({page})=>{
  await start(page,2);
  const state=await page.evaluate(async()=>{
    const {game,store}=window.kineticTest,scene=game.scene.getScene('GameScene');
    const board=()=>JSON.stringify(scene.blocks.map((b:any)=>[b.blockId,b.gridPos,b.removed]));
    const before=board();await scene.requestHint();return {before,after:board(),moves:store.getState().movesThisLevel,completed:store.getState().isCompleted(2),hint:scene.hintMessage?.text};
  });expect(state.after).toBe(state.before);expect(state.moves).toBe(0);expect(state.completed).toBe(false);expect(state.hint).toMatch(/^TRY /);
});
test('autoplay leaves completion and unlocks unchanged',async({page})=>{
  await page.evaluate(()=>{
    const {game,store}=window.kineticTest;store.getState().setCurrentLevel(1);game.registry.set('autoplaySolution',true);game.scene.stop('MenuScene');game.scene.start('GameScene');
  });
  await page.waitForFunction(()=>window.kineticTest.game.scene.getScene('GameScene').attemptIsAutoplay&&window.kineticTest.game.scene.getScene('GameScene').restartBtn);
  await page.evaluate(()=>{const scene=window.kineticTest.game.scene.getScene('GameScene');scene.time.timeScale=30;scene.tweens.timeScale=30;});
  await page.waitForFunction(()=>!window.kineticTest.game.scene.getScene('GameScene').attemptIsAutoplay&&!!window.kineticTest.game.scene.getScene('GameScene').restartBtn);
  expect(await page.evaluate(()=>({completed:window.kineticTest.store.getState().isCompleted(1),unlocked:window.kineticTest.store.getState().unlockedLevel}))).toEqual({completed:false,unlocked:1});
});

test('matching legacy stars migrate once without awarding a different campaign',async({page})=>{
  await page.evaluate(({campaignId,campaignVersion})=>{
    localStorage.removeItem(`fpp-game-state-v3-${campaignId}`);
    localStorage.setItem(`fpp-game-state-v2-${campaignId}-${campaignVersion}`,JSON.stringify({version:0,state:{campaignId,campaignVersion,bestStars:{1:3},tutorialSeenLevels:[1],equippedPalette:'classic'}}));
  },{campaignId:campaign.campaignId,campaignVersion:campaign.campaignVersion});
  await page.reload();await page.waitForFunction(()=>window.kineticTest?.game.scene.isActive('MenuScene'));
  expect(await page.evaluate(()=>({completed:window.kineticTest.store.getState().isCompleted(1),unlocked:window.kineticTest.store.getState().unlockedLevel,tutorial:window.kineticTest.store.getState().hasSeenTutorial(1)}))).toEqual({completed:true,unlocked:2,tutorial:false});
  await page.reload();await page.waitForFunction(()=>window.kineticTest?.game.scene.isActive('MenuScene'));
  expect(await page.evaluate(()=>window.kineticTest.store.getState().isCompleted(1))).toBe(true);
});
