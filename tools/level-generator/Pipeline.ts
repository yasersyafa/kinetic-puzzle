import { applyProductPolicy,productCurriculum } from './generation/ProductPolicy';
import { existsSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { LEVELS,SOLUTIONS } from '../../src/config/Levels';
import { RULES_VERSION } from '../../src/core/puzzle/GameRules';
import { SOLVER_VERSION,type SolverOptions } from './core/SolverV2';
import { CONTRACT_VERSION,validateContract,type LevelDesignContract } from './director/DesignContract';
import { validateCampaign,type AcceptedCandidate } from './director/CurriculumPlanner';
import { optimizeCampaign,PLANNER_VERSION } from './director/CampaignOptimizer';
import { GENERATOR_VERSION,generateCandidate,type Candidate,reviseCandidate,crossover,reverseDesign } from './generation/CandidateGenerator';
import { EVALUATOR_VERSION,type EvaluationReport } from './evaluation/Evaluators';
import { evaluateBounded } from './evaluation/BoundedEvaluation';
import { solutionPattern } from './evaluation/DiversityEvaluator';
import { createEvaluationContext,type DifficultyModel } from './evaluation/EvaluationContext';
import { hash,readJson,writeJson,exportCampaign,EXPORTER_VERSION } from './output/Artifacts';
import { stableProof } from './output/Integrity';
import { requireAdvancedTargets } from './director/DifficultyTargets';
import { limitSimilarity } from './director/DiversityTargets';
const BASE_PATTERNS=LEVELS.map(l=>({levelId:l.id,pattern:solutionPattern(l,SOLUTIONS[l.id]??[])}));
export interface PipelineConfig {
  count:number;seed:number;attemptsPerSlot:number;candidateBudget:number;output:string;
  solver:SolverOptions;campaignId:string;resume:boolean;maxRunMs:number;poolSize?:number;beamWidth?:number;
  contracts?:LevelDesignContract[];reuse?:AcceptedCandidate[];proposals?:{contractId:string;level:import('../../src/types/Game').LevelData;ai?:NonNullable<Candidate['provenance']['ai']>}[];
  difficultyModel?:DifficultyModel;requireAdvancedTargets?:boolean;maxSimilarity?:number;agentUrl?:string;maxAIRequests?:number;maxAITokens?:number;maxAICost?:number;
}
export interface RunCheckpoint {
  schemaVersion:string;configHash:string;versions:{rules:string;solver:string;generator:string;evaluator:string;planner?:string;contract?:string;exporter?:string};integrityHash?:string;
  nextSlot:number;attempt:number;candidateCount:number;accepted:AcceptedCandidate[];pools:AcceptedCandidate[][];currentPool:AcceptedCandidate[];
  slotAttempts?:number[];repairCount?:number;best?:{candidate:Candidate;penalty:number};pending?:Candidate;pendingReport?:EvaluationReport;elapsedMs:number;aiFeedback?:unknown[];
  rejections:Record<string,number>;status:'RUNNING'|'COMPLETE'|'PARTIAL'|'INTERRUPTED';reasons:string[];
}
export async function runPipeline(config:PipelineConfig,signal?:AbortSignal,log:(v:unknown)=>void=()=>{}):Promise<RunCheckpoint>{
  const proposedContracts=applyProductPolicy(config.contracts??productCurriculum(config.count)),poolSize=config.poolSize??5;
  if(!Array.isArray(proposedContracts)||proposedContracts.some(c=>!c||typeof c!=='object'))throw new Error('Curriculum contracts must be an array of contract objects');
  const difficultyContracts=config.requireAdvancedTargets?requireAdvancedTargets(proposedContracts,config.difficultyModel):proposedContracts;
  const contracts=config.maxSimilarity===undefined?difficultyContracts:limitSimilarity(difficultyContracts,config.maxSimilarity);
  if(!Array.isArray(contracts)||contracts.some(c=>!c||typeof c!=='object'))throw new Error('Curriculum contracts must be an array of contract objects');
  if(new Set(contracts.map(c=>c.contractId)).size!==contracts.length)throw new Error('Contract IDs must be unique');
  if(contracts.length!==config.count||contracts.some(c=>c.schemaVersion!=='2.0.0'||validateContract(c).length))throw new Error('Invalid curriculum contracts');
  if(!Number.isInteger(poolSize)||poolSize<1||poolSize>100)throw new Error('Invalid candidate pool size');
  const versions={rules:RULES_VERSION,solver:SOLVER_VERSION,generator:GENERATOR_VERSION,evaluator:EVALUATOR_VERSION,planner:PLANNER_VERSION,contract:CONTRACT_VERSION,exporter:EXPORTER_VERSION};
  const configHash=hash(stableProof({...config,output:undefined,resume:undefined,contracts,versions})),path=join(config.output,'checkpoint.json');
  let checkpoint:RunCheckpoint={schemaVersion:'2.0.0',configHash,versions,nextSlot:0,attempt:0,candidateCount:0,accepted:[],pools:[],currentPool:[],elapsedMs:config.agentUrl&&existsSync(join(config.output,'ai-usage.json'))?(readJson<{elapsedMs?:number}>(join(config.output,'ai-usage.json')).elapsedMs??0):0,rejections:{},status:'RUNNING',reasons:[]};
  if(config.resume){
    if(!existsSync(path))throw new Error('Checkpoint does not exist');checkpoint=readJson<RunCheckpoint>(path);
    if(checkpoint.schemaVersion!=='2.0.0'||checkpoint.configHash!==configHash)throw new Error('Checkpoint configuration/version mismatch');
    if(checkpoint.integrityHash!==hash({...checkpoint,integrityHash:undefined}))throw new Error('Checkpoint integrity mismatch');
    if(!Array.isArray(checkpoint.pools)||!Array.isArray(checkpoint.currentPool)||!Array.isArray(checkpoint.accepted)||![checkpoint.nextSlot,checkpoint.attempt,checkpoint.candidateCount,checkpoint.elapsedMs].every(n=>Number.isFinite(n)&&n>=0)||checkpoint.nextSlot>config.count||checkpoint.pools.length!==checkpoint.nextSlot)throw new Error('Invalid checkpoint schema');
  }else if(existsSync(path))throw new Error('Run already exists; use --resume or a new --output');
  if(checkpoint.status==='COMPLETE')return checkpoint;
  checkpoint.slotAttempts??=checkpoint.pools.map(pool=>Math.max(0,...pool.map(a=>a.candidate.provenance.attempt+1)));
  checkpoint.repairCount??=0;
  checkpoint.status='RUNNING';checkpoint.reasons=[];let last=Date.now();
  const persist=()=>{
    const now=Date.now();checkpoint.elapsedMs+=now-last;last=now;
    checkpoint.integrityHash=hash({...checkpoint,integrityHash:undefined});writeJson(path,checkpoint,false);
    writeJson(join(config.output,'run-manifest.json'),{schemaVersion:'2.0.0',runId:config.output.split('/').at(-1),seed:config.seed,versions,configHash,candidateCount:checkpoint.candidateCount,acceptanceCount:checkpoint.accepted.length,rejections:checkpoint.rejections,status:checkpoint.status,solverBudget:config.solver,candidateBudget:config.candidateBudget,attemptsPerSlot:config.attemptsPerSlot,maxRunMs:config.maxRunMs,elapsedMs:checkpoint.elapsedMs,poolSize,beamWidth:config.beamWidth??32,requireAdvancedTargets:config.requireAdvancedTargets??false,maxSimilarity:config.maxSimilarity});
  };
  const stop=(reason:string)=>{checkpoint.status=signal?.aborted?'INTERRUPTED':'PARTIAL';checkpoint.reasons.push(reason);persist();return checkpoint;};
  persist();
  for(let slot=checkpoint.nextSlot;slot<config.count;slot++){
    const contract=contracts[slot];
    for(let attempt=checkpoint.attempt;attempt<config.attemptsPerSlot&&checkpoint.currentPool.length<poolSize;attempt++){
      await new Promise<void>(r=>setImmediate(r));
      if(signal?.aborted||checkpoint.elapsedMs+Date.now()-last>=config.maxRunMs||checkpoint.candidateCount>=config.candidateBudget)return stop(signal?.aborted?'Interrupted':'Cumulative run resource budget exhausted');
      let candidate=checkpoint.pending??generateCandidate(contract,slot+1,config.seed,attempt,checkpoint.best&&attempt%3===0?checkpoint.best.candidate:undefined);
      if(!checkpoint.pending&&checkpoint.currentPool.length>=2&&attempt%7===6){candidate=crossover(checkpoint.currentPool[0].candidate,checkpoint.currentPool[1].candidate,config.seed^attempt);candidate.candidateId=`${contract.contractId}-a${attempt}`;candidate.provenance.attempt=attempt;}
      if(!checkpoint.pending&&checkpoint.best&&attempt%13===12){const reverse=reverseDesign(checkpoint.best.candidate);if(reverse){candidate=reverse;candidate.candidateId=`${contract.contractId}-a${attempt}`;candidate.provenance.attempt=attempt;}}
      const cached=config.reuse?.find(a=>a.candidate.contract.contractId===contract.contractId);
      if(!checkpoint.pending&&attempt===0&&cached){candidate.level=structuredClone(cached.candidate.level);candidate.level.id=slot+1;candidate.provenance.strategy='reuse';candidate.provenance.family=cached.candidate.provenance.family;candidate.provenance.parentId=cached.candidate.candidateId;candidate.provenance.sourceCandidateHash=hash(cached.candidate);candidate.provenance.sourceGeneratorVersion=cached.candidate.provenance.generatorVersion;candidate.provenance.ai=cached.candidate.provenance.ai;}
      const proposal=config.proposals?.find(p=>p.contractId===contract.contractId);
      if(!checkpoint.pending&&attempt===0&&proposal){candidate.level=structuredClone(proposal.level);candidate.level.id=slot+1;candidate.level.pack=contract.targetDifficulty.toLowerCase();candidate.provenance.strategy='ai';candidate.provenance.family=undefined;candidate.provenance.ai=proposal.ai;}
      candidate.candidateId=`${contract.contractId}-a${attempt}`;candidate.provenance.attempt=attempt;
      checkpoint.pending=candidate;persist();
      const learned=checkpoint.accepted.filter(a=>a.candidate.contract.progressionRole==='TEACH').flatMap(a=>a.candidate.contract.introducedMechanic?[a.candidate.contract.introducedMechanic]:[]);
      const insights=checkpoint.accepted.map(a=>a.candidate.contract.primaryInsight);
      const context=createEvaluationContext([...LEVELS,...checkpoint.accepted.map(a=>a.candidate.level)],config.solver,learned,insights,[...BASE_PATTERNS,...checkpoint.accepted.map(a=>({levelId:a.candidate.level.id,pattern:solutionPattern(a.candidate.level,a.report.solver!.solutionPath!)}))],config.difficultyModel);
      const report=await evaluateBounded(candidate.level,contract,context,signal);
      // Operational timeouts preserve the pending candidate and do not consume a logical attempt.
      if(signal?.aborted||report.difficulty?.graphStatus==='TIMEOUT'||report.solver?.status==='TIMEOUT'||report.reasons.some(r=>r.includes('TIMEOUT')||r==='Interrupted')||report.evidence.some(e=>e.status==='UNKNOWN'&&e.reason?.includes('TIMEOUT'))){checkpoint.pendingReport=report;writeJson(join(config.output,'candidates',`${candidate.candidateId}.json`),candidate);writeJson(join(config.output,'reports',`${candidate.candidateId}.json`),report);return stop(`HOLD ${candidate.candidateId}: ${report.reasons.join(', ')||'Timed-out proof'}`);}
      checkpoint.pending=undefined;checkpoint.pendingReport=undefined;checkpoint.candidateCount++;checkpoint.attempt=attempt+1;checkpoint.slotAttempts[slot]=attempt+1;
      if(report.decision==='ELIGIBLE'&&contract.progressionRole==='RELIEF'){const previous=checkpoint.pools.at(-1)??[];const upper=Math.max(0,...previous.map(a=>a.report.difficulty?.score??0));if(report.difficulty!.score>=upper){report.decision='REJECT';report.gates.pacing='FAIL';report.reasons.push('Relief candidate must be easier than an available preceding candidate');}}
      if(report.solver?.optimalMoves!==undefined)candidate.level.parMoves=report.solver.optimalMoves;
      writeJson(join(config.output,'candidates',`${candidate.candidateId}.json`),candidate);writeJson(join(config.output,'reports',`${candidate.candidateId}.json`),report);
      if(report.solver?.status==='SOLVED'&&(!checkpoint.best||report.softPenalty<checkpoint.best.penalty))checkpoint.best={candidate,penalty:report.softPenalty};
      if(report.decision==='ELIGIBLE')checkpoint.currentPool.push({candidate,report});
      else {
        for(const reason of report.reasons)checkpoint.rejections[reason]=(checkpoint.rejections[reason]??0)+1;
        if(checkpoint.best&&attempt%3===0)checkpoint.pending=reviseCandidate(checkpoint.best.candidate,report,config.seed,attempt+1);
        if(config.agentUrl&&attempt%10===9){
          const {revisionProposal}=await import('./director/AutonomousWorkflow');
          try{const revised=await revisionProposal(config,contract,candidate,report);if(revised)checkpoint.pending=revised;}
          catch(e){checkpoint.aiFeedback??=[];checkpoint.aiFeedback.push({slot,attempt,error:e instanceof Error?e.message:'AI revision unavailable'});}
        }
      }
      persist();log({event:'evaluated',slot:slot+1,attempt:attempt+1,pool:checkpoint.currentPool.length,decision:report.decision});
    }
    if(!checkpoint.currentPool.length)return stop(`${contract.contractId}: unresolved after attempt budget; infeasibility not proven`);
    const nextPools=[...checkpoint.pools,checkpoint.currentPool];
    const ranked=optimizeCampaign(nextPools,config.beamWidth??32);
    if(!ranked){checkpoint.currentPool.sort((a,b)=>a.report.softPenalty-b.report.softPenalty);checkpoint.currentPool=checkpoint.currentPool.slice(0,Math.max(0,poolSize-1));return stop(`${contract.contractId}: no valid progression combination within beam budget; resume generates a replacement`);}
    checkpoint.pools=nextPools;checkpoint.currentPool=[];
    checkpoint.accepted=ranked.levels;checkpoint.nextSlot=slot+1;checkpoint.attempt=0;checkpoint.best=undefined;persist();
  }
  // Rebuild context after global selection; every chosen level is verified again.
  const final:AcceptedCandidate[]=[];const learned:string[]=[],insights:string[]=[];
  for(const entry of checkpoint.accepted){
    if(signal?.aborted||checkpoint.elapsedMs+Date.now()-last>=config.maxRunMs)return stop('Final verification interrupted or budget exhausted');
    const context=createEvaluationContext([...LEVELS,...final.map(a=>a.candidate.level)],config.solver,learned,insights,[...BASE_PATTERNS,...final.map(a=>({levelId:a.candidate.level.id,pattern:solutionPattern(a.candidate.level,a.report.solver!.solutionPath!)}))],config.difficultyModel);
    const report=await evaluateBounded(entry.candidate.level,entry.candidate.contract,context,signal);
    if(report.decision!=='ELIGIBLE'){
      if(report.decision==='HOLD')return stop(`Final verification HOLD L${entry.candidate.level.id}: ${report.reasons.join(', ')}`);
      const slot=entry.candidate.level.id-1;checkpoint.repairCount++;
      if(checkpoint.repairCount>config.candidateBudget)return stop('Final repair budget exhausted');
      checkpoint.pools[slot]=checkpoint.pools[slot].filter(a=>a.candidate.candidateId!==entry.candidate.candidateId);
      const alternative=optimizeCampaign(checkpoint.pools,config.beamWidth??32);
      if(alternative){checkpoint.accepted=alternative.levels;persist();return runPipeline({...config,resume:true},signal,log);}
      checkpoint.pools=checkpoint.pools.slice(0,slot);checkpoint.accepted=final;checkpoint.nextSlot=slot;
      checkpoint.attempt=checkpoint.slotAttempts[slot]??0;checkpoint.currentPool=[];checkpoint.best=undefined;checkpoint.pending=undefined;
      persist();return runPipeline({...config,resume:true},signal,log);
    }
    final.push({...entry,report});const c=entry.candidate.contract;if(c.progressionRole==='TEACH'&&c.introducedMechanic)learned.push(c.introducedMechanic);insights.push(c.primaryInsight);
  }
  const campaign=validateCampaign(final,config.count);checkpoint.accepted=final;checkpoint.status=campaign.success?'COMPLETE':'PARTIAL';checkpoint.reasons=campaign.errors;
  writeJson(join(config.output,'campaign-validation.json'),campaign);persist();return checkpoint;
}
export async function buildPipeline(config:PipelineConfig,signal?:AbortSignal,log?:(v:unknown)=>void):Promise<RunCheckpoint>{
  const run=await runPipeline(config,signal,log);
  if(run.status==='COMPLETE'){
    const exportStarted=Date.now();
    try{const remaining=config.maxRunMs-run.elapsedMs;if(remaining<=0)throw new Error('Cumulative export budget exhausted');const exportSignal=signal?AbortSignal.any([signal,AbortSignal.timeout(remaining)]):AbortSignal.timeout(remaining);const generation={aiAttempts:existsSync(join(config.output,'agent-attempts'))?readdirSync(join(config.output,'agent-attempts')).filter(name=>/^[a-f0-9]{16}-[0-9]+(-error)?\.json$/.test(name)).sort().map(name=>({name,artifact:readJson(join(config.output,'agent-attempts',name))})):undefined,reusedCandidates:config.reuse?.map(a=>a.candidate),aiPlan:existsSync(join(config.output,'ai-plan.json'))?readJson(join(config.output,'ai-plan.json')):undefined,runManifest:readJson(join(config.output,'run-manifest.json')),aiUsage:existsSync(join(config.output,'ai-usage.json'))?readJson(join(config.output,'ai-usage.json')):undefined,agents:readdirSync(config.output).filter(name=>/^agent-(direct|architect|critic|research)-[a-f0-9]{16}\.json$/.test(name)).sort().map(name=>({name,artifact:readJson(join(config.output,name))}))};const artifact=await exportCampaign(run.accepted,config.count,join(config.output,'approved'),config.campaignId,exportSignal,exportStarted+remaining,generation);writeJson(join(config.output,'export-status.json'),{status:'EXPORTED',campaignId:artifact.campaignId,campaignVersion:artifact.campaignVersion,contentHash:artifact.contentHash,auditHash:artifact.auditHash,auditVersion:artifact.auditVersion,artifactPath:join(config.output,'approved',`${artifact.campaignId}-${artifact.campaignVersion}-${artifact.auditVersion}`)});}
    catch(e){writeJson(join(config.output,'export-status.json'),{status:'FAILED',reason:e instanceof Error?e.message:'Unknown export error'});throw e;}
    finally{run.elapsedMs+=Date.now()-exportStarted;run.integrityHash=hash({...run,integrityHash:undefined});writeJson(join(config.output,'checkpoint.json'),run);}
  }
  return run;
}
