import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
// The dev-only bridge provides live Phaser objects; no duplicated gameplay transitions.
interface Bridge { game:any;store:any;levels:any[];solutions:Record<number,{blockId:string;dir:string}[]> }
declare global {interface Window {kineticTest:Bridge;kineticPlaytest:any}}
const exported=process.env.LEVEL_TEST_CAMPAIGN?JSON.parse(readFileSync(process.env.LEVEL_TEST_CAMPAIGN,'utf8')):undefined;
let campaignPage:Page;
test.beforeAll(async({browser})=>{
  if(!exported)return;
  campaignPage=await browser.newPage();
  await campaignPage.goto('/');
  await campaignPage.waitForFunction(()=>window.kineticTest?.game.scene.isActive('MenuScene'));
});
test.afterAll(async()=>{if(campaignPage)await campaignPage.close();});
const ids:number[]=exported?exported.levels.map((l:any)=>l.id):[1,3,5,73,74,75,76,77,78,79,80];
for(const id of ids) test(`live Phaser replay L${id} matches pure rules after animation`,async({page:isolatedPage})=>{
  const page=exported?campaignPage:isolatedPage;
  const errors:string[]=[];const onError=(e:Error)=>{errors.push(e.message);console.error('Browser error:',e.message);};page.on('pageerror',onError);
  if(!exported){await page.goto('/');await page.waitForFunction(()=>window.kineticTest?.game.scene.isActive('MenuScene'));}

    const result=await page.evaluate(async(id)=>{
      const {game,store,solutions}=window.kineticTest;
      const previousGrid=game.scene.getScene('GameScene').grid;
      // Stop through the manager immediately: ScenePlugin.stop queues a stop
      // that can destroy the next GameScene after it has already started.
      for(const scene of game.scene.scenes)if(scene.scene.isActive())game.scene.stop(scene.sys.settings.key);
      store.getState().setCurrentLevel(id);game.scene.start('GameScene');
      const sleep=()=>new Promise(r=>setTimeout(r,10));let scene:any;
      for(let i=0;i<1000;i++){scene=game.scene.getScene('GameScene');if(scene.grid&&scene.grid!==previousGrid&&scene.blocks?.length&&scene.restartBtn&&game.scene.isActive('GameScene'))break;await sleep();}
      scene.time.timeScale=30;scene.tweens.timeScale=30;scene.tutorial?.destroy();scene.tutorial=undefined;scene.dialogue?.destroy();scene.dialogue=undefined;
      const transitions:any[]=[];
      // Suppress scene navigation only, preserving actual movement and unlock processing.
      let won=false;scene.endLevel=(result:string)=>{won=result==='WIN';};
      for(const action of solutions[id]){
        const b=scene.blocks.find((b:any)=>b.blockId===action.blockId);
        if(!b||b.removed)throw new Error(`Missing replay block L${id} ${action.blockId}`);
        scene.handleSwipe(b,action.dir);
        for(let i=0;i<1000&&scene.busy;i++)await sleep();
        if(scene.busy)throw new Error(`Animation did not finish L${id} ${action.blockId} ${action.dir}; active=${scene.scene.isActive()} tweens=${scene.tweens.getTweensOf(b).length}`);
        transitions.push({blocks:scene.blocks.map((b:any)=>({id:b.blockId,pos:[...b.gridPos],removed:b.removed})),exitCount:scene.grid.getExitCount()});
        for(const block of scene.blocks)if(!block.removed&&scene.grid.getOccupant(...block.gridPos)!==block)throw new Error('Occupancy mismatch');
      }
      return {won,transitions,colors:scene.blocks.filter((b:any)=>b.type!=='obstacle').map((b:any)=>({type:b.type,color:b.color,fill:b.fillColor()}))};
    },id);
    expect(result.won,`L${id}`).toBe(true);
    const colors:Record<string,{color:string;fill:number}>={simple:{color:'red',fill:0xe56b6f},constrained:{color:'yellow',fill:0xffd96a},dependent:{color:'blue',fill:0x7fb7e8},lock:{color:'purple',fill:0xc9a4d8}};
    for(const block of result.colors)expect({color:block.color,fill:block.fill}).toEqual(colors[block.type]);
    const { LEVELS,SOLUTIONS }=await import('../../../../src/config/Levels');
    const { replaySolution }=await import('../../../../src/core/puzzle/SolutionReplay');
    const expected=replaySolution((exported?.levels??LEVELS).find((l:any)=>l.id===id)!, (exported?.solutions??SOLUTIONS)[id]);
    expect(result.transitions.map(t=>({exitCount:t.exitCount,blocks:t.blocks.map((b:any)=>[b.id,b.removed?null:b.pos])}))).toEqual(expected.transitions.map(t=>({exitCount:t.state.exitCount,blocks:t.state.blocks.map(b=>[b.blockId,b.removed?null:b.gridPos])})));
  expect(errors).toEqual([]);
  page.off('pageerror',onError);
});
test('Undo is unavailable; restart resets moves and the complete board; consent defaults off', async ({page}) => {
  await page.goto('/'); await page.waitForFunction(() => window.kineticTest?.game.scene.isActive('MenuScene'));
  const result = await page.evaluate(async () => {
    const {game,store,solutions} = window.kineticTest, sleep = () => new Promise(r => setTimeout(r,10));
    game.scene.stop('MenuScene'); store.getState().setCurrentLevel(2); game.scene.start('GameScene');
    const scene = game.scene.getScene('GameScene');
    for(let i=0;i<1000;i++){if(scene.grid&&scene.restartBtn&&scene.blocks?.length)break;await sleep();}
    scene.time.timeScale=30; scene.tweens.timeScale=30; scene.tutorial?.destroy(); scene.tutorial=undefined; scene.dialogue?.destroy(); scene.dialogue=undefined;
    const initial = scene.blocks.map((b:any)=>({id:b.blockId,pos:[...b.gridPos],removed:b.removed})), action=solutions[2][0];
    scene.handleSwipe(scene.blocks.find((b:any)=>b.blockId===action.blockId),action.dir); while(scene.busy)await sleep();
    const moves=store.getState().movesThisLevel, oldGrid=scene.grid, noUndo=typeof scene.undo==='undefined'&&typeof scene.undoBtn==='undefined';
    scene.scene.restart(); for(let i=0;i<1000;i++){if(scene.grid!==oldGrid&&scene.restartBtn&&scene.blocks?.length)break;await sleep();}
    return {noUndo,moves,restartedMoves:store.getState().movesThisLevel,initial,restarted:scene.blocks.map((b:any)=>({id:b.blockId,pos:[...b.gridPos],removed:b.removed})),telemetry:window.kineticPlaytest.exportJsonl()};
  });
  expect(result.noUndo).toBe(true); expect(result.moves).toBe(1); expect(result.restartedMoves).toBe(0); expect(result.restarted).toEqual(result.initial); expect(result.telemetry).toBe('');
});

