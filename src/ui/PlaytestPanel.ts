import type Phaser from 'phaser';
import { LEVELS, CAMPAIGN_VERSION } from '../config/Levels';
import { SCENE_KEYS } from '../config/Constants';
import { useGameStore } from '../managers/GameStateManager';
import { playerTelemetry } from '../systems/PlayerTelemetry';
/** Explicit tester entrypoint: append ?playtest=1. No collection before opt-in. */
export function installPlaytestPanel(game: Phaser.Game):void {
  if(new URLSearchParams(location.search).get('playtest')!=='1')return;
  const button=document.createElement('button');button.textContent='Playtest';button.style.cssText='position:fixed;right:12px;top:12px;z-index:10000;padding:8px 12px';document.body.append(button);
  const dialog=document.createElement('dialog');dialog.style.cssText='max-width:360px;border-radius:12px;padding:24px;font:16px sans-serif';
  const title=document.createElement('h2');title.textContent='Local playtest';
  const campaign=document.createElement('p');campaign.textContent=`Campaign ${CAMPAIGN_VERSION}`;
  const description=document.createElement('p');description.textContent='With your consent, attempts, active play time, moves, hints and ratings stay in this browser. A random tester ID links your attempts. Playtest data is not uploaded. Recording starts with your next level attempt. Export when you choose; revoke consent to delete local data.';
  const status=document.createElement('p');
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
  const action=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>{fn();refresh();};actions.append(b);};
  const refresh=()=>{status.textContent=`Collection ${playerTelemetry.enabled?'enabled':'disabled'} · ${playerTelemetry.count} attempts`;};
  const selected=document.createElement('select');selected.setAttribute('aria-label','Playtest level');
  const sampleIds=(LEVELS.length<=12?LEVELS.map(l=>l.id):[1,12,25,41,55,64,72,80]).filter(id=>LEVELS.some(level=>level.id===id));
  for(const id of sampleIds){const option=document.createElement('option');option.value=String(id);option.textContent=`Level ${id}`;selected.append(option);}
  const openLevel=(id:number)=>{
    dialog.close();
    for(const scene of game.scene.scenes)if(scene.scene.isActive()||scene.scene.isPaused())game.scene.stop(scene.sys.settings.key);
    game.registry.remove('autoplaySolution');
    useGameStore.getState().setCurrentLevel(id);game.scene.start(SCENE_KEYS.Game);
  };
  actions.append(selected);
  action('Start selected level',()=>openLevel(Number(selected.value)));
  action('Next sample',()=>{selected.selectedIndex=(selected.selectedIndex+1)%sampleIds.length;openLevel(Number(selected.value));});
  action('Enable collection',()=>playerTelemetry.setConsent(true));
  action('Revoke and delete',()=>playerTelemetry.setConsent(false));
  action('Delete attempts',()=>playerTelemetry.clear());
  action('Export JSONL',()=>{const url=URL.createObjectURL(new Blob([playerTelemetry.exportJsonl()],{type:'application/x-ndjson'})),a=document.createElement('a');a.href=url;a.download='kinetic-playtest.jsonl';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  const rating=document.createElement('select');rating.setAttribute('aria-label','Difficulty of last attempt');for(let i=1;i<=5;i++){const option=document.createElement('option');option.value=String(i);option.textContent=`${i} — ${['Very easy','Easy','Medium','Hard','Very hard'][i-1]}`;rating.append(option);}
  action('Rate last attempt',()=>playerTelemetry.rateLast(Number(rating.value)));actions.append(rating);
  action('Close',()=>dialog.close());dialog.append(title,campaign,description,status,actions);document.body.append(dialog);
  button.onclick=()=>{refresh();playerTelemetry.setPaused(true,'playtest-panel');dialog.showModal();};
  const welcome=()=>{if(!game.scene.isActive(SCENE_KEYS.Menu))return;game.events.off('step',welcome);button.click();};game.events.on('step',welcome);dialog.addEventListener('close',()=>playerTelemetry.setPaused(false,'playtest-panel'));
}
