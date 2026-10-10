import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,rmSync,readFileSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { createServer } from 'node:http';
import type { LevelData } from '../../../src/types/Game';
import { PlayerTelemetry } from '../../../src/systems/PlayerTelemetry';
import { defaultCurriculum,validateContract } from '../director/DesignContract';
import { solve } from '../core/SolverV2';
import { verifyEvidence } from '../evaluation/FormalEvidence';
import { createEvaluationContext,validateContext } from '../evaluation/EvaluationContext';
import { evaluate } from '../evaluation/Evaluators';
import { evaluateBounded } from '../evaluation/BoundedEvaluation';
import { hash,exportCampaign,writeJson,readJson } from '../output/Artifacts';
import { stableProof } from '../output/Integrity';
import { solutionPattern,solutionPatternSimilarity } from '../evaluation/DiversityEvaluator';
import { optimizeCampaign } from '../director/CampaignOptimizer';
import { validateCampaign,type AcceptedCandidate } from '../director/CurriculumPlanner';
import { runPipeline,type PipelineConfig } from '../Pipeline';
import { prepareAutonomous,revisionProposal } from '../director/AutonomousWorkflow';
import { runAgentTask } from '../director/AgentProvider';
import { fitDifficulty,calibrate } from '../analytics/Calibration';
const tiny:LevelData={id:1,cols:3,rows:1,blocks:[{id:'a',color:'red',position:[0,0],size:[1,1]}],exits:[{side:'RIGHT',index:0}],parMoves:1};
const contract={...defaultCurriculum(1)[0],grid:{minCols:1,maxCols:5,minRows:1,maxRows:5},optimalMoves:{min:1,max:10}};
function temp(){mkdirSync('generated/tests',{recursive:true});return mkdtempSync(resolve('generated/tests/v2-'));}
function accepted(level=tiny):AcceptedCandidate{return {candidate:{candidateId:'fixture',level,contract,provenance:{seed:42,attempt:0,generatorVersion:'fixture',strategy:'constraint'}},report:evaluate(level,contract,[])};}
test('canonical hash and context integrity bind policies, learning and catalog',()=>{
  assert.equal(hash({b:2,a:1}),hash({a:1,b:2}));const context=createEvaluationContext([],{},['sliding']);validateContext(context);
  assert.throws(()=>validateContext({...context,learned:[]}));assert.notEqual(context.contextHash,createEvaluationContext().contextHash);
});
test('formal positioning searches avoiding solutions; incomplete proof is UNKNOWN',()=>{
  const level:LevelData={id:1,cols:3,rows:3,blocks:[{id:'a',color:'red',type:'simple',position:[0,1],size:[1,1]},{id:'o',color:'red',type:'obstacle',position:[2,1],size:[1,1]}],exits:[{side:'TOP',index:1}],parMoves:2};
  const result=solve(level),spec={id:'position',claim:'forced-positioning' as const,scope:'ALL_WINNING_PATHS' as const,blockIds:['a'],position:[1,1] as [number,number]};
  assert.equal(verifyEvidence(level,result,spec,{}).status,'VERIFIED');assert.equal(verifyEvidence(level,result,{...spec,position:[0,2]},{}).status,'NOT_VERIFIED');assert.equal(verifyEvidence(level,result,spec,{maxStates:1}).status,'UNKNOWN');
});
test('dependency chain and counterfactual sequencing have different definitions',()=>{
  const level:LevelData={...tiny,blocks:[{...tiny.blocks[0],id:'a'},{...tiny.blocks[0],id:'b',position:[1,0],type:'dependent',dependsOn:'a'}],exits:[{side:'LEFT',index:0},{side:'RIGHT',index:0}],parMoves:2};
  const result=solve(level);
  assert.equal(verifyEvidence(level,result,{id:'chain',claim:'dependency-chain',scope:'ALL_WINNING_PATHS',blockIds:['a','b']},{}).status,'VERIFIED');
  assert.equal(verifyEvidence(level,result,{id:'dep',claim:'dependency-planning',scope:'COUNTERFACTUAL_EFFECT'},{}).status,'VERIFIED');
  assert.equal(verifyEvidence(level,result,{id:'bad',claim:'dependency-chain',scope:'ALL_WINNING_PATHS',blockIds:['b','a']},{}).status,'NOT_VERIFIED');
});
test('complete graph distinguishes cyclic dead ends from no-action states',()=>{
  const level:LevelData={id:1,cols:3,rows:3,blocks:[{id:'m1',color:'red',position:[1,1],size:[1,1]},{id:'m2',color:'blue',position:[1,2],size:[1,1]}],exits:[{side:'TOP',index:1}],parMoves:2};
  const result=solve(level),spec={id:'trap',claim:'false-opportunity' as const,scope:'EXISTS_REACHABLE_TRAP' as const};
  const evidence=verifyEvidence(level,result,spec,{});assert.equal(evidence.status,'VERIFIED');assert.ok(evidence.counterexample?.length);
  assert.equal(verifyEvidence(level,result,spec,{maxStates:1}).status,'UNKNOWN');
});
test('v2 contract requires explicit evidence and validates monitor parameters',()=>{
  assert.ok(validateContract({...contract,requiredEvidence:[]}).length);
  assert.ok(validateContract({...contract,requiredEvidence:[{id:'bad',claim:'forced-positioning',scope:'ALL_WINNING_PATHS'}]}).length);
  assert.equal(validateContract(contract).length,0);
});
test('solution patterns ignore renamed identities and preserve mechanic interaction',()=>{
  const renamed={...tiny,blocks:tiny.blocks.map(b=>({...b,id:'renamed'}))};
  assert.deepEqual(solutionPattern(tiny,solve(tiny).solutionPath!),solutionPattern(renamed,solve(renamed).solutionPath!));
  assert.equal(solutionPatternSimilarity(['slide','exit'],['slide','exit']),1);assert.equal(solutionPatternSimilarity(['ice'],['stopper']),0);
});
test('worker evaluation agrees with export context and isolates cancellation',async()=>{
  const context=createEvaluationContext(),proof=evaluate(tiny,contract,[],{},[],context),bounded=await evaluateBounded(tiny,contract,context);
  assert.equal(hash(stableProof(proof)),hash(stableProof(bounded)));const abort=new AbortController();abort.abort();assert.equal((await evaluateBounded(tiny,contract,context,abort.signal)).decision,'HOLD');
});
test('audit version changes independently of runtime and existing artifact tampering blocks reuse',async()=>{
  const dir=temp();try{
    const first=accepted(),before=hash(first.report),a=await exportCampaign([first],1,dir,'test');assert.equal(hash(first.report),before);
    const next=structuredClone(first);next.candidate.contract={...contract,secondaryInsights:['additional context']};next.report=evaluate(tiny,next.candidate.contract,[]);
    const b=await exportCampaign([next],1,dir,'test');assert.equal(a.contentHash,b.contentHash);assert.equal(a.campaignVersion,b.campaignVersion);assert.notEqual(a.auditVersion,b.auditVersion);assert.notEqual(a.auditHash,b.auditHash);
    writeJson(join(dir,`test-${a.campaignVersion}-${a.auditVersion}`,'contracts.json'),[]);await assert.rejects(()=>exportCampaign([first],1,dir,'test'),/integrity conflict/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('checkpoint tampering fails before resume and timeout preserves candidate identity',async()=>{
  const dir=temp();const config:PipelineConfig={count:1,seed:42,contracts:[contract],attemptsPerSlot:10,candidateBudget:10,output:dir,solver:{timeoutMs:0},campaignId:'test',resume:false,maxRunMs:10000,poolSize:1};
  try{const run=await runPipeline(config);assert.equal(run.status,'PARTIAL');assert.ok(run.pending);assert.equal(run.candidateCount,0);assert.equal(run.attempt,0);const checkpoint=readJson<Record<string,unknown>>(join(dir,'checkpoint.json'));checkpoint.candidateCount=4;writeJson(join(dir,'checkpoint.json'),checkpoint);await assert.rejects(()=>runPipeline({...config,resume:true}),/integrity/);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('curriculum requires prior taught prerequisite and beam chooses lower total penalty',()=>{
  const first=accepted(),second=structuredClone(first);second.candidate.candidateId='second';second.candidate.level={...tiny,id:2,cols:4};second.candidate.contract={...contract,contractId:'slot2',progressionRole:'PRACTICE',introducedMechanic:undefined};second.report=evaluate(second.candidate.level,second.candidate.contract,[],{},['sliding']);
  const bad=structuredClone(first);bad.candidate.contract.introducedMechanic='lock';bad.candidate.level.blocks[0].type='lock';bad.candidate.level.blocks[0].unlockAt=0;
  assert.equal(validateCampaign([bad],1).success,false);
  const expensive=structuredClone(first);expensive.candidate.candidateId='expensive';expensive.report.difficulty!.score=90;
  const result=optimizeCampaign([[expensive,first],[second]],4);assert.equal(result?.levels[0].candidate.candidateId,'fixture');
});
test('local telemetry excludes pause time and deletes consent data',()=>{
  const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}} as Storage;
  let now=0;const telemetry=new PlayerTelemetry(storage,()=>now);telemetry.start(1,false);assert.equal(telemetry.exportJsonl(),'');telemetry.setConsent(true);telemetry.start(1,false);now=100;telemetry.setPaused(true,'scene');now=1000;telemetry.setPaused(true,'visibility');telemetry.setPaused(false,'scene');now=2000;telemetry.setPaused(false,'visibility');now=2100;telemetry.finish(true);telemetry.rateLast(3);
  const row=JSON.parse(telemetry.exportJsonl());assert.equal(row.completionTimeMs,200);assert.equal(row.reportedDifficulty,3);assert.ok(row.testerId);telemetry.setConsent(false);assert.equal(values.size,0);assert.equal(telemetry.exportJsonl(),'');
});
test('calibration separates testers and versions; synthetic fixtures never become observations',()=>{
  const predictions=Array.from({length:5},(_,i)=>({campaignId:'test',campaignVersion:'v1',levelId:i+1,levelVersion:`l${i}`,score:5,modelVersion:'fixture',features:{moves:i+1,branching:1}}));
  const rows=Array.from({length:20},(_,t)=>predictions.map((p,i)=>({schemaVersion:'2.0.0' as const,...p,attemptId:`${t}-${i}`,testerId:`tester${t}`,sessionId:'session',timeBasis:'ACTIVE' as const,completed:true,completionTimeMs:100,moveCount:1,undoCount:0,restartCount:0,hintCount:0,deadEndCount:0,mode:'HUMAN' as const,reportedDifficulty:i+1}))).flat();
  const fit=fitDifficulty(rows,predictions);assert.equal(fit.status,'FITTED');if(fit.status==='FITTED'){assert.equal(fit.trainingTesters!.some(t=>fit.heldOutTesters!.includes(t)),false);assert.ok(fit.heldOutMAE!<fit.baselineMAE!);}
  assert.equal(calibrate([],predictions).fitting.status,'INSUFFICIENT_DATA');
});
test('AI workflow cache avoids calls on resume; revisions preserve contract and retry budgets',async()=>{
  const dir=temp();let calls=0;
  const server=createServer(async(req,res)=>{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(chunk);const request=JSON.parse(Buffer.concat(chunks).toString());calls++;const output=request.task==='direct'?{strategy:'keep constraints',contracts:[contract]}:request.task==='architect'?{proposals:[{contractId:contract.contractId,level:tiny}]}:{facts:['Solver report provided'],predictions:['May be easier after revision'],hasPlaytested:false};res.end(JSON.stringify({modelId:'fixture',output,usage:{inputTokens:10,outputTokens:10,estimatedCost:0.001}}));});
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  const config:PipelineConfig={count:1,seed:42,attemptsPerSlot:10,candidateBudget:10,output:dir,solver:{},campaignId:'test',resume:false,maxRunMs:10000,agentUrl:url};
  try{await prepareAutonomous(config);assert.equal(calls,2);await prepareAutonomous({...config,resume:true});assert.equal(calls,2);const fixture=accepted();assert.ok(await revisionProposal(config,contract,fixture.candidate,fixture.report));assert.equal(calls,5);await assert.rejects(()=>runAgentTask(url,'critic',{newInput:true},dir,{maxRequests:5}),/budget/);}finally{await new Promise<void>(r=>server.close(()=>r()));rmSync(dir,{recursive:true,force:true});}
});

test('beam preserves a harder predecessor needed for a later relief level',()=>{
  const cheap=accepted(),hard=structuredClone(cheap);cheap.report.difficulty!.score=5;hard.candidate.candidateId='hard';hard.report.difficulty!.score=20;
  const relief=structuredClone(cheap);relief.candidate.candidateId='relief';relief.candidate.level={...tiny,id:2,cols:4};relief.candidate.contract={...contract,contractId:'relief',progressionRole:'RELIEF',introducedMechanic:undefined};relief.report.difficulty!.score=15;
  assert.equal(optimizeCampaign([[cheap,hard],[relief]],2)?.levels[0].candidate.candidateId,'hard');
});

test('progression failure keeps a resumable checkpoint rather than duplicating a slot',async()=>{
  const dir=temp(),c={...contract,progressionRole:'PRACTICE' as const,introducedMechanic:undefined};
  const config:PipelineConfig={count:1,seed:42,contracts:[c],proposals:[{contractId:c.contractId,level:tiny}],attemptsPerSlot:2,candidateBudget:2,output:dir,solver:{maxStates:100,timeoutMs:1000},campaignId:'test',resume:false,maxRunMs:10000,poolSize:1};
  try{const first=await runPipeline(config);assert.equal(first.status,'PARTIAL');assert.equal(first.pools.length,first.nextSlot);const resumed=await runPipeline({...config,resume:true});assert.equal(resumed.status,'PARTIAL');}finally{rmSync(dir,{recursive:true,force:true});}
});

test('campaign pools reject duplicate candidate IDs before caching signatures',()=>{
  const a=accepted(),b=structuredClone(a);b.candidate.level={...tiny,id:2,cols:4};
  assert.throws(()=>optimizeCampaign([[a],[b]]),/Candidate IDs must be unique/);
});

test('mastery finale verifies all mechanics and rejects a cosmetic lock',async()=>{
  const baseline=JSON.parse(readFileSync(new URL('./fixtures/approved-baseline.json',import.meta.url),'utf8')).find((f:any)=>f.level.id===80);
  const finalContract=baseline.contract,level:LevelData=baseline.level;
  const report=evaluate(level,finalContract,[],{maxStates:2000,timeoutMs:15000});
  assert.equal(report.decision,'ELIGIBLE');assert.equal(report.solver!.optimalMoves,8);
  for(const claim of ['sliding-required','ice-push','direction-interaction','dependency-planning','lock-planning','obstacle-interaction'])assert.ok(report.evidence.some(e=>e.claim===claim&&e.status==='VERIFIED'),claim);
  const cosmetic=structuredClone(level);cosmetic.blocks.find(b=>b.id==='m2')!.position[0]=2;
  const rejected=evaluate(cosmetic,finalContract,[],{maxStates:2000,timeoutMs:15000});
  assert.equal(rejected.evidence.find(e=>e.claim==='lock-planning')?.status,'NOT_VERIFIED');assert.equal(rejected.decision,'REJECT');
});

test('inactive mechanic fields cannot disguise exact duplicates or inflate dependency depth',async()=>{
  const {canonicalSignature}=await import('../evaluation/DiversityEvaluator');
  const cosmetic:LevelData={...tiny,blocks:tiny.blocks.map(b=>({...b,direction:'UP',dependsOn:'unused',unlockAt:10}))};
  assert.equal(canonicalSignature(tiny),canonicalSignature(cosmetic));
  assert.equal(evaluate(cosmetic,contract,[]).difficulty!.dependencyDepth,0);
  assert.equal(canonicalSignature(tiny),canonicalSignature({...tiny,blocks:tiny.blocks.map(b=>({...b,type:'lock',unlockAt:0}))}));
});