test('playtest consent panel exports locally and revocation deletes data',async({page})=>{
  await page.goto('/?playtest=1');await page.waitForFunction(()=>window.kineticTest?.game.scene.isActive('MenuScene'));
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Collection disabled · 0 attempts')).toBeVisible();
  await page.getByRole('button',{name:'Enable collection',exact:true}).click();
  await expect(page.getByText('Collection enabled · 0 attempts')).toBeVisible();
  await page.evaluate(()=>{window.kineticPlaytest.start(1,false);window.kineticPlaytest.increment('moveCount');window.kineticPlaytest.finish(true);});
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSONL',exact:true}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('kinetic-playtest.jsonl');
  await page.getByRole('button',{name:'Revoke and delete',exact:true}).click();
  expect(await page.evaluate(()=>window.kineticPlaytest.exportJsonl())).toBe('');
  expect(await page.evaluate(()=>localStorage.getItem('kinetic-local-playtest-v2'))).toBeNull();
});

test('playtest sample navigation opens levels directly with explicit consent',async({page})=>{
  page.on('pageerror',error=>console.error(error.message));
  await page.goto('/?playtest=1');
  await page.waitForFunction(()=>window.kineticTest?.game.scene.isActive('MenuScene'));
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Collection disabled · 0 attempts')).toBeVisible();
  const first=exported&&exported.levels.length<=20?2:41,next=exported&&exported.levels.length<=20?3:55;
  await page.getByLabel('Playtest level').selectOption(String(first));
  await page.getByRole('button',{name:'Start selected level'}).click();
  await page.waitForFunction(id=>window.kineticTest.store.getState().currentLevel===id&&window.kineticTest.game.scene.getScene('GameScene').grid&&window.kineticTest.game.scene.isActive('GameScene'),first);
  expect(await page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
  expect(await page.evaluate(()=>window.kineticPlaytest.exportJsonl())).toBe('');
  await page.getByRole('button',{name:'Playtest',exact:true}).click();
  await page.getByRole('button',{name:'Enable collection'}).click();
  await page.getByRole('button',{name:'Next sample'}).click();
  await page.waitForFunction(id=>window.kineticTest.store.getState().currentLevel===id&&window.kineticTest.game.scene.isActive('GameScene'),next);
  await page.waitForTimeout(500);
  await page.getByRole('button',{name:'Playtest',exact:true}).click();
  await page.getByRole('button',{name:'Start selected level'}).click();
  await page.waitForFunction(()=>window.kineticPlaytest.count>=1);
  const rows=await page.evaluate(()=>window.kineticPlaytest.exportJsonl());
  expect(JSON.parse(rows.split('\n')[0])).toMatchObject({levelId:next,mode:'HUMAN',completed:false});
  await page.getByRole('button',{name:'Playtest',exact:true}).click();
  await page.getByRole('button',{name:'Revoke and delete'}).click();
  expect(await page.evaluate(()=>window.kineticPlaytest.exportJsonl())).toBe('');
});
