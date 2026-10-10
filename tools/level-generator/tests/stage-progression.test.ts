import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STAGES, stageDefinition, moveLimit, resolveAttempt, validateStages } from '../../../src/core/campaign/Stage';
import { importCompletions, progression, canPlayLevel, type ProgressCatalog } from '../../../src/core/campaign/Progress';
import { TutorialSession } from '../../../src/core/campaign/TutorialSession';
import { stageOneContracts } from '../stage-curriculum';
import { validateContract } from '../director/DesignContract';
import { generateCandidate } from '../generation/CandidateGenerator';
import { createState, gameRules } from '../../../src/core/puzzle/GameRules';
import { findHint } from '../../../src/core/puzzle/HintSearch';
import { runtimeHash, hash, type RuntimeCampaign } from '../output/Artifacts';
import type { LevelData } from '../../../src/types/Game';
const board: LevelData = { id:1, cols:3, rows:3, blocks:[{id:'red',color:'red',type:'simple',position:[0,1],size:[1,1]}], exits:[{side:'RIGHT',index:1}], parMoves:1,pack:'stage-1' };
test('stage budgets derive from proven optimum; win wins on final move; restart counter starts at zero', () => {
  assert.deepEqual([1,2,3,4,5,50].map(n=>moveLimit(stageDefinition(n),10)),[undefined,12,11,10,10,10]);
  assert.equal(resolveAttempt(true,12,12,false),'WIN'); assert.equal(resolveAttempt(false,12,12,true),'MOVE_LIMIT');
  assert.equal(resolveAttempt(false,0,12,true),undefined); assert.equal(resolveAttempt(false,100,undefined,true),undefined); assert.equal(resolveAttempt(false,1,undefined,false),'STUCK');
});
test('all Stage 1 contracts enforce gradual red/yellow/obstacle introduction and verified stopper mastery',()=>{
  const contracts=stageOneContracts(); assert.equal(contracts.length,20);
  assert.deepEqual(contracts.filter(c=>c.introducedMechanic).map(c=>c.introducedMechanic),['sliding','obstacle','constrained']);
  for(const c of contracts) { assert.deepEqual(validateContract(c),[]); assert.ok(c.allowedMechanics.every(m=>['sliding','constrained','obstacle'].includes(m))); }
  assert.ok(contracts.slice(5).every(c=>c.requiredEvidence!.some(e=>e.claim==='block-as-stopper')));
  assert.ok([16,18,19].every(i=>contracts[i].mandatoryPrematureExitTrap&&contracts[i].requiredEvidence!.some(e=>e.claim==='false-opportunity')));
  assert.equal(contracts[17].progressionRole,'RELIEF'); assert.equal(contracts[19].progressionRole,'MASTERY');
  for(const c of contracts)for(let i=0;i<5;i++){const level=generateCandidate(c,1,42,i).level;assert.equal(level.exits.length,1);assert.ok(level.blocks.every(b=>['simple','constrained','obstacle'].includes(b.type!)));assert.equal(level.iceCells,undefined);}
});
test('stage publishing requires full batches; forbidden mechanics and missing positions reject',()=>{
  const levels=Array.from({length:20},(_,i)=>({...board,id:i+1}));
  assert.deepEqual(validateStages(INITIAL_STAGES,levels),[]);
  assert.ok(validateStages(INITIAL_STAGES,levels.slice(0,19)).some(e=>e.includes('complete batch')));
  assert.ok(validateStages(INITIAL_STAGES,[{...levels[0],blocks:[{...board.blocks[0],type:'lock',unlockAt:1}]},...levels.slice(1)]).length);
  assert.ok(validateStages(INITIAL_STAGES,[{...levels[0],iceCells:[[0,0]]},...levels.slice(1)]).length);
  assert.ok(validateStages({...INITIAL_STAGES,stages:INITIAL_STAGES.stages.map(s=>s.number===1?{...s,allowedBlockTypes:[...s.allowedBlockTypes,'lock' as const]}:s)},levels).some(e=>e.includes('too early')));
  assert.ok(validateStages({...INITIAL_STAGES,stages:INITIAL_STAGES.stages.map(s=>s.number===2?{...s,moveBudget:{mode:'UNLIMITED' as const}}:s)},levels).some(e=>e.includes('move policy')));
});
test('batch append retains completion; content changes revoke only affected level; stage gate requires all 20',()=>{
  const old:ProgressCatalog={campaignId:'kinetic-stages',campaignVersion:'old',levelVersions:Object.fromEntries(Array.from({length:20},(_,i)=>[i+1,`v${i+1}`])),stages:INITIAL_STAGES.stages};
  const completedLevels=Object.fromEntries(Array.from({length:20},(_,i)=>[i+1,{levelVersion:`v${i+1}`} ]));
  const next:ProgressCatalog={...old,campaignVersion:'new',levelVersions:{...old.levelVersions,...Object.fromEntries(Array.from({length:20},(_,i)=>[i+21,`v${i+21}`]))}};
  const imported=importCompletions({campaignId:old.campaignId,campaignVersion:'old',completedLevels},next);
  assert.equal(Object.keys(imported).length,20);assert.equal(progression(imported,next),21);assert.equal(canPlayLevel(21,21,imported,next.stages),true);
  const changed=importCompletions({campaignId:old.campaignId,completedLevels},{...next,levelVersions:{...next.levelVersions,5:'changed'}});
  assert.equal(changed[5],undefined);assert.equal(progression(changed,next),5);assert.equal(canPlayLevel(21,40,changed,next.stages),false);
  assert.deepEqual(importCompletions({campaignId:'other',completedLevels},next),{});
});
test('legacy stars convert only for matching campaign identity and version',()=>{
  const catalog:ProgressCatalog={campaignId:'kinetic-stages',campaignVersion:'v1',levelVersions:{1:'content'},stages:[]};
  assert.deepEqual(importCompletions({campaignId:'kinetic-stages',campaignVersion:'v1',bestStars:{1:3}},catalog),{1:{levelVersion:'content'}});
  assert.deepEqual(importCompletions({campaignId:'kinetic-stages',campaignVersion:'v2',bestStars:{1:3}},catalog),{});
  assert.deepEqual(importCompletions({campaignId:'shared-exit',campaignVersion:'v1',bestStars:{1:3}},catalog),{});
});
test('dialogue advances only on its matching action; skip terminates; replay creates fresh session',()=>{
  const steps=[{text:'Hello'}, {text:'Slide red',action:{blockId:'red',dir:'RIGHT' as const}}];
  const session=new TutorialSession(steps);assert.equal(session.moved({blockId:'red',dir:'RIGHT'}),false);assert.equal(session.next(),true);
  assert.equal(session.next(),false);assert.equal(session.moved({blockId:'yellow',dir:'RIGHT'}),false);assert.equal(session.moved({blockId:'red',dir:'LEFT'}),false);assert.equal(session.index,1);
  assert.equal(session.moved({blockId:'red',dir:'RIGHT'}),true);assert.equal(session.finished,true);
  const replay=new TutorialSession(steps);assert.equal(replay.index,0);replay.skip();assert.equal(replay.finished,true);
});
test('hints use current shared rules, respect remaining moves, and never mutate the board',async()=>{
  const state=createState(board),before=gameRules.serializeState(state);
  assert.deepEqual(await findHint(state,1),{blockId:'red',dir:'RIGHT'});assert.equal(await findHint(state,0),undefined);assert.equal(await findHint(state,Infinity,()=>true),undefined);
  assert.equal(gameRules.serializeState(state),before);
});
test('stage metadata is included in the runtime integrity hash',()=>{
  const campaign:RuntimeCampaign={schemaVersion:'2.1.0',campaignId:'kinetic-stages',campaignVersion:'',contentHash:'',rulesVersion:'1.0.0',levels:[board],solutions:{},roles:{},tutorials:{},stageConfig:INITIAL_STAGES};
  const changed={...campaign,stageConfig:{...INITIAL_STAGES,stages:INITIAL_STAGES.stages.map(s=>s.number===2?{...s,moveBudget:{mode:'OPTIMAL_PLUS' as const,extraMoves:0}}:s)}};
  assert.notEqual(runtimeHash(campaign),runtimeHash(changed));
  const legacy={...campaign,schemaVersion:'2.0.0',stageConfig:undefined};assert.equal(runtimeHash(legacy),hash({levels:legacy.levels,solutions:legacy.solutions,roles:legacy.roles,tutorials:legacy.tutorials,rulesVersion:legacy.rulesVersion}));
});

