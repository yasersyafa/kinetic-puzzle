import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import { LEVELS } from '../../../src/config/Levels';
import { evaluate, evaluateMechanic } from '../evaluation/Evaluators';
import { solve } from '../core/SolverV2';
import { solveBounded } from '../core/BoundedSolver';
import { defaultCurriculum } from '../director/DesignContract';
import { canonicalSignature } from '../evaluation/DiversityEvaluator';
import { generateCandidate } from '../generation/CandidateGenerator';
import { buildPipeline, runPipeline, type PipelineConfig } from '../Pipeline';
import { hash, safeOutput, readJson, runtimeHash,type RuntimeCampaign } from '../output/Artifacts';
import { runAgentTask } from '../director/AgentProvider';
import { calibrate } from '../analytics/Calibration';
import type { LevelData } from '../../../src/types/Game';
const tiny:LevelData={id:1,cols:3,rows:1,blocks:[{id:'a',color:'red',position:[0,0],size:[1,1]}],exits:[{side:'RIGHT',index:0}],parMoves:1};
function temporary(){mkdirSync('generated/tests',{recursive:true});return mkdtempSync(resolve('generated/tests/run-'));}
test('worker bounds independently return solved and timeout',async()=>{
  assert.equal((await solveBounded(tiny)).status,'SOLVED');assert.equal((await solveBounded(tiny,{timeoutMs:0})).status,'TIMEOUT');
});
test('required ice evidence excludes all bypass solutions and respects UNKNOWN',()=>{
  const l=LEVELS.find(l=>l.id===73)!;const result=solve(l);
  // Adding another exit creates a winning bypass; object presence is not proof.
  const bypass:LevelData={...l,exits:[...l.exits,{side:'TOP',index:0}]};
  assert.equal(evaluateMechanic(bypass,solve(bypass),'ice-push',{}).status,'NOT_VERIFIED');
  const forced:LevelData={...l,rows:1,blocks:l.blocks.map(b=>({...b,position:[b.position[0],0]})),exits:[{side:'RIGHT',index:0}],iceCells:[[1,0]]};
  const proof=solve(forced);assert.equal(proof.status,'SOLVED');assert.equal(evaluateMechanic(forced,proof,'ice-push',{}).status,'VERIFIED');
  assert.equal(evaluateMechanic(forced,proof,'ice-push',{timeoutMs:0}).status,'UNKNOWN');
});
test('gate cannot pass incomplete search, missing mechanic or exact duplicates',()=>{
  const c={...defaultCurriculum(1)[0],grid:{minCols:1,maxCols:5,minRows:1,maxRows:5},optimalMoves:{min:1,max:10}};
  assert.equal(evaluate(tiny,c,[],{maxStates:1}).decision,'HOLD');
  assert.equal(evaluate(tiny,c,[tiny]).decision,'REJECT');
  assert.equal(evaluate(tiny,{...c,requiredMechanics:['ice'],allowedMechanics:['sliding','obstacle','ice']},[]).decision,'REJECT');
});
test('diversity includes ice, lock and graph labels and valid reflections',()=>{
  const a=LEVELS.find(l=>l.id===78)!;const renamed={...a,blocks:a.blocks.map(b=>({...b,id:`new-${b.id}`,dependsOn:b.dependsOn?`new-${b.dependsOn}`:undefined}))};
  assert.equal(canonicalSignature(a),canonicalSignature(renamed));
  assert.notEqual(canonicalSignature(a),canonicalSignature({...a,blocks:a.blocks.map(b=>b.type==='lock'?{...b,unlockAt:0}:b)}));
  const reflection:LevelData={...a,blocks:a.blocks.map(b=>({...b,position:[a.cols-1-b.position[0],b.position[1]],direction:b.direction==='LEFT'?'RIGHT':b.direction==='RIGHT'?'LEFT':b.direction})),exits:a.exits.map(e=>({...e,side:e.side==='LEFT'?'RIGHT':e.side==='RIGHT'?'LEFT':e.side,index:e.side==='TOP'||e.side==='BOTTOM'?a.cols-1-e.index:e.index}))};
  assert.equal(canonicalSignature(a),canonicalSignature(reflection));
});
test('seeded candidates reproducible, configuration mismatches rejected on resume',async()=>{
  const contract=defaultCurriculum(10)[0];assert.deepEqual(generateCandidate(contract,1,42,2),generateCandidate(contract,1,42,2));
  const output=temporary();const config:PipelineConfig={count:10,seed:42,attemptsPerSlot:50,candidateBudget:1,output,solver:{maxStates:10000,timeoutMs:1000},campaignId:'test',resume:false,maxRunMs:10000};
  try{const run=await runPipeline(config);assert.equal(run.status,'PARTIAL');assert.equal(existsSync(join(output,'approved')),false);await assert.rejects(()=>runPipeline({...config,resume:true,seed:43}),/mismatch/);}finally{rmSync(output,{recursive:true,force:true});}
});
test('10-level end-to-end export verifies all paths, stores audit, survives resume',async()=>{
  const output=temporary();const config:PipelineConfig={count:10,seed:42,attemptsPerSlot:100,candidateBudget:1000,output,solver:{maxStates:1000,timeoutMs:20000},campaignId:'test',resume:false,maxRunMs:300000,poolSize:2};
  try{
    const run=await buildPipeline(config);assert.equal(run.status,'COMPLETE',run.reasons.join(', '));assert.equal(run.accepted.length,10);
    const exported=readJson<{campaignVersion:string;auditVersion:string}>(join(output,'export-status.json'));
    const dir=join(output,'approved',`test-${exported.campaignVersion}-${exported.auditVersion}`);const artifact=readJson<RuntimeCampaign>(join(dir,'campaign.json'));
    assert.equal(artifact.contentHash,runtimeHash(artifact));assert.ok(artifact.auditHash);assert.ok(existsSync(join(dir,'contracts.json')));assert.ok(existsSync(join(dir,'contexts.json')));assert.ok(existsSync(join(dir,'reports.json')));
    assert.equal((await buildPipeline({...config,resume:true})).status,'COMPLETE');
  }finally{rmSync(output,{recursive:true,force:true});}
});
test('output refuses traversal and symlink escape',()=>{
  assert.throws(()=>safeOutput('../escape'),/within generated/);
  const dir=temporary();try{symlinkSync('/tmp',join(dir,'escape'));assert.throws(()=>safeOutput(join(dir,'escape','artifact.json')),/symlink/);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('AI structured output validated, transient failures retried, fabricated provenance rejected',async()=>{
  const output=temporary();let calls=0;let mode='direct';
  const server=createServer((req,res)=>{
    calls++;if(calls===1){res.writeHead(503);res.end();return;}
    res.setHeader('content-type','application/json');
    res.end(JSON.stringify({modelId:'fixture-agent',output:mode==='direct'?{strategy:'fixture',contracts:defaultCurriculum(1)}:{principles:[{id:'fake',statement:'Invented',category:'difficulty',evidenceType:'RESEARCH',sources:['https://invented.example'],confidence:1,testableHypotheses:[]}]}}));
  });await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as {port:number}).port;
  try{await runAgentTask(`http://127.0.0.1:${port}`,'direct',{},output);assert.equal(calls,2);mode='research';await assert.rejects(()=>runAgentTask(`http://127.0.0.1:${port}`,'research',{},output,{maxAttempts:1}),/not retrieved/);}finally{await new Promise<void>(r=>server.close(()=>r()));rmSync(output,{recursive:true,force:true});}
});
test('calibration isolates level versions and excludes autoplay; no fabricated observations',()=>{
  const base={schemaVersion:'1.0.0',campaignId:'test',campaignVersion:'v1',levelId:1,levelVersion:'hash',attemptId:'human',completed:true,completionTimeMs:1000,moveCount:2,undoCount:0,restartCount:0,hintCount:0,deadEndCount:0,mode:'HUMAN'};
  const report=calibrate([base,{...base,attemptId:'ai',mode:'AUTOPLAY'}],[{campaignId:'test',campaignVersion:'v1',levelId:1,levelVersion:'hash',score:20,modelVersion:'v1'},{campaignId:'test',campaignVersion:'v1',levelId:1,levelVersion:'other',score:30,modelVersion:'v1'}]);
  assert.equal(report.excludedAutoplay,1);assert.equal(report.levels[0].attemptCount,1);assert.equal(report.levels[1].completionRate,undefined);assert.throws(()=>calibrate([{}],[]));
});

test('campaign storage isolates progress while sharing audio preferences',async()=>{
  const {campaignStorage}=await import('../../../src/managers/CampaignStorage');
  const values=new Map<string,string>();const storage=campaignStorage({getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);},removeItem:k=>{values.delete(k);}});
  storage.setItem('fpp-game-state-v2',JSON.stringify({version:0,state:{unlockedLevel:80,sfxEnabled:false,audioEnabled:false,equippedPalette:'classic'}}));
  const fresh=JSON.parse(storage.getItem('new-campaign')!);assert.equal(fresh.state.unlockedLevel,undefined);assert.equal(fresh.state.sfxEnabled,false);assert.equal(fresh.state.equippedPalette,undefined);
  storage.setItem('new-campaign',JSON.stringify({version:0,state:{unlockedLevel:3,sfxEnabled:true,audioEnabled:true,equippedPalette:'classic'}}));
  const old=JSON.parse(storage.getItem('fpp-game-state-v2')!);assert.equal(old.state.unlockedLevel,80);assert.equal(old.state.sfxEnabled,true);
});

test('cancelled run persists INTERRUPTED and can resume',async()=>{
  const output=temporary();const config:PipelineConfig={count:10,seed:42,attemptsPerSlot:100,candidateBudget:1000,output,solver:{maxStates:1000,timeoutMs:20000},campaignId:'test',resume:false,maxRunMs:300000,poolSize:2};
  const controller=new AbortController();controller.abort();
  try{const run=await runPipeline(config,controller.signal);assert.equal(run.status,'INTERRUPTED');assert.equal(existsSync(join(output,'approved')),false);}finally{rmSync(output,{recursive:true,force:true});}
});
