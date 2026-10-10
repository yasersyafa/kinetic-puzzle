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
test('red speaker tutorial preserves board access, responds to correct actions, and can be replayed',async({page})=>{
  await start(page,1,true);
  const layout=await page.evaluate(()=>{
    const scene=window.kineticTest.game.scene.getScene('GameScene'), panel=scene.dialogue.panel;
    return {speaker:panel.list.some((o:any)=>o.name==='red-speaker'), panelRight:panel.x+230,boardLeft:scene.grid.originX,index:scene.dialogue.session.index,moves:window.kineticTest.store.getState().movesThisLevel};
  });
  expect(layout.speaker).toBe(true);expect(layout.panelRight).toBeLessThan(layout.boardLeft);expect(layout.moves).toBe(0);
  const next=await page.evaluate(()=>{
    const scene=window.kineticTest.game.scene.getScene('GameScene'),rect=window.kineticTest.game.canvas.getBoundingClientRect();
    return {x:rect.left+(scene.dialogue.panel.x+115)/1920*rect.width,y:rect.top+633/1080*rect.height};
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
  await page.screenshot({path:'generated/stage-one-tutorial.png'});
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
  expect(labels.join(' ')).toContain('COMING SOON');expect(labels.join(' ')).toContain('1/20 COMPLETED');
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