test('catalog supports 1000 stable IDs in 50 complete stages',()=>{
  const config={targetLevels:1000,batchSize:20,stages:Array.from({length:50},(_,i)=>stageDefinition(i+1))};
  const levels=Array.from({length:1000},(_,i)=>({...board,id:i+1,pack:`stage-${Math.floor(i/20)+1}`}));
  assert.deepEqual(validateStages(config,levels),[]);
  assert.equal(config.stages[49].firstLevel,981);assert.equal(moveLimit(config.stages[49],17),17);
});

test('prioritized proposal search produces replayable paths but leaves approval to BFS',async()=>{
  const {findProposalSolution}=await import('../generation/ProposalSearch');
  const {replaySolution}=await import('../../../src/core/puzzle/SolutionReplay');
  const {solve}=await import('../core/SolverV2');
  const levels=[board,{...board,blocks:[{...board.blocks[0],position:[0,0] as [number,number]},{id:'stopper',color:'red' as const,type:'obstacle' as const,position:[2,2] as [number,number],size:[1,1] as [number,number]}]}];
  for(const level of levels){const proposal=findProposalSolution(level),verified=solve(level);assert.equal(proposal.status,'FOUND');assert.equal(replaySolution(level,proposal.path!).success,true);assert.equal(proposal.path!.length,verified.optimalMoves);assert.equal('optimalityProven' in proposal,false);}
  assert.equal(findProposalSolution(board,{timeoutMs:0}).status,'TIMEOUT');assert.equal(findProposalSolution(board,{maxStates:1}).status,'RESOURCE_LIMIT');assert.equal(findProposalSolution(board,{maxDepth:0}).status,'RESOURCE_LIMIT');
  assert.equal(findProposalSolution({...board,exits:[]}).status,'ERROR');
});

test('stage mutation proposals are reproducible, keep one exit and correct colors after rotation',async()=>{
  const {generateStageCandidate}=await import('../generation/StageCandidateGenerator');
  const {validateLevel}=await import('../../../src/core/puzzle/LevelValidator');
  const {productErrors}=await import('../generation/ProductPolicy');
  const contract=stageOneContracts()[16];
  for(let attempt=1;attempt<100;attempt+=2){const candidate=generateStageCandidate(contract,17,20261011,attempt);assert.deepEqual(candidate,generateStageCandidate(contract,17,20261011,attempt));assert.equal(candidate.provenance.strategy,'mutation');assert.ok(candidate.provenance.sourceCandidateHash);assert.deepEqual(validateLevel(candidate.level),[]);assert.deepEqual(productErrors(candidate.level),[]);}
});
test('stage diversity measures actual geometry; matching object counts do not imply a near duplicate',async()=>{
  const {evaluateDiversity,layoutSimilarity,canonicalSignature}=await import('../evaluation/DiversityEvaluator');
  const a={...board,cols:5,rows:5,blocks:[{...board.blocks[0],position:[0,1] as [number,number]}]},b={...a,blocks:[{...a.blocks[0],position:[3,4] as [number,number]}]};
  assert.equal(evaluateDiversity(a,[b]).similarity,1);assert.ok(evaluateDiversity(a,[b],'LAYOUT_AND_STRUCTURE').similarity<0.94);
  const reflected={...a,blocks:a.blocks.map(block=>({...block,position:[4-block.position[0],block.position[1]] as [number,number]})),exits:[{side:'LEFT' as const,index:1}]};
  assert.equal(canonicalSignature(a),canonicalSignature(reflected));assert.equal(layoutSimilarity(a,reflected),1);assert.equal(evaluateDiversity(a,[reflected],'LAYOUT_AND_STRUCTURE').exactDuplicate,true);
});

test('approved solution hints validate replay and remaining moves before reuse',async()=>{
  const {hintFromSolution}=await import('../../../src/core/puzzle/HintSearch');
  const state=createState(board),path=[{blockId:'red',dir:'RIGHT' as const}];
  assert.deepEqual(hintFromSolution(state,board,path,1),path[0]);assert.equal(hintFromSolution(state,board,path,0),undefined);
  assert.equal(hintFromSolution(state,board,[{blockId:'red',dir:'UP'}]),undefined);
  assert.equal(hintFromSolution(gameRules.applyAction(state,path[0]).state,board,path),undefined);
});
test('reachable exit traps are verified over the complete winning graph and unknown stays unknown',async()=>{
  const {readFileSync}=await import('node:fs');const {analyzeDecisions}=await import('../evaluation/DecisionAnalysis');
  const reference=JSON.parse(readFileSync('generated/runs/shared-exit-playtest/latest.json','utf8'));
  const level=JSON.parse(readFileSync(reference.campaignPath,'utf8')).levels[1];
  const scoped=analyzeDecisions(level,{maxStates:30000,timeoutMs:30000},'REACHABLE_WINNING_STATES');
  assert.equal(scoped.status,'VERIFIED');assert.equal(scoped.trapScope,'REACHABLE_WINNING_STATES');assert.ok(scoped.prematureExitTraps!>0);
  assert.equal(analyzeDecisions(level,{maxStates:1},'REACHABLE_WINNING_STATES').status,'UNKNOWN');
});
